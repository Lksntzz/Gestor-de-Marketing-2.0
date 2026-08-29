import { describe, expect, test } from "bun:test";
import type {
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
} from "../src/types";
import {
  buildDashboardActivity,
  buildDashboardBlockers,
  computeDashboardMetrics,
  selectPriorityAction,
} from "../src/utils/dashboardIntelligence";

const connectedConfig: ObsidianApiConfig = {
  endpoint: "http://127.0.0.1:27124",
  apiKey: "",
  vaultName: "MarketingVault",
  useHttps: false,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "connected",
  allowSelfSignedCerts: true,
};

function task(overrides: Partial<MarketingTask> = {}): MarketingTask {
  return {
    id: "task-1",
    title: "Revisar briefing",
    description: "Validar fatos antes da publicação.",
    priority: "medium",
    status: "todo",
    dueDate: "",
    obsidianTaskString: "- [ ] Revisar briefing",
    tags: [],
    isReminderActive: false,
    ...overrides,
  };
}

function campaign(overrides: Partial<MarketingCampaign> = {}): MarketingCampaign {
  return {
    id: "campaign-1",
    title: "Campanha institucional",
    objective: "Organizar a comunicação institucional",
    targetAudience: "",
    tone: "",
    status: "draft",
    channels: [],
    channelsContent: [],
    linkedNotePaths: [],
    summary: "",
    strategy: "",
    startDate: "",
    endDate: "",
    createdDate: "2026-08-25",
    ...overrides,
  };
}

function note(overrides: Partial<ObsidianNote> = {}): ObsidianNote {
  return {
    id: "note-1",
    path: "00_Inbox/fonte.md",
    title: "Fonte validada",
    folder: "00_Inbox",
    content: "Conteúdo confirmado.",
    frontmatter: {},
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-27 08:45",
    ...overrides,
  };
}

describe("dashboard intelligence", () => {
  test("prioriza tarefas reais sem inventar horário, canal ou arquivo", () => {
    const action = selectPriorityAction(
      [],
      [],
      [task({ priority: "urgent", channel: undefined, dueDate: "", dueTime: undefined, obsidianFilePath: undefined })],
      connectedConfig,
      new Date("2026-08-27T09:00:00"),
    );

    expect(action.kind).toBe("task");
    expect(action.badgeLabel).toBe("Urgente");
    expect(action.scheduleLabel).toBeUndefined();
    expect(action.channel).toBeUndefined();
    expect(action.filePath).toBeUndefined();
    expect(JSON.stringify(action)).not.toContain("11:30");
    expect(JSON.stringify(action)).not.toContain("Hoje");
  });

  test("bloqueia a recomendação operacional quando o Obsidian não está conectado", () => {
    const action = selectPriorityAction(
      [note()],
      [],
      [task({ priority: "urgent" })],
      { ...connectedConfig, connectionStatus: "disconnected" },
      new Date("2026-08-27T09:00:00"),
    );

    expect(action.kind).toBe("connect-obsidian");
    expect(action.title).toContain("Conecte o Obsidian");
  });

  test("expõe bloqueios estruturais separadamente da fila operacional", () => {
    expect(buildDashboardBlockers([note()], connectedConfig)).toEqual([]);

    const disconnected = buildDashboardBlockers(
      [note()],
      { ...connectedConfig, connectionStatus: "disconnected" },
    );
    expect(disconnected[0]?.id).toBe("obsidian-disconnected");

    const empty = buildDashboardBlockers([], connectedConfig);
    expect(empty[0]?.id).toBe("knowledge-empty");
  });

  test("orienta adicionar conhecimento quando o Vault validado está vazio e não há execução pendente", () => {
    const action = selectPriorityAction([], [], [], connectedConfig, new Date("2026-08-27T09:00:00"));
    expect(action.kind).toBe("add-knowledge");
  });

  test("calcula métricas registradas e resumo operacional da semana", () => {
    const metrics = computeDashboardMetrics(
      [note()],
      [campaign({ createdDate: "2026-08-25" }), campaign({ id: "campaign-old", createdDate: "2026-08-10" })],
      [
        task({ id: "done-this-week", status: "done", completedAt: "2026-08-26T15:00:00" }),
        task({ id: "overdue", status: "todo", dueDate: "2026-08-24", dueTime: "18:00" }),
        task({ id: "due-friday", status: "todo", dueDate: "2026-08-28", dueTime: "10:00" }),
        task({ id: "future", status: "todo", dueDate: "2026-09-04", dueTime: "10:00" }),
      ],
      connectedConfig,
      new Date("2026-08-27T09:00:00"),
    );

    expect(metrics.campaignsCount).toBe(2);
    expect(metrics.campaignsThisWeek).toBe(1);
    expect(metrics.taskCompletionRate).toBe(25);
    expect(metrics.completedTasksCount).toBe(1);
    expect(metrics.pendingTasksCount).toBe(3);
    expect(metrics.notesCount).toBe(1);
    expect(metrics.overdueTasksCount).toBe(1);
    expect(metrics.dueThisWeekCount).toBe(1);
    expect(metrics.completedThisWeekCount).toBe(1);
  });

  test("timeline usa timestamps reais e não simula sincronização", () => {
    const disconnected = { ...connectedConfig, connectionStatus: "disconnected" as const, lastSyncTime: "2026-08-27T09:10:00" };
    const activity = buildDashboardActivity(
      [note({ lastModified: "2026-08-27 08:45" })],
      [campaign({ createdDate: "2026-08-26" })],
      [task({ status: "done", completedAt: "2026-08-27T09:00:00" })],
      disconnected,
      new Date("2026-08-27T09:30:00"),
    );

    expect(activity[0].kind).toBe("task");
    expect(activity.some((item) => item.kind === "sync")).toBe(false);
    expect(activity.every((item) => item.timeLabel !== "Recente")).toBe(true);
  });
});
