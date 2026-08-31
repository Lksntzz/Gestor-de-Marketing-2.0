import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("AI connection Stage 4 trusted bridge contract", () => {
  test("canonical metadata uses a dedicated secret-free file instead of the legacy config writer", () => {
    const bridge = source("src/electron/ai/registerAIConnectionRuntimeIpc.ts");

    expect(bridge).toContain('const AI_CONNECTION_FILE_NAME = "nisti_ai_connection.json";');
    expect(bridge).toContain('const LEGACY_CONFIG_FILE_NAME = "nisti_config.json";');
    expect(bridge).toContain("JSON.stringify(parsed, null, 2)");
    expect(bridge).toContain("parsePersistedAIConnection(input)");
    expect(bridge).toContain("if (persisted.exists) return createEmptyAIConnection();");
    expect(bridge).toContain("fs.rm(connectionFilePath(), { force: true })");
    expect(bridge).not.toContain("stripSecretFields");
    expect(bridge).not.toContain("ipcMain.handle");
  });

  test("renderer bridge sends only provider and model choices to the trusted runtime", () => {
    const preload = source("src/preload.ts");
    const start = preload.indexOf("// New single-connection bridge");
    const end = preload.indexOf("getSystemStatus:", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = preload.slice(start, end);
    expect(block).toContain('ipcRenderer.invoke("ai-connection:get-state")');
    expect(block).toContain('ipcRenderer.invoke("ai-connection:reset")');
    expect(block).toContain('ipcRenderer.invoke("ai-connection:confirm-provider", { provider })');
    expect(block).toContain('ipcRenderer.invoke("ai-connection:validate-model", { provider, model })');
    expect(block).not.toContain("apiKey");
    expect(block).not.toContain("secretRef");
    expect(block).not.toContain("discoveredModels");
  });

  test("trusted input parser accepts no renderer-controlled credential or model list fields", () => {
    const bridge = source("src/electron/ai/registerAIConnectionRuntimeIpc.ts");

    expect(bridge).toContain('const ALLOWED_PROVIDER_KEYS = new Set(["provider"]);');
    expect(bridge).toContain('const ALLOWED_MODEL_KEYS = new Set(["provider", "model"]);');
    expect(bridge).toContain("hasOnlyKeys(input, ALLOWED_PROVIDER_KEYS)");
    expect(bridge).toContain("hasOnlyKeys(input, ALLOWED_MODEL_KEYS)");
  });

  test("all new AI IPC handlers are registered at the audited bootstrap boundary and validate the sender", () => {
    const bootstrap = source("electron-bootstrap.ts");

    for (const channel of [
      "ai-connection:get-state",
      "ai-connection:reset",
      "ai-connection:confirm-provider",
      "ai-connection:validate-model",
    ]) {
      const handlerStart = bootstrap.indexOf(`ipcMain.handle("${channel}"`);
      expect(handlerStart).toBeGreaterThanOrEqual(0);
      const handlerEnd = bootstrap.indexOf("});", handlerStart);
      const handler = bootstrap.slice(handlerStart, handlerEnd);
      expect(handler).toContain("assertTrustedIpcSender(event)");
    }
  });

  test("secret mutation revokes dependent AI metadata before the secure-store write", () => {
    const bootstrap = source("electron-bootstrap.ts");

    const setStart = bootstrap.indexOf('ipcMain.handle("secret:set"');
    const setEnd = bootstrap.indexOf('ipcMain.handle("secret:get"', setStart);
    const setBlock = bootstrap.slice(setStart, setEnd);
    const idempotentGuard = setBlock.indexOf("previousValue === nextValue");
    const setRevoke = setBlock.indexOf("await revokeAIConnectionSecretStoreKey(name)");
    const setWrite = setBlock.indexOf("await writeSecretStore(store)");
    expect(idempotentGuard).toBeGreaterThanOrEqual(0);
    expect(setRevoke).toBeGreaterThan(idempotentGuard);
    expect(setWrite).toBeGreaterThan(setRevoke);

    const deleteStart = bootstrap.indexOf('ipcMain.handle("secret:delete"');
    const deleteEnd = bootstrap.indexOf('ipcMain.handle("ai-connection:get-state"', deleteStart);
    const deleteBlock = bootstrap.slice(deleteStart, deleteEnd);
    const deleteRevoke = deleteBlock.indexOf("await revokeAIConnectionSecretStoreKey(name)");
    const deleteWrite = deleteBlock.indexOf("await writeSecretStore(store)");
    expect(deleteRevoke).toBeGreaterThanOrEqual(0);
    expect(deleteWrite).toBeGreaterThan(deleteRevoke);
  });
});
