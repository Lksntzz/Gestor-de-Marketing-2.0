import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { creativeCommitCandidates } from "../src/services/creativeVaultPersistence";
import { editorialItemSqlBindings } from "../src/services/knowledge/index/sqliteBindings";

describe("hotfix 3.1.11 — calendário SQLite", () => {
  test("normaliza hora e demais campos opcionais ausentes para SQL NULL", () => {
    const bindings = editorialItemSqlBindings({
      id: "ed-1",
      title: "Conteúdo planejado",
      contentType: "Carrossel de 5 slides",
      platform: "Instagram",
      objective: "Educar",
      scheduledDate: "2026-09-05",
      scheduledTime: undefined,
      status: "DRAFT",
      priority: "medium",
      scriptId: "script-1",
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    expect(bindings).toHaveLength(16);
    expect(bindings[6]).toBeNull();
    expect(bindings[9]).toBeNull();
    expect(bindings[11]).toBeNull();
    expect(bindings[12]).toBeNull();
    expect(bindings[13]).toBeNull();
    expect(bindings.some((value) => value === undefined)).toBe(false);
  });

  test("aceita snake_case/camelCase e converte strings vazias opcionais para NULL", () => {
    const bindings = editorialItemSqlBindings({
      id: "ed-2",
      title: "Post",
      content_type: "Post",
      scheduled_date: "2026-09-06",
      scheduled_time: "",
      created_at: 10,
      updated_at: 20,
    });

    expect(bindings[2]).toBe("Post");
    expect(bindings[5]).toBe("2026-09-06");
    expect(bindings[6]).toBeNull();
    expect(bindings[14]).toBe(10);
    expect(bindings[15]).toBe(20);
  });

  test("KnowledgeIndex usa a fronteira normalizada antes do stmt.run", async () => {
    const source = await readFile(new URL("../src/services/knowledge/index/KnowledgeIndex.ts", import.meta.url), "utf8");
    expect(source).toContain('import { editorialItemSqlBindings } from "./sqliteBindings"');
    expect(source).toContain("stmt.run(...editorialItemSqlBindings(item))");
  });
});

describe("hotfix 3.1.11 — persistência de Copywriting", () => {
  test("rota Copies para a árvore canônica e recua apenas para 03_Conteudos se a subpasta faltar", () => {
    const canonical = creativeCommitCandidates({
      folder: "03_Conteudos/Copies",
      title: "Copy validada",
      content: "# Copy",
    });
    expect(canonical.map((item) => item.folder)).toEqual(["03_Conteudos/Copies", "03_Conteudos"]);

    const legacy = creativeCommitCandidates({
      folder: "02_Conteudo/Copies",
      title: "Copy antiga",
      content: "# Copy",
    });
    expect(legacy.map((item) => item.folder)).toEqual(["03_Conteudos/Copies", "03_Conteudos"]);
  });

  test("componente de Copywriting não anuncia nem grava no caminho legado", async () => {
    const source = await readFile(new URL("../src/components/CopywritingGenerator.tsx", import.meta.url), "utf8");
    expect(source).toContain('"03_Conteudos/Copies"');
    expect(source).toContain("03_Conteudos/Copies/${cleanFileName}.md");
    expect(source).not.toContain("02_Conteudo/Copies");
  });

  test("versão de pacote e runtime permanecem alinhadas após hotfixes subsequentes", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const reliability = await readFile(new URL("../src/utils/reliability.ts", import.meta.url), "utf8");
    expect(reliability).toContain(`APP_VERSION = "${pkg.version}"`);
  });
});
