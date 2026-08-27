import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { buildPlanningSnapshot } from "../src/utils/planningIntelligence";
import type { MarketingTask, ObsidianNote, PostHistoryItem } from "../src/types";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("planejamento fundamentado v2 etapa 4", () => {
  test("prioriza tarefa vencida antes de campanha, rotina ou conhecimento", () => {
    const tasks: MarketingTask[] = [
      {
        id: "task-overdue",
        title: "Revisar proposta real",
        priority: "medium",
        status: "todo",
        dueDate: "2026-08-26",
        obsidianTaskString: "- [ ] Revisar proposta real 📅 2026-08-26",
        tags: [],
        isReminderActive: false,
      },
    ];

    const snapshot = buildPlanningSnapshot(
      { tasks, campaigns: [], weeklyRoutine: [], notes: [], postHistory: [], learnings: [] },
      new Date(2026, 7, 27, 10, 0, 0)
    );

    expect(snapshot.nextAction.kind).toBe("task");
    expect(snapshot.nextAction.sourceId).toBe("task-overdue");
    expect(snapshot.nextAction.urgency).toBe("overdue");
  });

  test("métricas usam somente valores presentes no histórico", () => {
    const postHistory: PostHistoryItem[] = [
      {
        id: "post-1",
        title: "Resultado informado",
        channel: "Instagram",
        format: "reels_video",
        publishedAt: "2026-08-26T12:00:00.000Z",
        dayOfWeek: "Quarta",
        timeSlot: "12:00",
        targetNiche: "empresas_corporativo",
        emotionalDriver: "confianca_autoridade",
        hookUsed: "Hook informado",
        metrics: {
          impressions: 1500,
          reach: 1000,
          likes: 50,
          comments: 5,
          shares: 4,
          saves: 20,
          clicksOrLeads: 12,
          ctrPercent: 2.5,
          conversionRatePercent: 1.1,
        },
        performanceScore: 60,
        learnings: "",
        whatWorked: [],
        whatToAvoid: [],
      },
      {
        id: "post-2",
        title: "Segundo resultado informado",
        channel: "LinkedIn",
        format: "carrossel",
        publishedAt: "2026-08-25T12:00:00.000Z",
        dayOfWeek: "Terça",
        timeSlot: "12:00",
        targetNiche: "empresas_corporativo",
        emotionalDriver: "confianca_autoridade",
        hookUsed: "Outro hook informado",
        metrics: {
          impressions: 2500,
          reach: 2000,
          likes: 80,
          comments: 7,
          shares: 6,
          saves: 30,
          clicksOrLeads: 18,
          ctrPercent: 3.5,
          conversionRatePercent: 1.5,
        },
        performanceScore: 70,
        learnings: "",
        whatWorked: [],
        whatToAvoid: [],
      },
    ];

    const snapshot = buildPlanningSnapshot(
      { tasks: [], campaigns: [], weeklyRoutine: [], notes: [], postHistory, learnings: [] },
      new Date(2026, 7, 27)
    );

    expect(snapshot.performance.publishedItems).toBe(2);
    expect(snapshot.performance.reach).toBe(3000);
    expect(snapshot.performance.leads).toBe(30);
    expect(snapshot.performance.averageCtr).toBe(3);
  });

  test("conhecimento pendente nunca é contado como confirmado", () => {
    const notes: ObsidianNote[] = [
      {
        id: "pending",
        path: "00_Inbox/Pendente.md",
        title: "Pendente",
        folder: "00_Inbox",
        content: "Fonte aguardando revisão",
        frontmatter: { status: "EM REVISÃO", epistemic_status: "PENDENTE" },
        tags: [],
        wikilinks: [],
        lastModified: "2026-08-27 10:00",
      },
      {
        id: "confirmed",
        path: "01_Estrategia/Confirmado.md",
        title: "Confirmado",
        folder: "01_Estrategia",
        content: "Fonte confirmada",
        frontmatter: { status: "OFICIAL", epistemic_status: "CONFIRMADO" },
        tags: [],
        wikilinks: [],
        lastModified: "2026-08-27 10:00",
      },
    ];

    const snapshot = buildPlanningSnapshot(
      { tasks: [], campaigns: [], weeklyRoutine: [], notes, postHistory: [], learnings: [] },
      new Date(2026, 7, 27)
    );

    expect(snapshot.confirmedKnowledgeCount).toBe(1);
    expect(snapshot.pendingKnowledge.map((note) => note.id)).toContain("pending");
  });

  test("tela de planejamento não contém métricas aleatórias nem sincronização simulada", async () => {
    const source = await read("src/components/RoutineIntelligenceView.tsx");

    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("mockReach");
    expect(source).not.toContain("↑ 12%");
    expect(source).not.toContain("↑ 18%");
    expect(source).not.toContain("Sincronizado: Agora");
    expect(source).not.toContain("Métricas geradas");
    expect(source).not.toContain("descobrimos uma taxa de cliques muito maior");
    expect(source).not.toContain("bg-stone-900");
  });

  test("aprendizado exige evidência e ação explícitas", async () => {
    const source = await read("src/components/RoutineIntelligenceView.tsx");
    expect(source).toContain("learningEvidence.trim()");
    expect(source).toContain("learningAction.trim()");
    expect(source).not.toContain("Observado em múltiplos testes");
  });
});
