import { describe, expect, it } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  KnowledgeContextService,
  relativeVaultPath,
} from "../src/services/knowledge/KnowledgeContextService";

function note(path: string, content: string, frontmatter: Record<string, unknown> = {}): ObsidianNote {
  return {
    id: path,
    path,
    title: path.split("/").pop()?.replace(/\.md$/i, "") || path,
    folder: path.split("/").slice(0, -1).join("/"),
    content,
    frontmatter,
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-31T20:00:00.000Z",
    syncedWithApi: true,
  };
}

describe("canonical Base knowledge context", () => {
  it("keeps 00_Base as a canonical Vault-relative path", () => {
    expect(relativeVaultPath("C:/Vault/Nisti/00_Base/Produtos.md")).toBe("00_Base/Produtos.md");
  });

  it("selects confirmed Base knowledge for creation requests", () => {
    const service = new KnowledgeContextService();
    const selection = service.select({
      query: "caderno personalizado produto público corporativo",
      notes: [
        note(
          "00_Base/Produtos.md",
          "Caderno personalizado com capa dura para kits corporativos.",
          { epistemic_status: "CONFIRMADO", tags: ["produto", "corporativo"] },
        ),
        note("00_Inbox/Rascunho.md", "Assunto sem relação com o pedido.", { epistemic_status: "PENDENTE" }),
      ],
    });

    expect(selection.sources.length).toBeGreaterThan(0);
    expect(selection.sources[0]?.path).toBe("00_Base/Produtos.md");
    expect(selection.sources[0]?.epistemicStatus).toBe("CONFIRMADO");
    expect(selection.sources[0]?.content).toContain("Caderno personalizado");
  });
});
