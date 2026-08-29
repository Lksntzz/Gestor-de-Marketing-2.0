import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { LearningInsight, PostHistoryItem } from "../src/types";
import { buildLearningSnapshot } from "../src/utils/learningIntelligence";

function result(overrides: Partial<PostHistoryItem> = {}): PostHistoryItem {
  return {
    id: overrides.id || "result-1",
    title: overrides.title || "Resultado real",
    channel: overrides.channel || "Instagram",
    format: overrides.format || "carrossel",
    publishedAt: overrides.publishedAt || "2026-08-28T12:00:00.000Z",
    dayOfWeek: overrides.dayOfWeek || "Sexta",
    timeSlot: overrides.timeSlot || "12:00",
    targetNiche: overrides.targetNiche || "empresas_corporativo",
    emotionalDriver: overrides.emotionalDriver || "confianca_autoridade",
    hookUsed: overrides.hookUsed || "Hook registrado",
    metrics: overrides.metrics || {
      impressions: 1000,
      reach: 800,
      likes: 40,
      comments: 4,
      shares: 3,
      saves: 10,
      clicksOrLeads: 12,
      ctrPercent: 2.5,
      conversionRatePercent: 1.2,
    },
    performanceScore: overrides.performanceScore || 50,
    learnings: overrides.learnings || "",
    whatWorked: overrides.whatWorked || [],
    whatToAvoid: overrides.whatToAvoid || [],
    linkedObsidianNote: overrides.linkedObsidianNote,
  };
}

const learning: LearningInsight = {
  id: "learning-1",
  title: "CTA específico",
  category: "copywriting",
  verdict: "EM_TESTE",
  ruleOfThumb: "Testar CTA com ação explícita",
  evidenceData: "Resultado result-1 registrou 12 cliques/leads.",
  suggestedAction: "Repetir em mais duas publicações comparáveis.",
  dateCreated: "2026-08-29",
};

describe("learning intelligence audit", () => {
  test("agrega somente métricas presentes no histórico registrado", () => {
    const snapshot = buildLearningSnapshot([
      result(),
      result({
        id: "result-2",
        publishedAt: "2026-08-29T12:00:00.000Z",
        metrics: {
          impressions: 2000,
          reach: 1200,
          likes: 60,
          comments: 8,
          shares: 5,
          saves: 20,
          clicksOrLeads: 18,
          ctrPercent: 3.5,
          conversionRatePercent: 1.8,
        },
      }),
    ], [learning]);

    expect(snapshot.recordedResults).toBe(2);
    expect(snapshot.reach).toBe(2000);
    expect(snapshot.clicksOrLeads).toBe(30);
    expect(snapshot.averageCtr).toBe(3);
    expect(snapshot.averageConversionRate).toBe(1.5);
    expect(snapshot.latestResults[0].id).toBe("result-2");
    expect(snapshot.learnings[0].id).toBe("learning-1");
  });

  test("ausência de medição permanece ausente e zero explícito continua sendo zero", () => {
    const sparse: PostHistoryItem = {
      id: "sparse",
      title: "Publicação sem analytics",
      channel: "Instagram",
      format: "Reel",
      publishedAt: "2026-08-29T10:00",
      evidenceSource: "https://example.test/post",
    };
    const explicitZero: PostHistoryItem = {
      id: "zero",
      title: "Publicação medida",
      channel: "Instagram",
      format: "Reel",
      publishedAt: "2026-08-29T11:00",
      metrics: { reach: 0, clicksOrLeads: 0 },
    };

    const onlySparse = buildLearningSnapshot([sparse], []);
    expect(onlySparse.reach).toBeNull();
    expect(onlySparse.clicksOrLeads).toBeNull();

    const withZero = buildLearningSnapshot([sparse, explicitZero], []);
    expect(withZero.reach).toBe(0);
    expect(withZero.clicksOrLeads).toBe(0);
  });

  test("tela Aprender registra resultado esparso sem reintroduzir rotinas", async () => {
    const source = await readFile(new URL("../src/components/RoutineIntelligenceView.tsx", import.meta.url), "utf8");
    expect(source).toContain("Aprender");
    expect(source).toContain("Registrar resultado");
    expect(source).toContain("Registrar aprendizado");
    expect(source).toContain("campos não medidos permaneceram ausentes");
    expect(source).toContain("editorialItemId");
    expect(source).toContain('item.status === "PUBLISHED"');
    expect(source).toContain("A data planejada no Calendário não é usada como data real");
    expect(source).not.toContain("Pautas registradas");
    expect(source).not.toContain("Sincronizar semana");
    expect(source).not.toContain("Campanhas abertas");
    expect(source).not.toContain("O que fazer agora");
    expect(source).not.toContain("Adicionar pauta");
    expect(source).not.toContain("Math.random");
  });
});
