import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  canonicalVaultFolder,
  canonicalVaultPath,
  creativeCommitCandidates,
} from "../src/services/creativeVaultPersistence";

describe("hotfix 3.1.12 — autoridade única de caminhos do Vault", () => {
  test("remove a raiz legada Nisti Marketing sem mudar a pasta canônica", () => {
    expect(canonicalVaultFolder("Nisti Marketing/08_Aprendizados")).toBe("08_Aprendizados");
    expect(canonicalVaultFolder("Nisti Marketing/04_Campanhas")).toBe("04_Campanhas");
    expect(canonicalVaultPath("Nisti Marketing/04_Campanhas/Campanha X.md")).toBe("04_Campanhas/Campanha X.md");
    expect(canonicalVaultPath("vault/Nisti Marketing/08_Aprendizados/Regra.md")).toBe("08_Aprendizados/Regra.md");
  });

  test("corrige aliases criativos legados e mantém fallback somente no pai controlado", () => {
    const assetCandidates = creativeCommitCandidates({
      folder: "02_Conteudo/Ativos",
      title: "Ativo",
      content: "# Ativo",
    });
    expect(assetCandidates.map((item) => item.folder)).toEqual(["03_Conteudos/Ativos", "03_Conteudos"]);

    const copyCandidates = creativeCommitCandidates({
      folder: "02_Conteudo/Copies",
      title: "Copy",
      content: "# Copy",
    });
    expect(copyCandidates.map((item) => item.folder)).toEqual(["03_Conteudos/Copies", "03_Conteudos"]);
  });

  test("não reescreve destinos canônicos arbitrariamente", () => {
    expect(canonicalVaultFolder("00_Base")).toBe("00_Base");
    expect(canonicalVaultFolder("07_Pesquisas/Clientes")).toBe("07_Pesquisas/Clientes");
    expect(creativeCommitCandidates({ folder: "04_Campanhas", title: "C", content: "# C" }))
      .toEqual([{ folder: "04_Campanhas", title: "C", content: "# C" }]);
  });
});

describe("hotfix 3.1.12 — confirmação e atualização imediata do Cofre", () => {
  test("a guarda REST usa caminho canônico, releitura e refresh do snapshot", async () => {
    const source = await readFile(new URL("../src/services/verifiedObsidianWriteGuard.ts", import.meta.url), "utf8");
    expect(source).toContain("canonicalVaultPath(filePath)");
    expect(source).not.toContain("qualifyNistiKnowledgePath(filePath)");
    expect(source).toContain('proxyRequest(config, "GET", targetPath)');
    expect(source).toContain('proxyRequest(config, "PUT", targetPath, payloadMarkdown)');
    expect(source).toContain("await api.syncObsidianSnapshot()");
  });

  test("commit desktop publica snapshot coalescido e o renderer reconcilia o Cofre", async () => {
    const preload = await readFile(new URL("../src/preload.ts", import.meta.url), "utf8");
    const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

    expect(preload).toContain("VAULT_SNAPSHOT_DEBOUNCE_MS");
    expect(preload).toContain("scheduleVaultSnapshotRefresh()");
    expect(preload).toContain("onVaultSnapshot:");
    expect(preload).toContain('ipcRenderer.invoke("notes:read-all")');
    expect(preload).toContain('ipcRenderer.invoke("vault:list-folders")');

    expect(main).toContain("window.electronAPI.onVaultSnapshot");
    expect(main).toContain("publishObsidianSnapshot(");
  });
});
