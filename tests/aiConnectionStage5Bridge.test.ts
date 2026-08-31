import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const preload = readFileSync(join(root, "src/preload.ts"), "utf8");
const bootstrap = readFileSync(join(root, "electron-bootstrap.ts"), "utf8");

describe("AI connection Stage 5 renderer bridge", () => {
  test("preload exposes dedicated write and clear operations without an active credential getter", () => {
    expect(preload).toContain("setAIConnectionCredential");
    expect(preload).toContain('ipcRenderer.invoke("ai-connection:set-credential", apiKey)');
    expect(preload).toContain("clearAIConnectionCredential");
    expect(preload).toContain('ipcRenderer.invoke("ai-connection:clear-credential")');
    expect(preload).not.toContain("getAIConnectionCredential");
    expect(preload).not.toContain('getSecret("aiConnectionKey")');
  });

  test("generic secret IPC cannot read or write the canonical active AI slot", () => {
    const allowedSecretSet = bootstrap.match(/const ALLOWED_SECRET_NAMES = new Set\((\[[^;]+\])\);/s)?.[1] || "";
    expect(allowedSecretSet).not.toContain("aiConnectionKey");
    expect(bootstrap).toContain('const AI_CONNECTION_SECRET_NAME = "aiConnectionKey";');
  });

  test("dedicated credential handlers are protected by trusted-renderer validation", () => {
    for (const channel of ["ai-connection:set-credential", "ai-connection:clear-credential"]) {
      const start = bootstrap.indexOf(`ipcMain.handle("${channel}"`);
      expect(start).toBeGreaterThanOrEqual(0);
      const nextHandler = bootstrap.indexOf("ipcMain.handle(", start + 20);
      const handlerBody = bootstrap.slice(start, nextHandler === -1 ? bootstrap.length : nextHandler);
      expect(handlerBody).toContain("assertTrustedIpcSender(event)");
    }
  });

  test("credential value is never returned by dedicated IPC", () => {
    const setStart = bootstrap.indexOf('ipcMain.handle("ai-connection:set-credential"');
    const clearStart = bootstrap.indexOf('ipcMain.handle("ai-connection:clear-credential"');
    const setHandler = bootstrap.slice(setStart, clearStart);
    expect(setHandler).toContain("safeStorage.encryptString(nextValue)");
    expect(setHandler).not.toContain("return nextValue");
    expect(setHandler).not.toContain("decryptString(Buffer.from(encrypted");
  });
});
