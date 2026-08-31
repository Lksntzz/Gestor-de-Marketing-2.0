import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("knowledge ingestion v2 etapa 3", () => {
  test("commit físico de conhecimento continua fail-closed, transacional e sem sobrescrita", async () => {
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

  test("PDF, imagem e áudio preservam o original no fluxo físico e no REST sem sobrescrever", async () => {
    const desktop = await read("electron-main.ts");
    const knowledge = await read("src/components/AddKnowledgeView.tsx");
    const api = await read("src/services/api.ts");
    const server = await read("server.ts");

    expect(desktop).toContain('frontmatter.source_type = "curated_asset"');
    expect(desktop).toContain("frontmatter.asset_path");
    expect(desktop).toContain("frontmatter.asset_mtime");
    expect(desktop).toContain("## Fonte original");
    expect(desktop).toContain('".mp3"');
    expect(desktop).toContain('"audio"');

    expect(knowledge).toContain("asset: isBinarySource");
    expect(knowledge).toContain("Fonte original preservada");
    expect(knowledge).toContain("physicalVaultPath");
    expect(knowledge).toContain("api.pushBinaryAssetToObsidian");
    expect(knowledge).toContain('source_preservation: "rest_binary_preserved"');
    expect(knowledge).toContain("api.deleteObsidianPath");

    expect(api).toContain("pushBinaryAssetToObsidian");
    expect(api).toContain("Já existe um asset com o mesmo caminho no Obsidian");
    expect(server).toContain("Tipo binário não autorizado para o proxy do Obsidian");
    expect(server).toContain("Asset binário excede o limite de 20 MB");
  });

  test("curadoria manual evita duplicar o mesmo asset no índice automático enquanto a versão não mudou", async () => {
    const desktop = await read("electron-main.ts");

    expect(desktop).toContain("curatedAssetVersions");
    expect(desktop).toContain("curatedMtime");
    expect(desktop).toContain("Math.abs(curatedMtime - asset.mtimeMs) < 1");
  });

  test("destino de gravação usa a taxonomia criada pelo Nisti no Vault ativo sem seletor físico", async () => {
    const knowledge = await read("src/components/AddKnowledgeView.tsx");
    const automation = await read("src/services/obsidianKnowledgeAutomation.ts");
    const api = await read("src/services/api.ts");

    expect(knowledge).toContain("NISTI_KNOWLEDGE_FOLDERS");
    expect(knowledge).toContain("vaultFolders.includes(folder)");
    expect(knowledge).toContain("Pasta real do Obsidian");
    expect(automation).toContain('NISTI_VAULT_ROOT = "Nisti Marketing"');
    expect(api).toContain("ensureNistiRemoteStructure");
    expect(api).not.toContain("inspectDesktopVault");
    expect(knowledge).not.toContain("listVaultFolders");
    expect(knowledge).not.toContain("STANDARD_VAULT_FOLDERS");
  });

  test("UI só recebe a nova nota depois da gravação confirmada", async () => {
    const knowledge = await read("src/components/AddKnowledgeView.tsx");
    const physicalCommitIndex = knowledge.indexOf("window.electronAPI.commitKnowledge");
    const restCommitIndex = knowledge.indexOf("api.pushNoteToObsidian");
    const addIndex = knowledge.indexOf("onAddNote(newNote)");

    expect(physicalCommitIndex).toBeGreaterThan(-1);
    expect(restCommitIndex).toBeGreaterThan(physicalCommitIndex);
    expect(addIndex).toBeGreaterThan(restCommitIndex);
    expect(knowledge).toContain("api.syncObsidianSnapshot");
  });
});
