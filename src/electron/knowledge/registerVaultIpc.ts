import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { dialog } from "electron";
import { assertTrustedIpcSender } from "../security/trustedRenderer";
import { VaultBootstrapService } from "./VaultBootstrapService";
import { VaultReaderService } from "./VaultReaderService";
import { writeCanonicalKnowledgeNote } from "./CanonicalKnowledgeWriter";
import { knowledgeContextService } from "../../services/knowledge/KnowledgeContextService";

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

export function registerVaultIpcHandlers(ipcMain: Electron.IpcMain): void {
  // 1. Select / Pick Vault directory and bootstrap/repair official structure
  ipcMain.handle("vault:select", async (event) => {
    assertTrustedIpcSender(event);

    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Selecionar Pasta do Vault do Obsidian (Nisti Marketing)",
      buttonLabel: "Selecionar Vault",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    const bootstrap = await VaultBootstrapService.bootstrapOrRepairVault({
      vaultPath: selectedPath,
    });

    activeVaultPath = bootstrap.vaultPath;
    isObsidianConnected = true;

    return {
      vaultPath: bootstrap.vaultPath,
      vaultName: bootstrap.vaultName,
      foldersCreated: bootstrap.repairedFolders,
      templatesCreated: bootstrap.repairedTemplates,
      audit: bootstrap.audit,
    };
  });

  // 2. Get current active vault path
  ipcMain.handle("vault:get-path", async (event) => {
    assertTrustedIpcSender(event);
    return activeVaultPath || "";
  });

  // 3. Set connection state
  ipcMain.handle("vault:connection-state", async (event, connected: boolean) => {
    assertTrustedIpcSender(event);
    isObsidianConnected = Boolean(connected);
    return { success: true, connected: isObsidianConnected };
  });

  // 4. List official taxonomy folders in vault
  ipcMain.handle("vault:list-folders", async (event) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) return [];
    return VaultReaderService.listVaultFolders(activeVaultPath);
  });

  // 5. Read all notes directly from official folders
  ipcMain.handle("notes:read-all", async (event) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) return [];
    return VaultReaderService.readAllNotes(activeVaultPath);
  });

  // 6. Audit vault integrity
  ipcMain.handle("vault:audit", async (event) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo selecionado.");
    }
    return VaultBootstrapService.auditVault(activeVaultPath);
  });

  // 7. Repair vault structure without loss
  ipcMain.handle("vault:repair", async (event) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo selecionado.");
    }
    return VaultBootstrapService.bootstrapOrRepairVault({
      vaultPath: activeVaultPath,
      forceRepair: true,
    });
  });

  // 8. Write note directly to vault
  ipcMain.handle("notes:write", async (event, payload: any) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo configurado para gravação.");
    }
    return writeCanonicalKnowledgeNote({
      vaultPath: activeVaultPath,
      folder: payload.folder,
      title: payload.title,
      content: payload.content,
      frontmatter: payload.frontmatter,
    });
  });

  // 8.1 Query knowledge directly using KnowledgeContextService
  ipcMain.handle("knowledge:query", async (event, query: string, preferredPaths?: string[]) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      return { sources: [], warning: "Nenhum Vault configurado." };
    }
    const summaries = await VaultReaderService.readAllNotes(activeVaultPath);
    const notes = summaries.map((s) => ({
      id: s.relativePath,
      path: s.relativePath,
      title: s.title,
      folder: s.folder,
      content: s.content,
      frontmatter: s.frontmatter || {},
      tags: Array.isArray(s.frontmatter?.tags) ? (s.frontmatter.tags as string[]) : [],
      wikilinks: [],
      lastModified: new Date(s.mtime).toISOString(),
      sizeBytes: s.size,
    }));
    return knowledgeContextService.select({
      query: String(query || ""),
      notes,
      preferredSourcePaths: preferredPaths,
    });
  });

  // 8.2 Commit knowledge note directly with canonical structure
  ipcMain.handle("knowledge:commit", async (event, payload: any) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo configurado para gravação.");
    }
    return writeCanonicalKnowledgeNote({
      vaultPath: activeVaultPath,
      folder: payload.folder || "00_Inbox",
      title: payload.title,
      content: payload.content,
      frontmatter: payload.frontmatter,
    });
  });

  // 9. Append content to note
  ipcMain.handle("notes:append", async (event, payload: any) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo configurado para gravação.");
    }
    const folderPath = path.join(activeVaultPath, payload.folder || "00_Inbox");
    const filePath = path.join(folderPath, `${payload.title}.md`);
    if (!filePath.startsWith(activeVaultPath)) {
      throw new Error("Caminho de gravação fora do Vault.");
    }

    if (!existsSync(filePath)) {
      return writeCanonicalKnowledgeNote({
        vaultPath: activeVaultPath,
        folder: payload.folder,
        title: payload.title,
        content: payload.contentToAppend,
      });
    }

    await fs.appendFile(filePath, `\n\n${payload.contentToAppend}`, "utf8");
    return { success: true };
  });

  // 10. Delete note from vault
  ipcMain.handle("notes:delete", async (event, payload: any) => {
    assertTrustedIpcSender(event);
    if (!activeVaultPath) {
      throw new Error("Nenhum Vault ativo configurado.");
    }
    const folderPath = path.join(activeVaultPath, payload.folder || "00_Inbox");
    const filePath = path.join(folderPath, `${payload.title}.md`);
    if (!filePath.startsWith(activeVaultPath)) {
      throw new Error("Tentativa de exclusão fora do Vault.");
    }

    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    return { success: true };
  });
}
