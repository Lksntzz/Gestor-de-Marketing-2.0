import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { app } from "electron";
import { assertTrustedIpcSender } from "../security/trustedRenderer";
import { VaultBootstrapService } from "./VaultBootstrapService";

let activeVaultPath: string | null = null;
let isObsidianConnected = false;

export function getActiveVaultPath(): string | null {
  return activeVaultPath;
}

export function isVaultConnected(): boolean {
  return isObsidianConnected && Boolean(activeVaultPath);
}

export function setActiveVaultPath(vaultPath: string | null, connected: boolean = false): void {
  activeVaultPath = vaultPath;
  isObsidianConnected = connected;
}

async function resolveConfiguredVaultPath(): Promise<string> {
  if (activeVaultPath && existsSync(activeVaultPath)) {
    return path.resolve(activeVaultPath);
  }

  const configPath = path.join(app.getPath("userData"), "nisti_config.json");
  if (!existsSync(configPath)) {
    throw new Error("Nenhum Vault ativo selecionado.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("A configuração local do Vault está inválida ou inacessível.");
  }

  const configuredPath = typeof parsed.vaultPath === "string" ? parsed.vaultPath.trim() : "";
  if (!configuredPath) {
    throw new Error("Nenhum Vault ativo selecionado.");
  }

  const resolved = path.resolve(configuredPath);
  if (!existsSync(resolved)) {
    throw new Error("O Vault configurado não existe mais ou não está acessível.");
  }

  activeVaultPath = resolved;
  return resolved;
}

/**
 * Registra apenas operações de manutenção estrutural ainda não existentes no
 * electron-main legado. Os demais canais de Vault/Notas/Knowledge continuam
 * com uma única implementação no electron-main, evitando segundo
 * ipcMain.handle() para o mesmo canal durante o bootstrap.
 */
export function registerVaultIpcHandlers(ipcMain: Electron.IpcMain): void {
  ipcMain.handle("vault:audit", async (event) => {
    assertTrustedIpcSender(event);
    const vaultPath = await resolveConfiguredVaultPath();
    return VaultBootstrapService.auditVault(vaultPath);
  });

  ipcMain.handle("vault:repair", async (event) => {
    assertTrustedIpcSender(event);
    const vaultPath = await resolveConfiguredVaultPath();
    const result = await VaultBootstrapService.bootstrapOrRepairVault({
      vaultPath,
      forceRepair: true,
    });
    activeVaultPath = result.vaultPath;
    return result;
  });
}
