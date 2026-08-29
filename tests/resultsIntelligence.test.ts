import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildResultsSnapshot,
  deriveCampaignEpistemicStatus,
  normalizeSuggestedTasks,
  resultsForCampaign,
} from "../src/utils/resultsIntelligence";
import type { MarketingCampaign, ObsidianNote, PostHistoryItem } from "../src/types";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const campaign: MarketingCampaign = {
  id: "camp-1",
  title: "Campanha real",
  objective: "Objetivo informado",
  targetAudience: "Público informado",
  tone: "Direto",
  status: "draft",
  channels: ["Instagram"],
  channelsContent: [],
  linkedNotePaths: ["01_Estrategia/Base.md"],
  obsidianOutputNotePath: "04_Campanhas/Campanha real.md",
  summary: "Resumo",
  strategy: "Estratégia",
  startDate: "",
  endDate: "",
  createdDate: "2026-08-27",
};

function result(id: string, reach: number, ctr: number, linkedCampaignId?: string): PostHistoryItem {
  return {
    id,
    title: `Resultado ${id}`,
    channel: "Instagram",
    format: "reels_video",
    publishedAt: "2026-08-27T12:00:00",
    metrics: {
      impressions: reach + 100,
      reach,
      saves: 3,
      clicksOrLeads: 4,
      ctrPercent: ctr,
      conversionRatePercent: 1,
    },
    ...(linkedCampaignId ? { linkedCampaignId } : {}),
  };
}

describe("resultados fundamentados v2 etapa 6", () => {
  test("agrega apenas métricas registradas sem criar tendência ou projeção", () => {
    const snapshot = buildResultsSnapshot([result("a", 1000, 2), result("b", 2000, 4)]);
    expect(snapshot.publications).toBe(2);
    expect(snapshot.reach).toBe(3000);
    expect(snapshot.clicksOrLeads).toBe(8);
    expect(snapshot.averageCtr).toBe(3);
  });

  test("métrica não medida permanece ausente e zero medido permanece zero", () => {
    const sparse: PostHistoryItem = {
      id: "sparse",
      title: "Sem analytics",
      channel: "Instagram",
      format: "Reel",
      publishedAt: "2026-08-27T12:00:00",
    };
    expect(buildResultsSnapshot([sparse]).reach).toBeNull();

    const zero: PostHistoryItem = {
      ...sparse,
      id: "zero",
      metrics: { reach: 0 },
    };
    expect(buildResultsSnapshot([zero]).reach).toBe(0);
  });

  test("resultado é vinculado à campanha somente por referência explícita", () => {
    const linked = result("linked", 900, 1.5, "camp-1");
    const unrelated = result("unrelated", 5000, 6, "camp-2");
    const titleOnly: PostHistoryItem = {
      id: "title-only",
      title: "Outro resultado",
      channel: "Instagram",
      format: "Reel",
      publishedAt: "2026-08-27T12:00:00",
      linkedObsidianNote: campaign.title,
    };
    const notePathLinked: PostHistoryItem = {
      ...titleOnly,
      id: "path-linked",
      linkedObsidianNote: campaign.obsidianOutputNotePath,
    };

    expect(resultsForCampaign(campaign, [linked, unrelated, titleOnly, notePathLinked]).map((item) => item.id)).toEqual([
      "linked",
      "path-linked",
    ]);
  });

  test("campanha gerada nunca vira CONFIRMADO automaticamente", () => {
    const confirmed: ObsidianNote = {
      id: "n1",
      path: "01_Estrategia/Base.md",
      title: "Base",
      folder: "01_Estrategia",
      content: "Fato confirmado",
      frontmatter: { status: "OFICIAL", epistemic_status: "CONFIRMADO" },
      tags: [],
      wikilinks: [],
      lastModified: "2026-08-27 10:00",
    };
    expect(deriveCampaignEpistemicStatus([confirmed], [confirmed.path])).toBe("HIPÓTESE");
  });

  test("tarefas sugeridas não recebem data horário ou lembrete que não vieram da geração", () => {
    const tasks = normalizeSuggestedTasks(
      [{ title: "Revisar peça", priority: "high", obsidianTaskString: "- [ ] Revisar peça" }],
      "camp-1",
      "04_Campanhas/Campanha real.md"
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueDate).toBe("");
    expect(tasks[0].dueTime).toBeUndefined();
    expect(tasks[0].reminderDate).toBeUndefined();
    expect(tasks[0].reminderTime).toBeUndefined();
    expect(tasks[0].isReminderActive).toBe(false);
  });

  test("tarefa sem prioridade explícita é descartada em vez de receber prioridade artificial", () => {
    expect(normalizeSuggestedTasks([{ title: "Sem prioridade" }], "camp-1", "04_Campanhas/Campanha real.md")).toEqual([]);
  });

  test("Campanhas fica focada em briefing grounded e não mistura Resultados ou controles técnicos", async () => {
    const source = await read("src/components/CampaignsView.tsx");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("2026-08-26");
    expect(source).not.toContain("↑ 12%");
    expect(source).not.toContain("startDate: today");
    expect(source).not.toContain("86400000 * 20");
    expect(source).not.toContain("Resultados & Campanhas");
    expect(source).not.toContain("Registrar resultado");
    expect(source).not.toContain("RESULT_METRICS");
    expect(source).not.toContain("PostHistoryItem");
    expect(source).not.toContain("onToggleEngineMode");
    expect(source).not.toContain("setStep(");
    expect(source).not.toContain("onGenerateCampaign");
    expect(source).toContain("Briefing único");
    expect(source).toContain('status: "draft"');
    expect(source).toContain('startDate: ""');
    expect(source).toContain('endDate: ""');
    expect(source).toContain("Nada foi salvo no Vault, agendado ou enviado para Execução automaticamente");
  });
});
