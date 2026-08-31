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
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  vaultName: "MarketingVault",
  useHttps: true,
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

function note(path = "Nisti Marketing/01_Estrategia/Posicionamento.md", status = "CONFIRMADO"): ObsidianNote {
  const title = path.split("/").pop()?.replace(/\.md$/i, "") || "Fonte";
  return {
    id: path,
    path,
    title,
    folder: path.split("/").slice(0, -1).join("/"),
    content: "Conteúdo real registrado.",
    frontmatter: { epistemic_status: status },
    tags: [],
    wikilinks: [],
    lastModified: "2026-08-27 08:45",
  };
}

describe("dashboard intelligence", () => {
  test("prioriza tarefas reais depois que existe conhecimento estratégico utilizável", () => {
    const action = selectPriorityAction(
      [note()],
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
  });

  test("bloqueia execução quando o Obsidian não está conectado", () => {
    const action = selectPriorityAction(
      [note()],
      [],
      [task({ priority: "urgent" })],
      { ...connectedConfig, connectionStatus: "disconnected" },
    );
    expect(action.kind).toBe("connect-obsidian");
    expect(action.subtitle).toContain("conexão REST");
  });

  test("Inbox isolada não substitui conhecimento estratégico", () => {
    const inbox = [note("Nisti Marketing/00_Inbox/Captura.md", "PENDENTE")];
    const blocker = buildDashboardBlockers(inbox, connectedConfig)[0];
    expect(blocker?.id).toBe("base-not-ready");
    expect(blocker?.title).toBe("Conhecimento precisa de revisão");

    const action = selectPriorityAction(inbox, [campaign()], [task({ priority: "urgent" })], connectedConfig);
    expect(action.kind).toBe("review-base");
    expect(action.badgeLabel).toBe("Conhecimento em revisão");
  });

  test("sem fontes reais orienta adicionar conhecimento em vez de fabricar Base Inicial", () => {
    const blocker = buildDashboardBlockers([], connectedConfig)[0];
    expect(blocker?.title).toBe("Conhecimento estratégico ausente");
    expect(blocker?.detail).toContain("Adicione ao menos uma fonte real");

    const action = selectPriorityAction([], [campaign()], [task({ priority: "urgent" })], connectedConfig);
    expect(action.kind).toBe("complete-base");
    expect(action.badgeLabel).toBe("Conhecimento ausente");
  });

  test("fontes estratégicas confirmadas ou hipóteses explícitas liberam a operação", () => {
    expect(buildDashboardBlockers([note()], connectedConfig)).toEqual([]);
    expect(buildDashboardBlockers([note("Nisti Marketing/08_Aprendizados/Teste.md", "HIPÓTESE")], connectedConfig)).toEqual([]);
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
      [note()],
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
