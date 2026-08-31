import type {
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
} from "../types";
import { assessBaseReadiness } from "../domain/baseOnboarding";

export type DashboardActionKind =
  | "task"
  | "campaign"
  | "connect-obsidian"
  | "complete-base"
  | "review-base"
  | "planning";

export type DashboardActionTone = "urgent" | "high" | "normal" | "info";

export interface DashboardPriorityAction {
  id: string;
  kind: DashboardActionKind;
  title: string;
  subtitle: string;
  channel?: string;
  scheduleLabel?: string;
  filePath?: string;
  badgeLabel: string;
  tone: DashboardActionTone;
}

export interface DashboardBlocker {
  id: "obsidian-disconnected" | "base-not-ready";
  title: string;
  detail: string;
  destination: "settings" | "base";
}

export interface DashboardActivityItem {
  id: string;
  timestamp: number | null;
  timeLabel: string;
  action: string;
  detail: string;
  kind: "sync" | "task" | "campaign" | "note";
}

export interface DashboardMetrics {
  campaignsCount: number;
  campaignsThisWeek: number;
  taskCompletionRate: number;
  completedTasksCount: number;
  tasksCount: number;
  pendingTasksCount: number;
  notesCount: number;
  isVaultConnected: boolean;
  dueThisWeekCount: number;
  overdueTasksCount: number;
  completedThisWeekCount: number;
}

const PRIORITY_SCORE: Record<MarketingTask["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  unspecified: 0,
};

const CAMPAIGN_STATUS_SCORE: Record<MarketingCampaign["status"], number> = {
  active: 4,
  scheduled: 3,
  draft: 2,
  completed: 1,
};

function normalizeDateValue(value?: string): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
}

export function parseLocalTimestamp(dateValue?: string, timeValue?: string): number | null {
  const normalized = normalizeDateValue(dateValue);
  if (!normalized) return null;

  let candidate = normalized;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    const safeTime = /^\d{2}:\d{2}/.test(timeValue || "") ? timeValue!.slice(0, 5) : "12:00";
    candidate = `${candidate}T${safeTime}:00`;
  }

  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatScheduleLabel(dateValue?: string, timeValue?: string, now = new Date()): string | undefined {
  const rawDate = dateValue?.trim();
  const rawTime = timeValue?.trim();
  if (!rawDate && !rawTime) return undefined;

  if (!rawDate) return rawTime;

  const timestamp = parseLocalTimestamp(rawDate, rawTime);
  if (timestamp === null) return [rawDate, rawTime].filter(Boolean).join(", ");

  const date = new Date(timestamp);
  const todayKey = localDayKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const dateKey = localDayKey(date);

  const dateLabel =
    dateKey === todayKey
      ? "Hoje"
      : dateKey === localDayKey(tomorrow)
        ? "Amanhã"
        : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return rawTime ? `${dateLabel}, ${rawTime.slice(0, 5)}` : dateLabel;
}

function taskSortTimestamp(task: MarketingTask): number {
  return parseLocalTimestamp(task.dueDate, task.dueTime) ?? Number.MAX_SAFE_INTEGER;
}

function baseReadinessDetail(notes: ObsidianNote[]): string {
  const readiness = assessBaseReadiness(notes);
  const missing = readiness.missingSectionIds.length;
  const pending = readiness.pendingPaths.length;
  const parts: string[] = [];

  if (missing > 0) {
    parts.push(`${missing} ${missing === 1 ? "documento canônico ainda não existe" : "documentos canônicos ainda não existem"}`);
  }
  if (pending > 0) {
    parts.push(`${pending} ${pending === 1 ? "documento precisa de revisão" : "documentos precisam de revisão"}`);
  }

  return parts.length > 0
    ? `${parts.join(" e ")}. Complete ou revise a Base antes de depender dela para decisões de marketing.`
    : "A Base Inicial está pronta.";
}

export function buildDashboardBlockers(
  notes: ObsidianNote[],
  apiConfig: ObsidianApiConfig,
): DashboardBlocker[] {
  if (apiConfig.connectionStatus !== "connected") {
    return [
      {
        id: "obsidian-disconnected",
        title: "Base desconectada",
        detail: "Valide o Obsidian para liberar conhecimento, contexto e gravações no Vault.",
        destination: "settings",
      },
    ];
  }

  const readiness = assessBaseReadiness(notes);
  if (!readiness.complete) {
    return [
      {
        id: "base-not-ready",
        title: readiness.missingSectionIds.length > 0 ? "Base Inicial incompleta" : "Base Inicial precisa de revisão",
        detail: baseReadinessDetail(notes),
        destination: "base",
      },
    ];
  }

  return [];
}

export function selectPriorityAction(
  notes: ObsidianNote[],
  campaigns: MarketingCampaign[],
  tasks: MarketingTask[],
  apiConfig: ObsidianApiConfig,
  now = new Date(),
): DashboardPriorityAction {
  if (apiConfig.connectionStatus !== "connected") {
    return {
      id: "connect-obsidian",
      kind: "connect-obsidian",
      title: "Conecte o Obsidian para liberar a Base",
      subtitle:
        "O Nisti só usa o conhecimento depois que a conexão e a pasta física do Vault são validadas.",
      badgeLabel: "Configuração necessária",
      tone: "info",
    };
  }

  const readiness = assessBaseReadiness(notes);
  if (!readiness.complete) {
    if (readiness.missingSectionIds.length > 0) {
      return {
        id: "complete-base",
        kind: "complete-base",
        title: "Complete a Base Inicial antes de planejar",
        subtitle: baseReadinessDetail(notes),
        badgeLabel: "Base incompleta",
        tone: "info",
      };
    }

    return {
      id: "review-base",
      kind: "review-base",
      title: "Revise as pendências da Base Inicial",
      subtitle: baseReadinessDetail(notes),
      badgeLabel: "Base em revisão",
      tone: "high",
    };
  }

  const pendingTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => {
      const priorityDelta = PRIORITY_SCORE[b.priority] - PRIORITY_SCORE[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return taskSortTimestamp(a) - taskSortTimestamp(b);
    });

  const task = pendingTasks[0];
  if (task) {
    const badgeLabel =
      task.priority === "urgent"
        ? "Urgente"
        : task.priority === "high"
          ? "Alta prioridade"
          : task.priority === "medium"
            ? "Prioridade média"
            : task.priority === "low"
              ? "Baixa prioridade"
              : "Prioridade não definida";

    const tone: DashboardActionTone =
      task.priority === "urgent" ? "urgent" : task.priority === "high" ? "high" : "normal";

    return {
      id: task.id,
      kind: "task",
      title: task.title,
      subtitle: task.description?.trim() || "Tarefa registrada na fila de execução.",
      channel: task.channel?.trim() || undefined,
      scheduleLabel: formatScheduleLabel(task.dueDate, task.dueTime, now),
      filePath: task.obsidianFilePath?.trim() || undefined,
      badgeLabel,
      tone,
    };
  }

  const campaign = [...campaigns]
    .filter((item) => item.status !== "completed")
    .sort((a, b) => {
      const statusDelta = CAMPAIGN_STATUS_SCORE[b.status] - CAMPAIGN_STATUS_SCORE[a.status];
      if (statusDelta !== 0) return statusDelta;
      return (parseLocalTimestamp(b.createdDate) ?? 0) - (parseLocalTimestamp(a.createdDate) ?? 0);
    })[0];

  if (campaign) {
    const statusLabel =
      campaign.status === "active"
        ? "Campanha ativa"
        : campaign.status === "scheduled"
          ? "Campanha agendada"
          : "Campanha em revisão";

    return {
      id: campaign.id,
      kind: "campaign",
      title: campaign.title,
      subtitle:
        campaign.summary?.trim() ||
        campaign.objective?.trim() ||
        "Campanha registrada no planejamento, sem resumo adicional.",
      channel: campaign.channels?.[0]?.trim() || undefined,
      scheduleLabel: formatScheduleLabel(campaign.startDate, undefined, now),
      filePath: campaign.obsidianOutputNotePath?.trim() || undefined,
      badgeLabel: statusLabel,
      tone: campaign.status === "active" ? "high" : "normal",
    };
  }

  return {
    id: "planning",
    kind: "planning",
    title: "Transforme a Base em um plano de ação",
    subtitle: "A Base Inicial está pronta e não há execução pendente. O próximo passo é planejar o que será feito e publicado.",
    channel: "Planejamento",
    badgeLabel: "Próximo passo",
    tone: "normal",
  };
}

function startOfLocalWeek(now: Date): Date {
  const day = now.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0);
}

export function computeDashboardMetrics(
  notes: ObsidianNote[],
  campaigns: MarketingCampaign[],
  tasks: MarketingTask[],
  apiConfig: ObsidianApiConfig,
  now = new Date(),
): DashboardMetrics {
  const completedTasksCount = tasks.filter((task) => task.status === "done").length;
  const pendingTasksCount = tasks.length - completedTasksCount;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;
  const weekStartDate = startOfLocalWeek(now);
  const weekStart = weekStartDate.getTime();
  const weekEnd = new Date(
    weekStartDate.getFullYear(),
    weekStartDate.getMonth(),
    weekStartDate.getDate() + 6,
    23,
    59,
    59,
    999,
  ).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const campaignsThisWeek = campaigns.filter((campaign) => {
    const createdAt = parseLocalTimestamp(campaign.createdDate);
    return createdAt !== null && createdAt >= weekStart && createdAt <= endOfToday;
  }).length;

  const overdueTasksCount = tasks.filter((task) => {
    if (task.status === "done") return false;
    const dueAt = parseLocalTimestamp(task.dueDate, task.dueTime);
    return dueAt !== null && dueAt < startOfToday;
  }).length;

  const dueThisWeekCount = tasks.filter((task) => {
    if (task.status === "done") return false;
    const dueAt = parseLocalTimestamp(task.dueDate, task.dueTime);
    return dueAt !== null && dueAt >= startOfToday && dueAt <= weekEnd;
  }).length;

  const completedThisWeekCount = tasks.filter((task) => {
    if (task.status !== "done") return false;
    const completedAt = parseLocalTimestamp(task.completedAt);
    return completedAt !== null && completedAt >= weekStart && completedAt <= endOfToday;
  }).length;

  return {
    campaignsCount: campaigns.length,
    campaignsThisWeek,
    taskCompletionRate,
    completedTasksCount,
    tasksCount: tasks.length,
    pendingTasksCount,
    notesCount: notes.length,
    isVaultConnected: apiConfig.connectionStatus === "connected",
    dueThisWeekCount,
    overdueTasksCount,
    completedThisWeekCount,
  };
}

function formatActivityTimestamp(timestamp: number | null, now: Date): string {
  if (timestamp === null) return "Sem horário";
  const date = new Date(timestamp);
  const todayKey = localDayKey(now);
  const dateKey = localDayKey(date);
  const hasTime = date.getHours() !== 12 || date.getMinutes() !== 0;

  if (dateKey === todayKey) {
    return hasTime
      ? `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
      : "Hoje";
  }

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function buildDashboardActivity(
  notes: ObsidianNote[],
  campaigns: MarketingCampaign[],
  tasks: MarketingTask[],
  apiConfig: ObsidianApiConfig,
  now = new Date(),
  limit = 6,
): DashboardActivityItem[] {
  const items: Array<Omit<DashboardActivityItem, "timeLabel">> = [];

  if (apiConfig.connectionStatus === "connected" && apiConfig.lastSyncTime) {
    items.push({
      id: "vault-last-sync",
      timestamp: parseLocalTimestamp(apiConfig.lastSyncTime),
      action: "Cofre sincronizado",
      detail: `${notes.length} ${notes.length === 1 ? "nota indexada" : "notas indexadas"}`,
      kind: "sync",
    });
  }

  tasks
    .filter((task) => task.status === "done")
    .forEach((task) => {
      items.push({
        id: `task-${task.id}`,
        timestamp: parseLocalTimestamp(task.completedAt),
        action: "Tarefa concluída",
        detail: task.title,
        kind: "task",
      });
    });

  campaigns.forEach((campaign) => {
    items.push({
      id: `campaign-${campaign.id}`,
      timestamp: parseLocalTimestamp(campaign.createdDate),
      action: "Campanha registrada",
      detail: campaign.title,
      kind: "campaign",
    });
  });

  notes.forEach((note) => {
    items.push({
      id: `note-${note.id}`,
      timestamp: parseLocalTimestamp(note.lastModified),
      action: "Conhecimento no cofre",
      detail: note.title,
      kind: "note",
    });
  });

  return items
    .sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return a.detail.localeCompare(b.detail);
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      return b.timestamp - a.timestamp;
    })
    .slice(0, limit)
    .map((item) => ({
      ...item,
      timeLabel: formatActivityTimestamp(item.timestamp, now),
    }));
}
