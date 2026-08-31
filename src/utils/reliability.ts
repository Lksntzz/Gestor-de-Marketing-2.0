import type { MarketingTask } from "../types";

export const APP_VERSION = "3.1.0";
export const DAILY_TASKS_SECTION_ID = "daily-pending-tasks";
export const AUTOMATION_HIGH_PRIORITY_SECTION_ID = "automation-high-priority";

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTimeKey(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function normalizeSectionId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "managed-section";
}

export function buildManagedSection(sectionId: string, heading: string, body: string): string {
  const safeId = normalizeSectionId(sectionId);
  const cleanBody = body.trim();
  return `<!-- nisti:start:${safeId} -->\n## ${heading}\n${cleanBody}\n<!-- nisti:end:${safeId} -->`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function upsertManagedSection(content: string, sectionId: string, heading: string, body: string): string {
  const safeId = normalizeSectionId(sectionId);
  const start = `<!-- nisti:start:${safeId} -->`;
  const end = `<!-- nisti:end:${safeId} -->`;
  const block = buildManagedSection(safeId, heading, body);
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }

  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

export function stableTextHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function deterministicId(prefix: string, ...parts: Array<string | number | undefined>): string {
  const payload = parts.map((part) => String(part ?? "")).join("::");
  return `${prefix}-${stableTextHash(payload)}`;
}

export function parseLocalDateTime(date?: string, time?: string): Date | null {
  const rawDate = date?.trim();
  if (!rawDate) return null;

  const normalized = rawDate.includes(" ") && !rawDate.includes("T")
    ? rawDate.replace(" ", "T")
    : rawDate;
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? `${normalized}T${/^\d{2}:\d{2}/.test(time || "") ? time!.slice(0, 5) : "12:00"}:00`
    : normalized;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isReminderDue(task: MarketingTask, now = new Date(), graceMinutes = 2): boolean {
  if (!task.isReminderActive || task.status === "done" || !task.dueDate || !task.reminderTime) return false;
  const reminder = parseLocalDateTime(task.dueDate, task.reminderTime);
  if (!reminder) return false;
  const delta = now.getTime() - reminder.getTime();
  return delta >= 0 && delta <= graceMinutes * 60_000;
}

export function reminderEventKey(task: MarketingTask): string | null {
  if (!task.isReminderActive || !task.dueDate || !task.reminderTime) return null;
  return `${task.id}::${task.dueDate}::${task.reminderTime}`;
}

export function pruneFiredReminderKeys(keys: string[], maxEntries = 400): string[] {
  return Array.from(new Set(keys)).slice(-maxEntries);
}

export function normalizeRoutineDay(day: string): number {
  const normalized = day.trim().toLocaleLowerCase("pt-BR");
  const map: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    "segunda-feira": 1,
    terça: 2,
    terca: 2,
    "terça-feira": 2,
    "terca-feira": 2,
    quarta: 3,
    "quarta-feira": 3,
    quinta: 4,
    "quinta-feira": 4,
    sexta: 5,
    "sexta-feira": 5,
    sábado: 6,
    sabado: 6,
  };
  return map[normalized] ?? -1;
}

export function nextLocalDateForWeekday(day: string, from = new Date()): Date | null {
  const targetDay = normalizeRoutineDay(day);
  if (targetDay < 0) return null;
  const result = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  const delta = (targetDay - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + delta);
  return result;
}

export function localDateInputValue(date: Date): string {
  return localDateKey(date);
}

export function localWeekBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function sameLocalDay(left: Date, right: Date): boolean {
  return localDateKey(left) === localDateKey(right);
}

export function isWithinLocalWeek(value: string | undefined, now = new Date()): boolean {
  const parsed = parseLocalDateTime(value);
  if (!parsed) return false;
  const { start, end } = localWeekBounds(now);
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
}
