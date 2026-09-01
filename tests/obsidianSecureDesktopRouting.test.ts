import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

function readNormalized(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("Obsidian secure desktop routing", () => {
  test("desktop routes Obsidian calls through the trusted backend", () => {
    const source = readNormalized("src/services/api.ts");
    expect(source).toContain("if (!window.electronAPI) {");
    expect(source).toContain("const parsedUrl = new URL(normalizedEndpoint)");
    expect(source).toContain('/api/obsidian/test-connection');
    expect(source).toContain('/api/obsidian/proxy');
  });

  test("backend restricts local certificate handling to the official Obsidian endpoint", () => {
    const source = readNormalized("server.ts");
    expect(source).toContain("isOfficialObsidianSelfSignedEndpoint");
    expect(source).toContain('target.port === "27124"');
    expect(source).toContain('hostname === "127.0.0.1"');
    expect(source).toContain('hostname === "localhost"');
  });

  test("server uses the secure loopback bridge for connection test and proxy", () => {
    const source = readNormalized("server.ts");
    expect(source).toContain("await requestObsidianLoopback");
    expect(source).toContain("Conectado e autenticado com sucesso ao Obsidian Local REST API");
  });
});
