import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  buildCreationBriefingInstructions,
  creationBriefingBaseStatus,
  normalizeCreationBriefing,
  validateCreationBriefing,
} from "../src/domain/creationBriefing";

function note(path: string, epistemicStatus = "CONFIRMADO"): ObsidianNote {
  const title = path.split("/").pop()?.replace(/\.md$/i, "") || "Nota";
  return {
    id: `note-${title}`,
    path,
    title,
    folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "00_Inbox",
    content: `# ${title}`,
    frontmatter: { epistemic_status: epistemicStatus },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-31 18:00",
  };
}

describe("creation briefing", () => {
  test("exige somente decisões explícitas mínimas e não inventa defaults", () => {
    const normalized = normalizeCreationBriefing({});
    expect(normalized).toEqual({
      objective: "",
      format: "",
      channel: "",
      theme: "",
      instructions: "",
    });

    const validation = validateCreationBriefing({ objective: "Gerar demanda" });
    expect(validation.valid).toBe(false);
    expect(validation.missing).toEqual(["format", "channel"]);
  });

  test("mantém tema e restrições somente quando o usuário informou", () => {
    expect(buildCreationBriefingInstructions({
      objective: "Apresentar produto",
      format: "Reel",
      channel: "Instagram",
    })).toBe("");

    const instructions = buildCreationBriefingInstructions({
      objective: "Apresentar produto",
      format: "Reel",
      channel: "Instagram",
      theme: "Bastidores da produção",
      instructions: "Não mencionar preço.",
    });
    expect(instructions).toContain("Bastidores da produção");
    expect(instructions).toContain("Não mencionar preço.");
    expect(instructions).not.toContain("Engajamento");
  });

  test("libera o briefing com conhecimento estratégico real e não com 00_Base fabricada", () => {
    expect(creationBriefingBaseStatus([note("00_Base/Empresa.md")])).toEqual({
      ready: false,
      missingDocuments: 1,
      pendingDocuments: 0,
    });

    expect(creationBriefingBaseStatus([
      note("Nisti Marketing/01_Estrategia/Posicionamento.md"),
      note("Nisti Marketing/02_Produtos/Catalogo.md"),
    ])).toEqual({
      ready: true,
      missingDocuments: 0,
      pendingDocuments: 0,
    });

    expect(creationBriefingBaseStatus([
      note("Nisti Marketing/01_Estrategia/Posicionamento.md", "PENDENTE"),
    ])).toEqual({
      ready: false,
      missingDocuments: 1,
      pendingDocuments: 1,
    });
  });
});
