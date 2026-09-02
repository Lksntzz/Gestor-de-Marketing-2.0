import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  MANAGED_OBSIDIAN_SCAN_ROOTS,
  isManagedObsidianPath,
  isManagedObsidianRoot,
  sanitizeManagedObsidianRoots,
} from "../src/services/obsidianManagedScope";
import { validateObsidianProxyPath } from "../src/services/obsidian/obsidianEndpointValidator";

describe("hotfix 3.1.13 — escopo gerenciado do Obsidian", () => {
  test("não permite que pastas externas entrem na sincronização operacional", () => {
    expect(isManagedObsidianRoot("Clippings")).toBe(false);
    expect(isManagedObsidianRoot("Projetos/Pessoal")).toBe(false);
    expect(isManagedObsidianPath("Clippings/Referencias.md")).toBe(false);

    expect(isManagedObsidianRoot("00_Base")).toBe(true);
    expect(isManagedObsidianRoot("Nisti Marketing/00_Base")).toBe(true);
    expect(isManagedObsidianPath("04_Campanhas/TESTE-CAMPANHA-001.md")).toBe(true);
    expect(isManagedObsidianPath("Nisti Marketing/04_Campanhas/Legado.md")).toBe(true);
  });

  test("roots externas explícitas são descartadas e nunca viram fallback para a raiz inteira", () => {
    expect(sanitizeManagedObsidianRoots(["Clippings", "Pessoal"])).toEqual(MANAGED_OBSIDIAN_SCAN_ROOTS);
    expect(sanitizeManagedObsidianRoots(["Clippings", "00_Base"])).toEqual(["00_Base"]);
    expect(MANAGED_OBSIDIAN_SCAN_ROOTS).not.toContain("");
    expect(MANAGED_OBSIDIAN_SCAN_ROOTS).not.toContain("Clippings");
  });
});

describe("hotfix 3.1.13 — path seguro sem falso positivo", () => {
  test("aceita a campanha usada no teste manual", () => {
    const path = "/vault/04_Campanhas/TESTE-CAMPANHA-001.md";
    expect(validateObsidianProxyPath(path)).toBe(path);
  });

  test("aceita pontos consecutivos dentro de nome legítimo, mas bloqueia traversal real", () => {
    expect(validateObsidianProxyPath("/vault/03_Conteudos/versao..final.md"))
      .toBe("/vault/03_Conteudos/versao..final.md");

    expect(() => validateObsidianProxyPath("/vault/../segredo.md")).toThrow("Path traversal");
    expect(() => validateObsidianProxyPath("/vault/%2e%2e/segredo.md")).toThrow("Path traversal");
    expect(() => validateObsidianProxyPath("/vault/%252e%252e/segredo.md")).toThrow("Path traversal");
    expect(() => validateObsidianProxyPath("/vault/04_Campanhas%2Ffora.md")).toThrow("Path traversal");
  });
});

describe("hotfix 3.1.13 — conexão read-only", () => {
  test("guard substitui teste/probe desktop por autenticação read-only", async () => {
    const source = await readFile(new URL("../src/services/verifiedObsidianWriteGuard.ts", import.meta.url), "utf8");
    expect(source).toContain('fetch("/api/obsidian/test-connection"');
    expect(source).toContain("verifyConnectionReadOnly");
    expect(source).toContain("api.probeObsidianConnection = async");
    expect(source).toContain("api.testObsidianConnection = async");
    expect(source).toContain("sanitizeManagedObsidianRoots(roots)");
    expect(source).toContain("MANAGED_OBSIDIAN_SCAN_ROOTS");

    const readOnlyBlock = source.slice(
      source.indexOf("async function requestReadOnlyConnectionTest"),
      source.indexOf("function stopSafeHeartbeat"),
    );
    expect(readOnlyBlock).not.toContain('method: "PUT"');
    expect(readOnlyBlock).not.toContain('method: "DELETE"');
    expect(readOnlyBlock).not.toContain("ensureNistiRemoteStructure");
    expect(readOnlyBlock).not.toContain("triageNistiInbox");
  });
});
