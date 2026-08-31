import { describe, expect, test } from "bun:test";
import type { ObsidianNote } from "../src/types";
import {
  AI_TRIAGE_CONFIDENCE,
  assessSmartKnowledgeReadiness,
  hasMeaningfulSocialMetrics,
  normalizeAiTriageCandidate,
  parseSocialPerformanceText,
  preferredPlanningSourcePaths,
  socialPerformanceFrontmatter,
} from "../src/domain/smartKnowledgeStage2";
import { classifyKnowledgeForVault } from "../src/services/obsidianKnowledgeAutomation";

function note(path: string, status: string = "CONFIRMADO"): ObsidianNote {
  const title = path.split("/").pop()?.replace(/\.md$/i, "") || path;
  return {
    id: path,
    path,
    title,
    folder: path.split("/").slice(0, -1).join("/"),
    content: `# ${title}\nConteúdo real registrado.`,
    frontmatter: { epistemic_status: status },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-31 18:00",
  };
}

describe("Smart Knowledge Stage 2", () => {
  test("AI triage only accepts high-confidence canonical folders", () => {
    const deterministic = classifyKnowledgeForVault({
      title: "Anotação genérica",
      content: "Uma informação ainda ambígua.",
      frontmatter: {},
      tags: [],
    });
    expect(normalizeAiTriageCandidate({
      folder: "03_Conteudos",
      confidence: AI_TRIAGE_CONFIDENCE,
      reason: "O texto descreve explicitamente uma pauta de conteúdo.",
    }, deterministic)).toEqual({
      folder: "Nisti Marketing/03_Conteudos",
      confidence: AI_TRIAGE_CONFIDENCE,
      reason: "O texto descreve explicitamente uma pauta de conteúdo.",
    });
    expect(normalizeAiTriageCandidate({
      folder: "03_Conteudos",
      confidence: 0.72,
      reason: "Confiança insuficiente.",
    }, deterministic)).toBeNull();
    expect(normalizeAiTriageCandidate({
      folder: "00_Inbox",
      confidence: 0.99,
      reason: "Não há classificação segura.",
    }, deterministic)).toBeNull();
  });

  test("parses Instagram metrics without converting absent fields to zero", () => {
    const metrics = parseSocialPerformanceText(`
Instagram Insights
Alcance: 28.000
Impressões: 35,4k
Curtidas: 1.240
Comentários: 81
Compartilhamentos: 430
Salvamentos: 870
CTR: 2,8%
`);
    expect(metrics.platform).toBe("instagram");
    expect(metrics.reach).toBe(28000);
    expect(metrics.impressions).toBe(35400);
    expect(metrics.saves).toBe(870);
    expect(metrics.ctrPercent).toBe(2.8);
    expect(metrics.conversionRatePercent).toBeUndefined();
    expect(hasMeaningfulSocialMetrics(metrics)).toBe(true);
    expect(socialPerformanceFrontmatter(metrics)).toMatchObject({
      social_platform: "instagram",
      metric_source: "observed",
      metric_reach: 28000,
      metric_saves: 870,
    });
  });

  test("parses TikTok views and engagement evidence", () => {
    const metrics = parseSocialPerformanceText(`
TikTok Analytics
Visualizações: 125k
Curtidas: 8.500
Comentários: 620
Compartilhamentos: 1.2k
Taxa de engajamento: 8,4%
`);
    expect(metrics.platform).toBe("tiktok");
    expect(metrics.views).toBe(125000);
    expect(metrics.shares).toBe(1200);
    expect(metrics.engagementRatePercent).toBe(8.4);
  });

  test("planning readiness comes from real managed knowledge, not fabricated 00_Base documents", () => {
    const empty = assessSmartKnowledgeReadiness([]);
    expect(empty.ready).toBe(false);

    const onlyInbox = assessSmartKnowledgeReadiness([
      note("Nisti Marketing/00_Inbox/Captura.md", "PENDENTE"),
    ]);
    expect(onlyInbox.ready).toBe(false);

    const realKnowledge = [
      note("Nisti Marketing/01_Estrategia/Posicionamento.md"),
      note("Nisti Marketing/02_Produtos/Planner.md"),
      note("Nisti Marketing/08_Aprendizados/Reels Agosto.md", "HIPÓTESE"),
    ];
    expect(assessSmartKnowledgeReadiness(realKnowledge)).toMatchObject({
      ready: true,
      usableSources: 3,
      strategicSources: 3,
    });
    expect(preferredPlanningSourcePaths(realKnowledge)).toHaveLength(3);
  });
});
