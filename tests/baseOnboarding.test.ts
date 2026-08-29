import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  BASE_FOLDER,
  BASE_ONBOARDING_SECTIONS,
  aggregateEpistemicStatus,
  assessBaseReadiness,
  buildBaseDocumentPlans,
  canonicalBasePath,
  collectPendingQuestions,
  createEmptyBaseOnboardingDraft,
  type BaseOnboardingDraft,
} from "../src/domain/baseOnboarding";

function note(path: string, epistemicStatus: string = "CONFIRMADO"): ObsidianNote {
  const title = path.split("/").pop()?.replace(/\.md$/i, "") || path;
  return {
    id: `note-${title}`,
    path,
    title,
    folder: path.split("/").slice(0, -1).join("/") || "00_Inbox",
    content: `# ${title}`,
    frontmatter: { epistemic_status: epistemicStatus },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-28 12:00",
  };
}

function completeDraft(): BaseOnboardingDraft {
  const draft = createEmptyBaseOnboardingDraft(new Date("2026-08-28T12:00:00-03:00"));
  for (const section of BASE_ONBOARDING_SECTIONS) {
    for (const question of section.questions) {
      draft.answers[question.id] = {
        value: `Resposta real para ${question.label}`,
        status: "CONFIRMADO",
      };
    }
  }
  return draft;
}

describe("onboarding da Base Inicial", () => {
  test("usa caminhos canônicos em 00_Base e não considera nota arbitrária equivalente", () => {
    expect(BASE_FOLDER).toBe("00_Base");
    expect(canonicalBasePath(BASE_ONBOARDING_SECTIONS[0])).toBe("00_Base/Empresa.md");

    const readiness = assessBaseReadiness([
      note("01_Estrategia/Empresa.md"),
    ]);
    expect(readiness.missingSectionIds).toContain("empresa");
  });

  test("Base só fica completa quando todos os documentos canônicos existem e estão CONFIRMADO", () => {
    const confirmed = BASE_ONBOARDING_SECTIONS.map((section) => note(canonicalBasePath(section)));
    const missing = assessBaseReadiness(confirmed.slice(1));
    expect(missing.complete).toBe(false);
    expect(missing.missingSectionIds).toEqual(["empresa"]);

    const pending = assessBaseReadiness([
      ...confirmed.slice(0, -1),
      note(canonicalBasePath(BASE_ONBOARDING_SECTIONS.at(-1)!), "PENDENTE"),
    ]);
    expect(pending.complete).toBe(false);
    expect(pending.pendingPaths).toHaveLength(1);

    const complete = assessBaseReadiness(confirmed);
    expect(complete.complete).toBe(true);
  });

  test("estado epistemológico agregado nunca promove ausência ou pendência a confirmado", () => {
    expect(aggregateEpistemicStatus([])).toBe("PENDENTE");
    expect(aggregateEpistemicStatus([{ value: "", status: "CONFIRMADO" }])).toBe("PENDENTE");
    expect(aggregateEpistemicStatus([{ value: "Dado", status: "PENDENTE" }])).toBe("PENDENTE");
    expect(aggregateEpistemicStatus([{ value: "Dado", status: "HIPÓTESE" }])).toBe("HIPÓTESE");
    expect(aggregateEpistemicStatus([{ value: "Dado", status: "CONFIRMADO" }])).toBe("CONFIRMADO");
  });

  test("Markdown preserva estado por resposta e explicita informação ausente", () => {
    const draft = createEmptyBaseOnboardingDraft(new Date("2026-08-28T12:00:00-03:00"));
    const empresa = BASE_ONBOARDING_SECTIONS.find((section) => section.id === "empresa")!;
    draft.answers[empresa.questions[0].id] = { value: "Nisti Print", status: "CONFIRMADO" };
    draft.answers[empresa.questions[1].id] = { value: "Atende impressão sob demanda", status: "HIPÓTESE" };

    const plan = buildBaseDocumentPlans(draft, [], new Date(2026, 7, 28)).find((item) => item.sectionId === "empresa")!;
    expect(plan.epistemicStatus).toBe("PENDENTE");
    expect(plan.content).toContain("**Estado:** CONFIRMADO");
    expect(plan.content).toContain("**Estado:** HIPÓTESE");
    expect(plan.content).toContain("PENDENTE — informação ainda não fornecida.");
    expect(plan.frontmatter.epistemic_status).toBe("PENDENTE");
    expect(plan.frontmatter.status).toBe("EM REVISÃO");
  });

  test("não gera plano para documento canônico já existente", () => {
    const draft = completeDraft();
    const existing = [note("00_Base/Empresa.md")];
    const plans = buildBaseDocumentPlans(draft, existing, new Date(2026, 7, 28));
    expect(plans.some((plan) => plan.path === "00_Base/Empresa.md")).toBe(false);
    expect(plans.some((plan) => plan.path === "00_Base/Publico.md")).toBe(true);
  });

  test("Pendencias.md é derivado somente de respostas vazias ou marcadas PENDENTE", () => {
    const draft = completeDraft();
    const firstQuestion = BASE_ONBOARDING_SECTIONS[0].questions[0];
    draft.answers[firstQuestion.id] = { value: "Nisti Print", status: "PENDENTE" };
    const pending = collectPendingQuestions(draft);
    expect(pending).toEqual([{ sectionTitle: "Empresa", questionLabel: firstQuestion.label }]);

    const pendingPlan = buildBaseDocumentPlans(draft, [], new Date(2026, 7, 28)).find((item) => item.sectionId === "pendencias")!;
    expect(pendingPlan.content).toContain(firstQuestion.label);
    expect(pendingPlan.epistemicStatus).toBe("PENDENTE");
  });

  test("onboarding completo gera nove documentos de base mais Pendencias sem conteúdo sintético", () => {
    const plans = buildBaseDocumentPlans(completeDraft(), [], new Date(2026, 7, 28));
    expect(plans).toHaveLength(BASE_ONBOARDING_SECTIONS.length + 1);
    expect(plans.every((plan) => plan.path.startsWith("00_Base/"))).toBe(true);
    expect(plans.find((plan) => plan.sectionId === "pendencias")?.epistemicStatus).toBe("CONFIRMADO");
    expect(plans.map((plan) => plan.content).join("\n")).not.toContain("Math.random");
  });
});
