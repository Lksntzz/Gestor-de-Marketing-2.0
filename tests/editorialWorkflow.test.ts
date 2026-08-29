import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { CreativeScript, EditorialItem, MarketingTask } from "../src/types";
import {
  approvedScriptToEditorialDraft,
  createEmptyEditorialDraft,
  finalizeEditorialDraft,
  normalizeWeeklyPlanSuggestions,
  reconcileEditorialTask,
  removeEditorialTask,
  suggestionToDraft,
} from "../src/utils/editorialWorkflow";

function editorial(overrides: Partial<EditorialItem> = {}): EditorialItem {
  return {
    id: overrides.id || "ed-1",
    title: overrides.title || "Publicação real",
    contentType: overrides.contentType || "Carrossel",
    platform: overrides.platform || "LinkedIn",
    objective: overrides.objective || "Autoridade",
    scheduledDate: overrides.scheduledDate || "2026-08-31",
    scheduledTime: overrides.scheduledTime,
    status: overrides.status || "SCHEDULED",
    priority: overrides.priority || "high",
    ideaId: overrides.ideaId,
    scriptId: overrides.scriptId,
    campaignId: overrides.campaignId,
    obsidianPath: overrides.obsidianPath,
    notes: overrides.notes,
    createdAt: overrides.createdAt || 1,
    updatedAt: overrides.updatedAt || 1,
  };
}

function approvedScript(overrides: Partial<CreativeScript> = {}): CreativeScript {
  return {
    id: "script-1",
    title: "Bastidores aprovados",
    type: "video_reels",
    durationOrSlides: "30s",
    objective: "Mostrar processo",
    targetAudience: "",
    hookScene: "Como fazemos",
    bodyScenes: [],
    callToAction: "Conheça",
    tags: ["workflow:approved"],
    platform: "Instagram",
    format: "Reel",
    sourceIdeaId: "idea-1",
    sourceIdeaTitle: "Bastidores",
    ...overrides,
  };
}

describe("editorial workflow audit", () => {
  test("novo conteúdo nasce sem inventar plataforma, formato, objetivo, data ou prioridade", () => {
    const draft = createEmptyEditorialDraft("ed-new", 10);
    expect(draft.title).toBe("");
    expect(draft.platform).toBe("");
    expect(draft.contentType).toBe("");
    expect(draft.objective).toBe("");
    expect(draft.scheduledDate).toBe("");
    expect(draft.priority).toBe("");
    expect(draft.status).toBe("DRAFT");
  });

  test("conteúdo aprovado entra no editor com vínculo preservado, mas sem inventar data ou prioridade", () => {
    const draft = approvedScriptToEditorialDraft(approvedScript(), "ed-approved", 10);
    expect(draft.title).toBe("Bastidores aprovados");
    expect(draft.platform).toBe("Instagram");
    expect(draft.contentType).toBe("Reel");
    expect(draft.objective).toBe("Mostrar processo");
    expect(draft.ideaId).toBe("idea-1");
    expect(draft.scriptId).toBe("script-1");
    expect(draft.scheduledDate).toBe("");
    expect(draft.scheduledTime).toBe("");
    expect(draft.priority).toBe("");
    expect(draft.status).toBe("DRAFT");
  });

  test("persistência exige escolhas explícitas antes de criar item editorial", () => {
    const draft = createEmptyEditorialDraft("ed-new", 10);
    expect(() => finalizeEditorialDraft(draft, 20)).toThrow("Preencha");

    const explicit = finalizeEditorialDraft({
      ...draft,
      title: "Case institucional",
      contentType: "Artigo",
      platform: "Site",
      objective: "Autoridade",
      scheduledDate: "2026-08-31",
      priority: "high",
    }, 20);

    expect(explicit.platform).toBe("Site");
    expect(explicit.scheduledDate).toBe("2026-08-31");
    expect(explicit.priority).toBe("high");
    expect(explicit.updatedAt).toBe(20);
  });

  test("parser legado de sugestões continua fail-closed e sem prioridade automática", () => {
    const suggestions = normalizeWeeklyPlanSuggestions([
      {
        title: "Tema A",
        platform: "Instagram",
        format: "Reel",
        objective: "Venda",
        date: "2026-08-31",
        time: "18:00",
      },
      {
        title: "Fora da semana",
        platform: "Instagram",
        format: "Reel",
        objective: "Venda",
        date: "2026-09-08",
        time: "18:00",
      },
    ], "2026-08-31");

    expect(suggestions).toHaveLength(1);
    const draft = suggestionToDraft(suggestions[0], "ed-suggestion", 30);
    expect(draft.priority).toBe("");
    expect(draft.status).toBe("DRAFT");
  });

  test("tarefa editorial é reconciliada por inteiro ao alterar calendário", () => {
    const existing: MarketingTask = {
      id: "task-ed-ed-1",
      title: "Publicar: Antigo",
      channel: "Instagram",
      priority: "low",
      status: "in-progress",
      dueDate: "2026-08-30",
      dueTime: "09:00",
      reminderDate: "2026-08-30",
      reminderTime: "08:00",
      obsidianTaskString: "- [ ] Publicar: Antigo 📅 2026-08-30",
      tags: ["editorial"],
      isReminderActive: true,
    };

    const [updated] = reconcileEditorialTask([existing], editorial({
      title: "Novo título",
      platform: "LinkedIn",
      priority: "urgent",
      scheduledDate: "2026-08-31",
      scheduledTime: "14:30",
    }), new Date(2026, 7, 29, 10).getTime());

    expect(updated.title).toBe("Publicar: Novo título");
    expect(updated.channel).toBe("LinkedIn");
    expect(updated.priority).toBe("urgent");
    expect(updated.status).toBe("in-progress");
    expect(updated.dueDate).toBe("2026-08-31");
    expect(updated.dueTime).toBe("14:30");
    expect(updated.reminderDate).toBe("2026-08-31");
    expect(updated.obsidianTaskString).toContain("📅 2026-08-31");
    expect(updated.obsidianTaskString).toContain("⏰ 14:30");
    expect(updated.obsidianTaskString).toContain("🔺");
  });

  test("publicado conclui a tarefa; arquivado ou excluído não deixa tarefa órfã", () => {
    const active = reconcileEditorialTask([], editorial(), new Date(2026, 7, 29).getTime());
    const published = reconcileEditorialTask(active, editorial({ status: "PUBLISHED" }), new Date(2026, 7, 30).getTime());
    expect(published[0].status).toBe("done");
    expect(published[0].completedAt).toBeTruthy();

    const archived = reconcileEditorialTask(published, editorial({ status: "ARCHIVED" }));
    expect(archived).toHaveLength(0);
    expect(removeEditorialTask(active, "ed-1")).toHaveLength(0);
  });

  test("UI semanal consome aprovados de Criar e não oferece geração paralela de pautas", async () => {
    const source = await readFile(new URL("../src/components/EditorialCalendarView.tsx", import.meta.url), "utf8");
    expect(source).toContain("Aprovados aguardando data");
    expect(source).toContain("approvedScriptToEditorialDraft");
    expect(source).toContain('"workflow:approved"');
    expect(source).toContain("Escolher data");
    expect(source).toContain("Item manual");
    expect(source).not.toContain("Gerar sugestões");
    expect(source).not.toContain("generateEditorialPlanSuggestions");
    expect(source).not.toContain('title: "Novo Conteúdo"');
    expect(source).not.toContain('platform: "Instagram"');
    expect(source).not.toContain('objective: "Engajamento"');
    expect(source).not.toContain("toISOString().split(\"T\")[0]");
  });

  test("cliente legado de planejamento continua relativo e descarta fallback sintético", async () => {
    const source = await readFile(new URL("../src/services/editorialPlanningApi.ts", import.meta.url), "utf8");
    expect(source).toContain('fetch("/api/ai/plan-week"');
    expect(source).not.toContain("http://localhost:3000");
    expect(source).toContain("if (data?.wasFallback)");
    expect(source).toContain("data: []");
  });
});
