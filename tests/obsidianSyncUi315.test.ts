import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

function source(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("Obsidian sync/UI 3.1.5 regressions", () => {
  test("root Markdown is labeled as Vault root instead of a second 00_Inbox", () => {
    const api = source("src/services/api.ts");
    expect(api).toContain('export const OBSIDIAN_VAULT_ROOT_LABEL = "Raiz do Vault"');
    expect(api).toContain('const folder = pathParts.join("/") || OBSIDIAN_VAULT_ROOT_LABEL;');
  });

  test("manual sync is visible and wired in the navbar", () => {
    const navbar = source("src/components/Navbar.tsx");
    expect(navbar).toContain("Sincronizar agora");
    expect(navbar).toContain("onClick={onSyncNow}");
    expect(navbar).toContain("animate-spin");
  });

  test("connected Vault runs silent periodic reconciliation", () => {
    const app = source("src/App.tsx");
    expect(app).toContain("autoSyncBootstrappedRef");
    expect(app).toContain("handleSyncNow({ silent: true })");
    expect(app).toContain("window.setInterval(runAutoSync, intervalSeconds * 1000)");
    expect(app).toContain("Math.max(30, Number(apiConfig.syncIntervalSeconds) || 60)");
  });

  test("folder selector explicitly uses a readable dark native palette", () => {
    const view = source("src/components/AddKnowledgeView.tsx");
    expect(view).toContain('style={{ colorScheme: "dark" }}');
    expect(view).toContain('backgroundColor: "#111827"');
    expect(view).toContain('color: "#ffffff"');
  });
});
