import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  isAllowedExternalUrl,
  isTrustedRendererUrl,
} from "../src/electron/security/trustedRenderer";

describe("Electron renderer security boundary", () => {
  test("confia somente no renderer local empacotado ou loopback", () => {
    expect(isTrustedRendererUrl("http://127.0.0.1:43121/")).toBe(true);
    expect(isTrustedRendererUrl("http://localhost:3000/")).toBe(true);
    expect(isTrustedRendererUrl("file:///C:/Program%20Files/Nisti/resources/app/dist/index.html")).toBe(false);
    expect(isTrustedRendererUrl("https://example.com/")).toBe(false);
    expect(isTrustedRendererUrl("http://127.0.0.1/")).toBe(false);
    expect(isTrustedRendererUrl("file:///tmp/index.html")).toBe(false);
  });

  test("abre externamente apenas HTTPS e Obsidian sem credenciais embutidas", () => {
    expect(isAllowedExternalUrl("https://github.com/Lksntzz/Gestor-de-Marketing-2.0")).toBe(true);
    expect(isAllowedExternalUrl("obsidian://open?vault=MarketingVault")).toBe(true);
    expect(isAllowedExternalUrl("http://example.com/")).toBe(false);
    expect(isAllowedExternalUrl("https://user:secret@example.com/")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
  });

  test("janela, preload, IPC e CSP permanecem protegidos em conjunto", async () => {
    const [main, bootstrap, html, server] = await Promise.all([
      readFile(new URL("../electron-main.ts", import.meta.url), "utf8"),
      readFile(new URL("../electron-bootstrap.ts", import.meta.url), "utf8"),
      readFile(new URL("../index.html", import.meta.url), "utf8"),
      readFile(new URL("../server.ts", import.meta.url), "utf8"),
    ]);

    expect(main).toContain("setWindowOpenHandler");
    expect(main).toContain('webContents.on("will-navigate"');
    expect(main).toContain('webContents.on("will-redirect"');
    expect(main).toContain("assertTrustedIpcSender(event)");
    expect(bootstrap).toContain("assertTrustedIpcSender(event)");
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(server).toContain('res.setHeader("Content-Security-Policy"');
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("sandbox: true");
    expect(main).not.toContain('console.error("Failed to save config:"');
    const saveIndex = main.indexOf("await saveConfig({ vaultPath });");
    expect(main.indexOf("selectedVaultPath = vaultPath;", saveIndex)).toBeGreaterThan(saveIndex);
  });
});
