import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  compactFolderSummary,
  epistemicState,
  folderInsight,
  noteKeyFacts,
  noteSummary,
  sourceKind,
  visibleFolders,
} from "../src/utils/vaultWorkspace";

function note(overrides: Partial<ObsidianNote> = {}): ObsidianNote {
  return {
    id: "note-1",
    path: "01_Estrategia/Brand.md",
    title: "Brand",
    folder: "01_Estrategia",
    content: "# Brand\n\nPosicionamento confirmado pelo documento fonte.",
    frontmatter: { status: "OFICIAL" },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-27 09:00",
    ...overrides,
  };
}

describe("vault workspace", () => {
  test("classifica tipos de fonte sem depender do nome do arquivo", () => {
    expect(sourceKind(note())).toBe("markdown");
    expect(sourceKind(note({ frontmatter: { source_type: "vault_asset", asset_kind: "pdf" } }))).toBe("pdf");
    expect(sourceKind(note({ frontmatter: { source_type: "vault_asset", asset_kind: "image" } }))).toBe("image");
    expect(sourceKind(note({ frontmatter: { source_type: "vault_asset", asset_kind: "text" } }))).toBe("text");
  });

  test("mapeia estados epistemológicos conservadoramente", () => {
    expect(epistemicState(note({ frontmatter: { status: "OFICIAL" } }))).toBe("CONFIRMADO");
    expect(epistemicState(note({ frontmatter: { epistemic_status: "HIPÓTESE" } }))).toBe("HIPÓTESE");
    expect(epistemicState(note({ frontmatter: { status: "EM REVISÃO" } }))).toBe("PENDENTE");
  });

  test("usa resumo declarado ou seção estruturada antes de truncar o Markdown", () => {
    expect(noteSummary(note({ frontmatter: { summary: "Resumo explícito." } }))).toBe("Resumo explícito.");

    const structured = note({
      frontmatter: {},
      content: "# Documento\n\n## Resumo inteligente\nSíntese gerada e registrada.\n\n## Pontos importantes\n- Fato A",
    });
    expect(noteSummary(structured)).toContain("Síntese gerada e registrada");
  });

  test("não inventa pontos importantes quando a fonte não os estrutura", () => {
    expect(noteKeyFacts(note({ frontmatter: {}, content: "Texto corrido sem seção estruturada." }))).toEqual([]);

    const structured = note({
      frontmatter: {},
      content: "## Pontos importantes\n- Pedido mínimo confirmado pela fonte\n- Prazo registrado na fonte\n\n## Outro bloco\nTexto",
    });
    expect(noteKeyFacts(structured)).toEqual([
      "Pedido mínimo confirmado pela fonte",
      "Prazo registrado na fonte",
    ]);
  });

  test("recolher uma pasta realmente oculta os descendentes", () => {
    const folders = ["01_Estrategia", "01_Estrategia/Marca", "01_Estrategia/Marca/Referencias", "02_Produtos"];
    expect(visibleFolders(folders, { "01_Estrategia": true })).toEqual(["01_Estrategia", "02_Produtos"]);
  });

  test("resumo de pasta é calculado somente a partir das fontes indexadas", () => {
    const insight = folderInsight(
      [
        note(),
        note({
          id: "pdf-1",
          path: "01_Estrategia/pesquisa.pdf",
          title: "Pesquisa",
          frontmatter: { source_type: "vault_asset", asset_kind: "pdf", epistemic_status: "PENDENTE" },
        }),
        note({
          id: "outside",
          path: "02_Produtos/produto.md",
          folder: "02_Produtos",
          title: "Produto",
        }),
      ],
      "01_Estrategia",
    );

    expect(insight.total).toBe(2);
    expect(insight.byKind.markdown).toBe(1);
    expect(insight.byKind.pdf).toBe(1);
    expect(insight.byState.CONFIRMADO).toBe(1);
    expect(insight.byState.PENDENTE).toBe(1);
    expect(compactFolderSummary(insight)).toContain("2 fontes");
    expect(compactFolderSummary(insight)).toContain("1 PDF");
  });
});
