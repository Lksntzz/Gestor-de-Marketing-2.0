import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

describe("Obsidian secure desktop routing", () => {
  test("desktop routes Obsidian calls through the trusted backend", () => {
    const source = readFileSync("src/services/api.ts", "utf8");
    expect(source).toContain("if (!window.electronAPI) {\n    try {");
    expect(source).toContain("if (!window.electronAPI) {\n    try {\n      const parsedUrl");
    expect(source).not.toContain("if (!window.electronAPI || useDirectClientSideFetch)");
  });

  test("backend self-signed exception is restricted to official Obsidian loopback HTTPS", () => {
    const source = readFileSync("server.ts", "utf8");
    expect(source).toContain("isOfficialObsidianSelfSignedEndpoint");
    expect(source).toContain('target.port === "27124"');
    expect(source).toContain('hostname === "127.0.0.1"');
    expect(source).toContain('rejectUnauthorized: !trustOfficialLocalCertificate');
    expect(source).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
  });

  test("server uses secure loopback bridge for connection test and proxy", () => {
    const source = readFileSync("server.ts", "utf8");
    expect(source).toContain("await requestObsidianLoopback");
    expect(source).toContain("Conectado e autenticado com sucesso ao Obsidian Local REST API");
  });
});
