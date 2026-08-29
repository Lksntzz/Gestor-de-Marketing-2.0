import type {
  CreativeScript,
  EditorialItem,
  EditorialStatus,
  MarketingTask,
  TaskPriority,
} from "../types";
import { formatToObsidianTask } from "./obsidianUri";
import { localDateKey } from "./reliability";

export interface EditorialDraft {
  id: string;
  title: string;
  contentType: string;
  platform: string;
  objective: string;
  scheduledDate: string;
  scheduledTime: string;
  status: EditorialStatus;
  priority: TaskPriority | "";
  ideaId?: string;
  scriptId?: string;
  campaignId?: string;
  obsidianPath?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EditorialPlanSuggestion {
  title: string;
  platform: string;
  format: string;
  objective: string;
  date: string;
  time?: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateKey(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return localDateKey(date) === value ? date : null;
}

function addDaysKey(dateKey: string, amount: number): string | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function createEmptyEditorialDraft(id: string, now = Date.now()): EditorialDraft {
  return {
    id,
    title: "",
    contentType: "",
    platform: "",
    objective: "",
    scheduledDate: "",
    scheduledTime: "",
    status: "DRAFT",
    priority: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function approvedScriptToEditorialDraft(
  script: CreativeScript,
  id: string,
  now = Date.now(),
): EditorialDraft {
  return {
    ...createEmptyEditorialDraft(id, now),
    title: script.title.trim(),
    contentType: script.format?.trim() || "",
    platform: script.platform?.trim() || "",
    objective: script.objective.trim(),
    ideaId: script.sourceIdeaId,
    scriptId: script.id,
  };
}

export function editorialItemToDraft(item: EditorialItem): EditorialDraft {
  return {
    ...item,
    scheduledTime: item.scheduledTime || "",
  };
}

export function validateEditorialDraft(draft: EditorialDraft): string[] {
  const missing: string[] = [];
  if (!draft.title.trim()) missing.push("título");
  if (!draft.contentType.trim()) missing.push("formato");
  if (!draft.platform.trim()) missing.push("plataforma");
  if (!draft.objective.trim()) missing.push("objetivo");
  if (!parseDateKey(draft.scheduledDate.trim())) missing.push("data válida");
  if (!draft.priority) missing.push("prioridade");
  return missing;
}

export function finalizeEditorialDraft(draft: EditorialDraft, now = Date.now()): EditorialItem {
  const missing = validateEditorialDraft(draft);
  if (missing.length > 0) {
    throw new Error(`Preencha ${missing.join(", ")} antes de salvar no calendário.`);
  }

  return {
    id: draft.id,
    title: draft.title.trim(),
    contentType: draft.contentType.trim(),
    platform: draft.platform.trim(),
    objective: draft.objective.trim(),
    scheduledDate: draft.scheduledDate.trim(),
    scheduledTime: draft.scheduledTime.trim() || undefined,
    status: draft.status,
    priority: draft.priority as TaskPriority,
    ideaId: draft.ideaId,
    scriptId: draft.scriptId,
    campaignId: draft.campaignId,
    obsidianPath: draft.obsidianPath,
    notes: draft.notes,
    createdAt: draft.createdAt,
    updatedAt: now,
  };
}

export function suggestionToDraft(
  suggestion: EditorialPlanSuggestion,
  id: string,
  now = Date.now(),
): EditorialDraft {
  return {
    ...createEmptyEditorialDraft(id, now),
    title: suggestion.title,
    contentType: suggestion.format,
    platform: suggestion.platform,
    objective: suggestion.objective,
    scheduledDate: suggestion.date,
    scheduledTime: suggestion.time || "",
  };
}

export function normalizeWeeklyPlanSuggestions(
  raw: unknown,
  weekStart: string,
): EditorialPlanSuggestion[] {
  if (!Array.isArray(raw) || !parseDateKey(weekStart)) return [];
  const weekEnd = addDaysKey(weekStart, 6);
  if (!weekEnd) return [];

  const seen = new Set<string>();
  const normalized: EditorialPlanSuggestion[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = clean(record.title);
    const platform = clean(record.platform);
    const format = clean(record.format);
    const objective = clean(record.objective);
    const date = clean(record.date);
    const rawTime = clean(record.time);
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime) ? rawTime : undefined;

    if (!title || !platform || !format || !objective || !parseDateKey(date)) continue;
    if (date < weekStart || date > weekEnd) continue;

    const key = `${date}|${platform.toLocaleLowerCase("pt-BR")}|${title.toLocaleLowerCase("pt-BR")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ title, platform, format, objective, date, time });
  }

  return normalized;
}

export function reconcileEditorialTask(
  tasks: MarketingTask[],
  item: EditorialItem,
  now = Date.now(),
): MarketingTask[] {
  const taskId = `task-ed-${item.id}`;
  const existing = tasks.find((task) => task.id === taskId);

  if (item.status === "ARCHIVED" || !item.scheduledDate) {
    return tasks.filter((task) => task.id !== taskId);
  }

  const status: MarketingTask["status"] = item.status === "PUBLISHED"
    ? "done"
    : existing?.status === "done"
      ? "todo"
      : existing?.status || "todo";

  const reminderDate = existing?.reminderDate && existing.reminderDate === existing.dueDate
    ? item.scheduledDate
    : existing?.reminderDate;

  const nextTask: MarketingTask = {
    id: taskId,
    title: `Publicar: ${item.title}`,
    description: existing?.description,
    channel: item.platform,
    priority: item.priority,
    status,
    dueDate: item.scheduledDate,
    dueTime: item.scheduledTime,
    reminderDate,
    reminderTime: existing?.reminderTime,
    obsidianTaskString: "",
    obsidianFilePath: existing?.obsidianFilePath,
    linkedCampaignId: item.campaignId || existing?.linkedCampaignId,
    tags: existing?.tags || [],
    isReminderActive: existing?.isReminderActive || false,
    completedAt: status === "done"
      ? existing?.completedAt || new Date(now).toISOString()
      : undefined,
  };

  nextTask.obsidianTaskString = formatToObsidianTask(nextTask);

  if (!existing) return [...tasks, nextTask];
  return tasks.map((task) => task.id === taskId ? nextTask : task);
}

export function removeEditorialTask(tasks: MarketingTask[], editorialId: string): MarketingTask[] {
  return tasks.filter((task) => task.id !== `task-ed-${editorialId}`);
}
