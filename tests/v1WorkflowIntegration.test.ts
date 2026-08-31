import { describe, expect, test } from "bun:test";
import type { CreativeScript, IdeaItem, ObsidianNote } from "../src/types";
import {
  creationBriefingBaseStatus,
  validateCreationBriefing,
} from "../src/domain/creationBriefing";
import { buildCreativeLibrary } from "../src/domain/creativeLibrary";
import {
  approvedScriptToEditorialDraft,
  finalizeEditorialDraft,
  reconcileEditorialTask,
} from "../src/utils/editorialWorkflow";

function confirmedKnowledgeNotes(): ObsidianNote[] {
  return [
    {
      id: "strategy-positioning",
      path: "Nisti Marketing/01_Estrategia/Posicionamento.md",
      title: "Posicionamento",
      folder: "Nisti Marketing/01_Estrategia",
      content: "# Posicionamento\n\nDiretrizes confirmadas pelo usuário.",
      frontmatter: {
        tipo: "Estratégia",
        status: "OFICIAL",
        epistemic_status: "CONFIRMADO",
      },
      tags: ["estrategia"],
      wikilinks: [],
      lastModified: "2026-08-31 18:00",
    },
    {
      id: "product-catalog",
      path: "Nisti Marketing/02_Produtos/Catalogo.md",
      title: "Catálogo",
      folder: "Nisti Marketing/02_Produtos",
      content: "# Catálogo\n\nInformações confirmadas sobre o produto.",
      frontmatter: {
        tipo: "Produto",
        status: "OFICIAL",
        epistemic_status: "CONFIRMADO",
      },
      tags: ["produto"],
      wikilinks: [],
      lastModified: "2026-08-31 18:00",
    },
  ];
}

describe("v1 marketing workflow integration", () => {
  test("Conhecimento → Briefing → Ideia → Aprovado → Planejado → Publicado preserva fontes de verdade", () => {
    const notes = confirmedKnowledgeNotes();
    expect(creationBriefingBaseStatus(notes)).toEqual({
      ready: true,
      missingDocuments: 0,
      pendingDocuments: 0,
    });

    const briefing = {
      objective: "Mostrar um processo real",
      format: "Reel",
      channel: "Instagram",
      theme: "Bastidores",
      instructions: "Não mencionar preço.",
    };
    expect(validateCreationBriefing(briefing).valid).toBe(true);

    const idea: IdeaItem = {
      id: "idea-v1",
      title: "Bastidores reais",
      status: "ideia",
      targetPersona: "",
      hook: "Como esta etapa acontece?",
      tags: [],
      format: briefing.format,
      channel: briefing.channel,
      objective: briefing.objective,
      concept: "Mostrar uma etapa documentada do processo",
      keyMessage: "O processo pode ser demonstrado com evidência real",
      callToAction: "Conheça o processo",
    };

    expect(buildCreativeLibrary([idea], [], [])[0]?.status).toBe("idea");

    const script: CreativeScript = {
      id: "script-v1",
      title: "Roteiro — Bastidores reais",
      type: "video_reels",
      durationOrSlides: "30s",
      objective: briefing.objective,
      targetAudience: "",
      hookScene: idea.hook,
      bodyScenes: [],
      callToAction: idea.callToAction || "",
      tags: ["workflow:approved"],
      platform: briefing.channel,
      format: briefing.format,
      sourceIdeaId: idea.id,
      sourceIdeaTitle: idea.title,
    };

    expect(buildCreativeLibrary([idea], [script], [])[0]?.status).toBe("approved");

    const planningDraft = approvedScriptToEditorialDraft(script, "ed-v1", 1000);
    expect(planningDraft.scriptId).toBe(script.id);
    expect(planningDraft.ideaId).toBe(idea.id);
    expect(planningDraft.scheduledDate).toBe("");
    expect(planningDraft.priority).toBe("");
    expect(() => finalizeEditorialDraft(planningDraft, 1100)).toThrow("Preencha");

    const scheduled = finalizeEditorialDraft({
      ...planningDraft,
      scheduledDate: "2026-09-01",
      scheduledTime: "10:30",
      priority: "high",
      status: "SCHEDULED",
    }, 1200);

    expect(scheduled.scriptId).toBe(script.id);
    expect(scheduled.ideaId).toBe(idea.id);
    expect(buildCreativeLibrary([idea], [script], [scheduled])[0]?.status).toBe("planned");

    const execution = reconcileEditorialTask([], scheduled, 1300);
    expect(execution).toHaveLength(1);
    expect(execution[0]?.id).toBe("task-ed-ed-v1");
    expect(execution[0]?.title).toBe("Publicar: Roteiro — Bastidores reais");
    expect(execution[0]?.dueDate).toBe("2026-09-01");
    expect(execution[0]?.dueTime).toBe("10:30");
    expect(execution[0]?.priority).toBe("high");
    expect(execution[0]?.status).toBe("todo");

    const published = {
      ...scheduled,
      status: "PUBLISHED" as const,
      updatedAt: 1400,
    };
    const completed = reconcileEditorialTask(execution, published, 1500);
    expect(completed[0]?.status).toBe("done");
    expect(completed[0]?.completedAt).toBeTruthy();

    expect(script.tags).toContain("workflow:approved");
    expect(notes.every((note) => note.frontmatter.epistemic_status === "CONFIRMADO")).toBe(true);
  });
});
