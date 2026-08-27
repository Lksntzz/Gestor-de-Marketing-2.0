import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("knowledge ingestion v2 etapa 3", () => {
  test("commit de conhecimento é fail-closed, transacional e não sobrescreve arquivos existentes", async () => {
    const desktop = await read("electron-main.ts");
    const preload = await read("src/preload.ts");
    const types = await read("src/types.ts");

    expect(desktop).toContain('ipcMain.handle("knowledge:commit"');
    expect(desktop).toContain("requireExistingVaultFolder");
    expect(desktop).toContain("resolveUniqueVaultPath");
    expect(desktop).toContain('flag: "wx"');
    expect(desktop).toContain("MAX_PERSISTED_ASSET_BYTES");
    expect(desktop).toContain("Could not roll back knowledge asset after note failure");
    expect(preload).toContain("commitKnowledge");
    expect(types).toContain("commitKnowledge:");
  });

  test("PDF e imagem preservam a fonte física e a análise referencia o asset real", async () => {
    const desktop = await read("electron-main.ts");
    const knowledge = await read("src/components/AddKnowledgeView.tsx");

    expect(desktop).toContain('frontmatter.source_type = "curated_asset"');
    expect(desktop).toContain("frontmatter.asset_path");
    expect(desktop).toContain("frontmatter.asset_mtime");
    expect(desktop).toContain("## Fonte original");
    expect(knowledge).toContain("asset: isBinarySource");
    expect(knowledge).toContain("Fonte original preservada");
    expect(knowledge).toContain("A preservação do arquivo original exige o runtime desktop");
  });

  test("curadoria manual evita duplicar o mesmo asset no índice automático enquanto a versão não mudou", async () => {
    const desktop = await read("electron-main.ts");

    expect(desktop).toContain("curatedAssetVersions");
    expect(desktop).toContain("curatedMtime");
    expect(desktop).toContain("Math.abs(curatedMtime - asset.mtimeMs) < 1");
  });

  test("destino de gravação vem das pastas reais do Obsidian e não de uma lista estática na tela", async () => {
    const knowledge = await read("src/components/AddKnowledgeView.tsx");

    expect(knowledge).toContain("listVaultFolders");
    expect(knowledge).toContain("vaultFolders.includes(folder)");
    expect(knowledge).toContain("Pasta real do Obsidian");
    expect(knowledge).not.toContain("STANDARD_VAULT_FOLDERS");
  });

  test("UI só recebe a nova nota depois do commit confirmado", async () => {
    const knowledge = await read("src/components/AddKnowledgeView.tsx");
    const commitIndex = knowledge.indexOf("window.electronAPI.commitKnowledge");
    const addIndex = knowledge.indexOf("onAddNote(newNote)");

    expect(commitIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeGreaterThan(commitIndex);
    expect(knowledge).toContain("api.syncObsidianSnapshot");
  });
});
