import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const storageManager = readFileSync(
  join(root, "src/services/storage/StorageManager.ts"),
  "utf8"
);

describe("AI connection Stage 5 factory reset gate", () => {
  test("factory reset clears the canonical AI credential before legacy secrets and local state", () => {
    const methodStart = storageManager.indexOf("public async factoryResetAll(): Promise<void>");
    expect(methodStart).toBeGreaterThan(-1);

    const factoryReset = storageManager.slice(methodStart);
    const canonicalClear = factoryReset.indexOf("clearAIConnectionCredential");
    const legacySecretClear = factoryReset.indexOf('deleteSecret("obsidianApiKey")');
    const localStateClear = factoryReset.indexOf("localStorage.clear()");

    expect(canonicalClear).toBeGreaterThan(-1);
    expect(legacySecretClear).toBeGreaterThan(canonicalClear);
    expect(localStateClear).toBeGreaterThan(legacySecretClear);
  });

  test("factory reset fails closed when the canonical credential bridge is unavailable or rejects cleanup", () => {
    const methodStart = storageManager.indexOf("public async factoryResetAll(): Promise<void>");
    const factoryReset = storageManager.slice(methodStart);

    expect(factoryReset).toContain("if (!aiConnectionBridge.clearAIConnectionCredential)");
    expect(factoryReset).toContain("if (!aiCredentialResult?.success)");
    expect(factoryReset).toContain("throw new Error(\"Não foi possível remover a credencial canônica de IA durante o reset.\")");
  });
});
