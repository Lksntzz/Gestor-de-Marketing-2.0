import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  BASE_ONBOARDING_SECTIONS,
  canonicalBasePath,
} from "../src/domain/baseOnboarding";
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
    lastModified: "2026-08-29 09:00",
  };
}

function confirmedBase(): ObsidianNote[] {
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

  test("só libera o briefing quando a Base Inicial canônica está pronta", () => {
    expect(creationBriefingBaseStatus([note("00_Inbox/solta.md")])).toEqual({
      ready: false,
      missingDocuments: 9,
      pendingDocuments: 0,
    });

    expect(creationBriefingBaseStatus(confirmedBase())).toEqual({
      ready: true,
      missingDocuments: 0,
      pendingDocuments: 0,
    });

    const pending = confirmedBase();
    pending[0] = note(pending[0].path, "HIPÓTESE");
    expect(creationBriefingBaseStatus(pending)).toEqual({
      ready: false,
      missingDocuments: 0,
      pendingDocuments: 1,
    });
  });
});
