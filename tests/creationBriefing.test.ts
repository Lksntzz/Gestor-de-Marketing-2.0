import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  buildCreationBriefingInstructions,
  creationBriefingBaseStatus,
  normalizeCreationBriefing,
  validateCreationBriefing,
} from "../src/domain/creationBriefing";
import { BASE_ONBOARDING_SECTIONS, canonicalBasePath } from "../src/domain/baseOnboarding";

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

function completeCanonicalBase(): ObsidianNote[] {
  return BASE_ONBOARDING_SECTIONS.map((section) => note(canonicalBasePath(section)));
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

  test("libera o briefing somente quando a Base Inicial canônica está completa e confirmada", () => {
    const complete = completeCanonicalBase();
    expect(creationBriefingBaseStatus(complete)).toEqual({
      ready: true,
      missingDocuments: 0,
      pendingDocuments: 0,
    });

    const missingOne = complete.slice(0, -1);
    expect(creationBriefingBaseStatus(missingOne)).toEqual({
      ready: false,
      missingDocuments: 1,
      pendingDocuments: 0,
    });

    const pendingOne = complete.map((item, index) =>
      index === 0 ? { ...item, frontmatter: { ...item.frontmatter, epistemic_status: "PENDENTE" } } : item,
    );
    expect(creationBriefingBaseStatus(pendingOne)).toEqual({
      ready: false,
      missingDocuments: 0,
      pendingDocuments: 1,
    });
  });

  test("não confunde fontes estratégicas externas com a Base Inicial canônica", () => {
    expect(creationBriefingBaseStatus([
      note("Nisti Marketing/01_Estrategia/Posicionamento.md"),
      note("Nisti Marketing/02_Produtos/Catalogo.md"),
    ])).toEqual({
      ready: false,
      missingDocuments: BASE_ONBOARDING_SECTIONS.length,
      pendingDocuments: 0,
    });
  });
});
