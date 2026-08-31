import { describe, expect, test } from "bun:test";
import { buildWorkspaceBackup, parseWorkspaceImport } from "../src/domain/appStateSchemas";

const note = {
  id: "note-1",
  path: "00_Inbox/Teste.md",
  title: "Teste",
  folder: "00_Inbox",
  content: "# Teste",
  frontmatter: { status: "OFICIAL", epistemic_status: "CONFIRMADO" },
  tags: ["teste"],
  wikilinks: [],
  lastModified: "2026-08-28 10:00",
};

const campaign = {
  id: "camp-1",
  title: "Campanha",
  objective: "Validar",
  targetAudience: "Clientes",
  tone: "Profissional",
  status: "active" as const,
  channels: ["Instagram"],
  channelsContent: [],
  linkedNotePaths: [note.path],
  summary: "Resumo",
  strategy: "Estratégia",
  startDate: "2026-08-28",
  endDate: "2026-09-01",
  createdDate: "2026-08-28",
};

const task = {
  id: "task-1",
  title: "Publicar conteúdo",
  priority: "high" as const,
  status: "todo" as const,
  dueDate: "2026-08-29",
  obsidianTaskString: "- [ ] Publicar conteúdo",
  tags: ["marketing"],
  isReminderActive: false,
};

const activeAIConnection = {
  schemaVersion: 1 as const,
  status: "CONEXAO_ATIVA" as const,
  connectionId: "conn-local",
  provider: "openai" as const,
  model: "gpt-test",
  secretRef: "active:aiConnectionKey" as const,
  capabilities: ["structured_output"],
  credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
  modelConfirmedAt: "2026-08-31T00:01:00.000Z",
};

describe("workspace backup v2", () => {
  test("preserves product state and secret-free AI metadata while stripping credentials", () => {
    const backup = buildWorkspaceBackup({
      version: "2.1.11",
      exportedAt: "2026-08-28T20:00:00.000Z",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
      automationRules: [{
        id: "rule_daily_sync",
        name: "Daily",
        description: "Legacy state kept for migration",
        trigger: "daily_schedule",
        action: "create_tasks_in_daily_note",
        enabled: false,
        executionCount: 2,
      }],
      ideas: [],
      scripts: [],
      visuals: [],
      emotionalDrivers: [],
      niches: [],
      postHistory: [],
      learnings: [{
        id: "learn-1",
        title: "Aprendizado",
        category: "formato",
        verdict: "EM_TESTE",
        ruleOfThumb: "Testar novamente",
        evidenceData: "Publicação 1",
        suggestedAction: "Repetir teste",
        dateCreated: "2026-08-28",
      }],
      weeklyRoutine: [{
        id: "slot-1",
        dayOfWeek: "Segunda",
        focusTheme: "Tema legado",
        primaryEmotion: "curiosidade",
        primaryNiche: "empresas_corporativo",
        recommendedFormat: "carrossel",
        optimalTime: "09:00",
        suggestedHookPattern: "Gancho",
        plannedAction: "Publicar",
        status: "planejando",
      }],
      engineMode: "local",
      editorialItems: [{
        id: "ed-1",
        title: "Conteúdo editorial",
        contentType: "Carrossel",
        platform: "Instagram",
        objective: "Autoridade",
        scheduledDate: "2026-08-31",
        status: "APPROVED",
        priority: "medium",
        campaignId: "camp-1",
        createdAt: 1,
        updatedAt: 2,
      }],
      apiConfig: {
        endpoint: "https://127.0.0.1:27124",
        vaultName: "MarketingVault",
        aiProvider: "openai",
        aiModel: "gpt-test",
        aiConnection: activeAIConnection,
        connectionStatus: "connected",
        apiKey: "obsidian-secret",
        geminiApiKey: "gemini-secret",
        openaiApiKey: "openai-secret",
      },
    });

    expect(backup.formatVersion).toBe(2);
    expect(backup.version).toBe("2.1.11");
    expect(backup.exportedAt).toBe("2026-08-28T20:00:00.000Z");
    expect(backup.automationRules).toHaveLength(1);
    expect(backup.weeklyRoutine).toHaveLength(1);
    expect(backup.editorialItems).toHaveLength(1);
    expect(backup.learnings).toHaveLength(1);
    expect(backup.engineMode).toBe("local");
    expect(backup.apiConfig?.connectionStatus).toBe("disconnected");
    expect(backup.apiConfig?.aiConnection).toEqual(activeAIConnection);
    expect((backup.apiConfig as Record<string, unknown>).apiKey).toBeUndefined();
    expect((backup.apiConfig as Record<string, unknown>).geminiApiKey).toBeUndefined();
    expect((backup.apiConfig as Record<string, unknown>).openaiApiKey).toBeUndefined();
  });

  test("keeps legacy backups importable without fabricating missing collections or AI connection metadata", () => {
    const parsed = parseWorkspaceImport({
      version: "2.1.7",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
    });

    expect(parsed.notes).toHaveLength(1);
    expect(parsed.automationRules).toBeUndefined();
    expect(parsed.weeklyRoutine).toBeUndefined();
    expect(parsed.editorialItems).toBeUndefined();
    expect(parsed.apiConfig).toBeUndefined();
  });

  test("rejects raw secret fields inside AI connection metadata", () => {
    expect(() => parseWorkspaceImport({
      version: "2.2.1",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
      apiConfig: {
        aiConnection: {
          ...activeAIConnection,
          apiKey: "must-never-enter-backup",
        },
      },
    })).toThrow();
  });

  test("round-trips valid AI metadata without adding trust or secret fields", () => {
    const parsed = parseWorkspaceImport({
      version: "2.2.1",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
      apiConfig: {
        aiProvider: "openai",
        aiModel: "gpt-test",
        aiConnection: activeAIConnection,
      },
    });

    expect(parsed.apiConfig?.aiConnection).toEqual(activeAIConnection);
    expect(Object.keys(parsed.apiConfig?.aiConnection || {})).not.toContain("apiKey");
  });

  test("rejects unsupported future backup formats fail-closed", () => {
    expect(() => parseWorkspaceImport({
      formatVersion: 3,
      version: "9.0.0",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
    })).toThrow();
  });
});
