import type { MarketingTask } from "../types";

export const APP_VERSION = "3.1.10";
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
  "Segunda-feira": 0,
  Terça: 1,
  "Terça-feira": 1,
  Quarta: 2,
  "Quarta-feira": 2,
  Quinta: 3,
  "Quinta-feira": 3,
  Sexta: 4,
  "Sexta-feira": 4,
  Sábado: 5,
  Domingo: 6,
};

export function dateForRoutineDay(dayOfWeek: string, weekAnchor: Date = new Date()): string {
  const monday = startOfWeekMonday(weekAnchor);
  const offset = ROUTINE_DAY_OFFSETS[dayOfWeek];
  if (offset === undefined) {
    throw new Error(`Dia da rotina inválido: ${dayOfWeek}`);
  }
  const result = new Date(monday);
  result.setDate(monday.getDate() + offset);
  return localDateKey(result);
}

export function stableRoutineTaskId(weekAnchor: Date, slotId: string): string {
  const weekKey = localDateKey(startOfWeekMonday(weekAnchor));
  const safeSlot = slotId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
  return `routine-task-${weekKey}-${safeSlot || "slot"}`;
}

export function upsertItemsById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const mergedIncoming = incoming.map((item) => {
    const previous = existingById.get(item.id);
    if (!previous) return item;

    const previousRecord = previous as Record<string, unknown>;
    const itemRecord = item as Record<string, unknown>;
    const merged = { ...previousRecord, ...itemRecord };

    if ("status" in previousRecord) merged.status = previousRecord.status;
    if ("completedAt" in previousRecord) merged.completedAt = previousRecord.completedAt;
    return merged as T;
  });

  const incomingIds = new Set(incoming.map((item) => item.id));
  const preserved = existing.filter((item) => !incomingIds.has(item.id));
  return [...mergedIncoming, ...preserved];
}

/**
 * For Vault knowledge, Obsidian is the source of truth. Once a verified
 * snapshot arrives, local-only notes must not survive and masquerade as Vault
 * content. Duplicate incoming paths are collapsed to the last value.
 */
export function mergeByPath<T extends { path: string }>(_localItems: T[], incomingItems: T[]): T[] {
  const byPath = new Map<string, T>();
  for (const item of incomingItems) byPath.set(item.path, item);
  return Array.from(byPath.values());
}

export function reminderEventKey(task: Pick<MarketingTask, "id" | "reminderDate" | "reminderTime">): string | null {
  if (!task.reminderDate || !task.reminderTime) return null;
  return `${task.id}|${task.reminderDate}|${task.reminderTime}`;
}

export function isReminderDue(
  task: Pick<MarketingTask, "status" | "isReminderActive" | "reminderDate" | "reminderTime">,
  now: Date = new Date(),
  graceMinutes = 5
): boolean {
  if (!task.isReminderActive || task.status === "done" || !task.reminderDate || !task.reminderTime) return false;
  const match = task.reminderTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = task.reminderDate.split("-").map(Number);
  if (!year || !month || !day) return false;
  const due = new Date(year, month - 1, day, Number(match[1]), Number(match[2]), 0, 0);
  const diffMs = now.getTime() - due.getTime();
  return diffMs >= 0 && diffMs < graceMinutes * 60_000;
}

export function pruneFiredReminderKeys(keys: string[], maxEntries = 500): string[] {
  return Array.from(new Set(keys)).slice(-maxEntries);
}
