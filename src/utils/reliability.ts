import type { MarketingTask } from "../types";

export const APP_VERSION = "3.1.12";
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
  const block = buildManagedSection(safeId, heading, body);
  const start = `<!-- nisti:start:${safeId} -->`;
  const end = `<!-- nisti:end:${safeId} -->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "m");

  if (pattern.test(content)) {
    return content.replace(pattern, block);
  }

  const trimmed = content.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

export function startOfWeekMonday(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}

const ROUTINE_DAY_OFFSETS: Record<string, number> = {
  Segunda: 0,
  Terça: 1,
  Quarta: 2,
  Quinta: 3,
  Sexta: 4,
  Sábado: 5,
  Domingo: 6,
};

export function routineDateForDay(dayOfWeek: string, referenceDate: Date = new Date()): string {
  const offset = ROUTINE_DAY_OFFSETS[dayOfWeek] ?? 0;
  const target = startOfWeekMonday(referenceDate);
  target.setDate(target.getDate() + offset);
  return localDateKey(target);
}

export function reminderDateTime(task: MarketingTask): Date | null {
  if (!task.isReminderActive || !task.reminderDate) return null;
  const time = task.reminderTime || "09:00";
  const date = new Date(`${task.reminderDate}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function reminderEventKey(task: MarketingTask): string | null {
  const date = reminderDateTime(task);
  return date ? `${task.id}@${date.toISOString()}` : null;
}

export function isReminderDue(task: MarketingTask, now: Date = new Date()): boolean {
  const date = reminderDateTime(task);
  return Boolean(date && task.status !== "done" && date.getTime() <= now.getTime());
}

export function pruneFiredReminderKeys(keys: string[], now: Date = new Date(), retentionDays = 30): string[] {
  const minimum = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return keys.filter((key) => {
    const separator = key.lastIndexOf("@");
    if (separator < 0) return false;
    const timestamp = Date.parse(key.slice(separator + 1));
    return Number.isFinite(timestamp) && timestamp >= minimum;
  });
}

export function toSafeFileName(value: string, fallback = "arquivo"): string {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

export function buildAuditId(prefix = "audit"): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${random}`;
}
