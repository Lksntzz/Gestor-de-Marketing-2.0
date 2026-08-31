import type { MarketingTask, TaskPriority } from "../types";

export type ExecutionBucket = "overdue" | "today" | "upcoming" | "unscheduled" | "done";

export interface ExecutionSnapshot {
  today: string;
  pending: MarketingTask[];
  completed: MarketingTask[];
  overdue: MarketingTask[];
  dueToday: MarketingTask[];
  inProgress: MarketingTask[];
  remindersDue: MarketingTask[];
  nextAction: MarketingTask | null;
}

const priorityRank: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  unspecified: 4,
};

export function editorialIdFromTask(taskOrId: MarketingTask | string): string | null {
  const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
  const match = id.match(/^task-ed-(.+)$/);
  return match?.[1]?.trim() || null;
}

export function isEditorialTask(taskOrId: MarketingTask | string): boolean {
  return Boolean(editorialIdFromTask(taskOrId));
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeKey(date?: string, time?: string): string {
  if (!date) return "9999-12-31T23:59";
  return `${date}T${time || "23:59"}`;
}

function compareOperationalPriority(a: MarketingTask, b: MarketingTask): number {
  const dueCompare = dateTimeKey(a.dueDate, a.dueTime).localeCompare(dateTimeKey(b.dueDate, b.dueTime));
  if (dueCompare !== 0) return dueCompare;

  const priorityCompare = priorityRank[a.priority] - priorityRank[b.priority];
  if (priorityCompare !== 0) return priorityCompare;

  if (a.status !== b.status) {
    if (a.status === "in-progress") return -1;
    if (b.status === "in-progress") return 1;
  }

  return a.title.localeCompare(b.title, "pt-BR");
}

export function classifyTask(task: MarketingTask, today = localDateKey()): ExecutionBucket {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "unscheduled";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  return "upcoming";
}

export function isReminderDue(task: MarketingTask, now = new Date()): boolean {
  if (task.status === "done" || !task.isReminderActive || !task.reminderDate) return false;
  const today = localDateKey(now);
  if (task.reminderDate < today) return true;
  if (task.reminderDate > today) return false;
  if (!task.reminderTime) return true;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return task.reminderTime <= currentTime;
}

export function buildExecutionSnapshot(tasks: MarketingTask[], now = new Date()): ExecutionSnapshot {
  const today = localDateKey(now);
  const pending = tasks.filter((task) => task.status !== "done");
  const completed = tasks.filter((task) => task.status === "done");
  const overdue = pending.filter((task) => classifyTask(task, today) === "overdue").sort(compareOperationalPriority);
  const dueToday = pending.filter((task) => classifyTask(task, today) === "today").sort(compareOperationalPriority);
  const inProgress = pending.filter((task) => task.status === "in-progress").sort(compareOperationalPriority);
  const upcoming = pending.filter((task) => classifyTask(task, today) === "upcoming").sort(compareOperationalPriority);
  const unscheduled = pending.filter((task) => classifyTask(task, today) === "unscheduled").sort(compareOperationalPriority);
  const remindersDue = pending.filter((task) => isReminderDue(task, now)).sort(compareOperationalPriority);

  const nextAction = overdue[0] || dueToday[0] || inProgress[0] || upcoming[0] || unscheduled[0] || null;

  return {
    today,
    pending,
    completed,
    overdue,
    dueToday,
    inProgress,
    remindersDue,
    nextAction,
  };
}

export function formatTaskDueLabel(task: MarketingTask, now = new Date()): string {
  if (!task.dueDate) return "Sem prazo";
  const today = localDateKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  const suffix = task.dueTime ? `, ${task.dueTime}` : "";

  if (task.dueDate < today) return `Vencida em ${formatDate(task.dueDate)}${suffix}`;
  if (task.dueDate === today) return `Hoje${suffix}`;
  if (task.dueDate === tomorrowKey) return `Amanhã${suffix}`;
  return `${formatDate(task.dueDate)}${suffix}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function taskMatchesSearch(task: MarketingTask, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return true;
  const haystack = [task.title, task.description, task.channel, task.obsidianFilePath, ...(task.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return haystack.includes(normalized);
}

export function moveTaskToNextDay(task: MarketingTask, now = new Date()): MarketingTask {
  if (isEditorialTask(task)) {
    throw new Error("Tarefas editoriais devem ter data alterada no Calendário para preservar a fonte de verdade.");
  }

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  const oldDueDate = task.dueDate;
  const nextReminderDate = task.reminderDate && oldDueDate && task.reminderDate === oldDueDate ? tomorrowKey : task.reminderDate;
  const updated: MarketingTask = {
    ...task,
    dueDate: tomorrowKey,
    reminderDate: nextReminderDate,
  };

  const checkMark = updated.status === "done" ? "x" : " ";
  const dueTime = updated.dueTime ? ` ⏰ ${updated.dueTime}` : "";
  const reminder = updated.isReminderActive && updated.reminderDate && updated.reminderTime
    ? ` (@${updated.reminderDate} ${updated.reminderTime})`
    : "";
  const tags = updated.tags?.length ? ` ${updated.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}` : "";
  updated.obsidianTaskString = `- [${checkMark}] ${updated.title} 📅 ${updated.dueDate}${dueTime}${reminder}${tags}`;
  return updated;
}
