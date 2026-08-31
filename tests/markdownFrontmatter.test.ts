import { describe, expect, it } from "bun:test";
import {
  normalizeFrontmatterTags,
  parseMarkdownDocument,
  parseObsidianFrontmatter,
} from "../src/utils/markdownFrontmatter";

describe("Obsidian frontmatter parser", () => {
  it("parses scalars, quoted colons and inline arrays", () => {
    const parsed = parseMarkdownDocument(`---\ntitle: "Oferta: Volta às aulas"\npublished: true\nscore: 12.5\ntags: [instagram, "volta às aulas"]\n---\n# Corpo`);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.frontmatter.title).toBe("Oferta: Volta às aulas");
    expect(parsed.frontmatter.published).toBe(true);
    expect(parsed.frontmatter.score).toBe(12.5);
    expect(parsed.frontmatter.tags).toEqual(["instagram", "volta às aulas"]);
    expect(parsed.body).toBe("# Corpo");
  });

  it("parses block tag lists and nested objects", () => {
    const frontmatter = parseObsidianFrontmatter(`tags:\n  - instagram\n  - reels\nproduto:\n  nome: Caderno\n  atributos:\n    - capa dura\n    - personalizado\n`);

    expect(frontmatter.tags).toEqual(["instagram", "reels"]);
    expect(frontmatter.produto).toEqual({
      nome: "Caderno",
      atributos: ["capa dura", "personalizado"],
    });
    expect(normalizeFrontmatterTags(frontmatter.tags)).toEqual(["instagram", "reels"]);
  });

  it("supports CRLF and multiline block scalars", () => {
    const parsed = parseMarkdownDocument("---\r\nresumo: |\r\n  Primeira linha\r\n  Segunda linha\r\ndescricao: >\r\n  texto dobrado\r\n  em uma frase\r\n---\r\nConteúdo");

    expect(parsed.frontmatter.resumo).toBe("Primeira linha\nSegunda linha");
    expect(parsed.frontmatter.descricao).toBe("texto dobrado em uma frase");
    expect(parsed.body).toBe("Conteúdo");
  });

  it("keeps documents without frontmatter untouched", () => {
    const source = "# Nota\n\nConteúdo normal";
    expect(parseMarkdownDocument(source)).toEqual({
      frontmatter: {},
      body: source,
      hasFrontmatter: false,
    });
  });

  it("fails safely on malformed frontmatter instead of dropping the note body", () => {
    const parsed = parseMarkdownDocument(`---\ntags:\n  - valido\nlinha quebrada sem dois pontos\n---\nTexto preservado`);
    expect(parsed.body).toBe("Texto preservado");
    expect(parsed.frontmatter.tags).toEqual(["valido"]);
  });

  it("normalizes legacy comma-separated tags", () => {
    expect(normalizeFrontmatterTags("instagram, reels; campanha\nlocal")).toEqual([
      "instagram",
      "reels",
      "campanha",
      "local",
    ]);
  });
});
