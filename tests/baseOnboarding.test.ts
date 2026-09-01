import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { ObsidianNote } from "../src/types";
import {
  BASE_ONBOARDING_SECTIONS,
  assessBaseReadiness,
  buildBaseDocumentPlans,
  canonicalBasePath,
  countUnreviewedBaseAnswers,
  createEmptyBaseOnboardingDraft,
} from "../src/domain/baseOnboarding";

function canonicalNote(path: string, epistemicStatus: string): ObsidianNote {
  const title = path.split("/").pop()?.replace(/\.md$/i, "") || "Nota";
  return {
    id: `note-${title}`,
    path,
    title,
    folder: "00_Base",
    content: `# ${title}`,
    frontmatter: { epistemic_status: epistemicStatus },
    tags: [],
    wikilinks: [],
    lastModified: "2026-09-01 12:00",
  };
}

describe("Base Inicial onboarding 3.1.8", () => {
  test("document builder canônico permanece disponível", async () => {
    const domain = await readFile(new URL("../src/domain/baseOnboarding.ts", import.meta.url), "utf8");
    expect(domain).toContain("BASE_ONBOARDING_SECTIONS");
    expect(domain).toContain("buildBaseDocumentPlans");
    expect(domain).toContain("assessBaseReadiness");
    expect(domain).toContain("structurallyComplete");
    expect(domain).toContain("countUnreviewedBaseAnswers");
  });

  test("fluxo ativo exige Base canônica e expõe o onboarding antes do App", async () => {
    const [main, briefing, gate] = await Promise.all([
      readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/domain/creationBriefing.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/components/BaseInitialGate.tsx", import.meta.url), "utf8"),
    ]);

    expect(main).toContain("BaseInitialGate");
    expect(main).toContain("<BaseInitialGate>");
    expect(briefing).toContain("assessBaseReadiness");
    expect(briefing).toContain("readiness.structurallyComplete");
    expect(briefing).not.toContain("assessSmartKnowledgeReadiness");
    expect(gate).toContain("Onboarding da Base Inicial");
    expect(gate).toContain("Gravar e verificar Base Inicial");
    expect(gate).toContain("syncWebObsidianNotes");
    expect(gate).toContain("countUnreviewedBaseAnswers");
    expect(gate).not.toContain('answer.status !== "CONFIRMADO"');
  });

  test("PENDENTE revisado não obriga confirmação falsa", () => {
    const draft = createEmptyBaseOnboardingDraft(new Date("2026-09-01T12:00:00-03:00"));
    const totalQuestions = BASE_ONBOARDING_SECTIONS.reduce((total, section) => total + section.questions.length, 0);
    expect(countUnreviewedBaseAnswers(draft)).toBe(totalQuestions);

    for (const section of BASE_ONBOARDING_SECTIONS) {
      for (const question of section.questions) {
        draft.answers[question.id] = { value: "", status: "PENDENTE" };
      }
    }

    expect(countUnreviewedBaseAnswers(draft)).toBe(0);
    const plans = buildBaseDocumentPlans(draft, [], new Date("2026-09-01T12:00:00-03:00"));
    expect(plans).toHaveLength(BASE_ONBOARDING_SECTIONS.length + 1);
    expect(plans.filter((plan) => plan.sectionId !== "pendencias").every((plan) => plan.epistemicStatus === "PENDENTE")).toBe(true);
    expect(plans.find((plan) => plan.sectionId === "pendencias")?.path).toBe("00_Base/Pendencias.md");
  });

  test("conclusão estrutural é independente de confirmação epistemológica", () => {
    const notes = BASE_ONBOARDING_SECTIONS.map((section, index) =>
      canonicalNote(canonicalBasePath(section), index === 0 ? "PENDENTE" : index === 1 ? "HIPÓTESE" : "CONFIRMADO"),
    );

    const readiness = assessBaseReadiness(notes);
    expect(readiness.missingSectionIds).toEqual([]);
    expect(readiness.structurallyComplete).toBe(true);
    expect(readiness.complete).toBe(false);
    expect(readiness.pendingPaths).toHaveLength(2);
  });
});
