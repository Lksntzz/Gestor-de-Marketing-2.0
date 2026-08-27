import type {
  DailyRoutineSlot,
  LearningInsight,
  MarketingCampaign,
  MarketingTask,
  ObsidianNote,
  PostHistoryItem,
} from "../types";

export type PlanningActionKind = "task" | "campaign" | "routine" | "knowledge" | "none";

export interface PlanningAction {
  kind: PlanningActionKind;
  title: string;
  detail: string;
  sourceLabel: string;
  sourceId?: string;
  urgency: "overdue" | "today" | "active" | "review" | "normal";
}

export interface PlanningSnapshot {
  todayKey: string;
  openTasks: MarketingTask[];
  overdueTasks: MarketingTask[];
  todayTasks: MarketingTask[];
  weekTasks: MarketingTask[];
  openCampaigns: MarketingCampaign[];
  pendingRoutine: DailyRoutineSlot[];
  pendingKnowledge: ObsidianNote[];
  confirmedKnowledgeCount: number;
  nextAction: PlanningAction;
  performance: {
    publishedItems: number;
    reach: number;
    leads: number;
    averageCtr: number | null;
  };
  learnings: LearningInsight[];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function validDateKey(value?: string): string | null {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function compareTaskDate(a: MarketingTask, b: MarketingTask): number {
  const aDate = validDateKey(a.dueDate) || "9999-12-31";
  const bDate = validDateKey(b.dueDate) || "9999-12-31";
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return String(a.dueTime || "99:99").localeCompare(String(b.dueTime || "99:99"));
}

function noteEpistemicStatus(note: ObsidianNote): "CONFIRMADO" | "HIPÓTESE" | "PENDENTE" {
  const raw = String(note.frontmatter?.epistemic_status || "").toUpperCase();
  if (raw === "CONFIRMADO" || raw === "HIPÓTESE" || raw === "PENDENTE") return raw;
  if (note.frontmatter?.status === "OFICIAL") return "CONFIRMADO";
  return "PENDENTE";
}

function noteNeedsReview(note: ObsidianNote): boolean {
  const status = String(note.frontmatter?.status || "").toUpperCase();
  return noteEpistemicStatus(note) !== "CONFIRMADO" || status === "NOVO" || status === "EM REVISÃO";
}

function pickNextAction(params: {
  overdueTasks: MarketingTask[];
  todayTasks: MarketingTask[];
  openTasks: MarketingTask[];
  openCampaigns: MarketingCampaign[];
  pendingRoutine: DailyRoutineSlot[];
  pendingKnowledge: ObsidianNote[];
}): PlanningAction {
  const overdue = params.overdueTasks[0];
  if (overdue) {
    return {
      kind: "task",
      title: overdue.title,
      detail: `Tarefa vencida${overdue.dueDate ? ` desde ${overdue.dueDate}` : ""}${overdue.dueTime ? ` às ${overdue.dueTime}` : ""}.`,
      sourceLabel: "Execução",
      sourceId: overdue.id,
      urgency: "overdue",
    };
  }

  const today = params.todayTasks[0];
  if (today) {
    return {
      kind: "task",
      title: today.title,
      detail: today.dueTime ? `Prazo registrado para hoje às ${today.dueTime}.` : "Prazo registrado para hoje.",
      sourceLabel: "Execução",
      sourceId: today.id,
      urgency: "today",
    };
  }

  const inProgress = params.openTasks.find((task) => task.status === "in-progress");
  if (inProgress) {
    return {
      kind: "task",
      title: inProgress.title,
      detail: "Esta tarefa está registrada como em andamento.",
      sourceLabel: "Execução",
      sourceId: inProgress.id,
      urgency: "active",
    };
  }

  const campaign = params.openCampaigns[0];
  if (campaign) {
    const dateDetail = campaign.startDate
      ? `Início registrado em ${campaign.startDate}${campaign.endDate ? ` e término em ${campaign.endDate}` : ""}.`
      : "Campanha aberta sem data de início registrada.";
    return {
      kind: "campaign",
      title: campaign.title,
      detail: dateDetail,
      sourceLabel: "Resultados / Campanhas",
      sourceId: campaign.id,
      urgency: campaign.status === "active" ? "active" : "normal",
    };
  }

  const routine = params.pendingRoutine[0];
  if (routine) {
    const schedule = [routine.dayOfWeek, routine.optimalTime].filter(Boolean).join(" • ");
    return {
      kind: "routine",
      title: routine.focusTheme,
      detail: schedule ? `Pauta registrada para ${schedule}.` : "Pauta registrada na rotina semanal.",
      sourceLabel: "Planejamento",
      sourceId: routine.id,
      urgency: "normal",
    };
  }

  const note = params.pendingKnowledge[0];
  if (note) {
    return {
      kind: "knowledge",
      title: note.title,
      detail: `Fonte em ${note.folder || "Vault"} precisa de revisão antes de orientar decisões.`,
      sourceLabel: "Cofre Obsidian",
      sourceId: note.id,
      urgency: "review",
    };
  }

  return {
    kind: "none",
    title: "Nenhuma prioridade fundamentada disponível",
    detail: "Registre uma tarefa, campanha, pauta ou fonte para o planejamento conseguir ordenar o próximo passo.",
    sourceLabel: "Base atual",
    urgency: "normal",
  };
}

export function buildPlanningSnapshot(
  input: {
    tasks: MarketingTask[];
    campaigns: MarketingCampaign[];
    weeklyRoutine: DailyRoutineSlot[];
    notes: ObsidianNote[];
    postHistory: PostHistoryItem[];
    learnings: LearningInsight[];
  },
  now = new Date()
): PlanningSnapshot {
  const todayKey = localDateKey(now);
  const weekStart = localDateKey(startOfWeekMonday(now));
  const weekEnd = localDateKey(endOfWeekSunday(now));

  const openTasks = input.tasks.filter((task) => task.status !== "done").slice().sort(compareTaskDate);
  const overdueTasks = openTasks.filter((task) => {
    const due = validDateKey(task.dueDate);
    return Boolean(due && due < todayKey);
  });
  const todayTasks = openTasks.filter((task) => validDateKey(task.dueDate) === todayKey);
  const weekTasks = openTasks.filter((task) => {
    const due = validDateKey(task.dueDate);
    return Boolean(due && due >= weekStart && due <= weekEnd);
  });

  const openCampaigns = input.campaigns
    .filter((campaign) => campaign.status !== "completed")
    .slice()
    .sort((a, b) => {
      const aDate = validDateKey(a.startDate) || "9999-12-31";
      const bDate = validDateKey(b.startDate) || "9999-12-31";
      return aDate.localeCompare(bDate);
    });

  const pendingRoutine = input.weeklyRoutine.filter((slot) => slot.status !== "publicado");
  const pendingKnowledge = input.notes.filter(noteNeedsReview);
  const confirmedKnowledgeCount = input.notes.filter((note) => noteEpistemicStatus(note) === "CONFIRMADO").length;

  const publishedItems = input.postHistory.length;
  const reach = input.postHistory.reduce((sum, item) => sum + Number(item.metrics?.reach || 0), 0);
  const leads = input.postHistory.reduce((sum, item) => sum + Number(item.metrics?.clicksOrLeads || 0), 0);
  const ctrValues = input.postHistory
    .map((item) => Number(item.metrics?.ctrPercent))
    .filter((value) => Number.isFinite(value));
  const averageCtr = ctrValues.length
    ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
    : null;

  const nextAction = pickNextAction({
    overdueTasks,
    todayTasks,
    openTasks,
    openCampaigns,
    pendingRoutine,
    pendingKnowledge,
  });

  return {
    todayKey,
    openTasks,
    overdueTasks,
    todayTasks,
    weekTasks,
    openCampaigns,
    pendingRoutine,
    pendingKnowledge,
    confirmedKnowledgeCount,
    nextAction,
    performance: {
      publishedItems,
      reach,
      leads,
      averageCtr,
    },
    learnings: input.learnings.slice(),
  };
}
