import type { MarketingCampaign, MarketingTask, ObsidianNote, PostHistoryItem, TaskPriority } from "../types";

export type EpistemicStatus = "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";

export type GroundedCampaign = MarketingCampaign & {
  epistemicStatus?: EpistemicStatus;
  usedEngine?: string;
  wasFallback?: boolean;
  generatedMarkdown?: string;
  suggestedTasks?: MarketingTask[];
  savedToObsidianAt?: string;
};

export type GroundedResult = PostHistoryItem & {
  linkedCampaignId?: string;
  evidenceSource?: string;
};

export interface ResultsSnapshot {
  publications: number;
  impressions: number;
  reach: number;
  saves: number;
  clicksOrLeads: number;
  averageCtr: number | null;
  averageConversion: number | null;
}

const PRIORITIES = new Set<TaskPriority>(["low", "medium", "high", "urgent"]);

function validDate(value: unknown): string {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function validTime(value: unknown): string | undefined {
  const clean = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(clean) ? clean : undefined;
}

function normalizePriority(value: unknown): TaskPriority | null {
  const clean = String(value || "").trim() as TaskPriority;
  return PRIORITIES.has(clean) ? clean : null;
}

function safeMetric(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function noteEpistemicStatus(note: ObsidianNote): EpistemicStatus {
  const explicit = String(note.frontmatter?.epistemic_status || "").toUpperCase();
  if (explicit === "CONFIRMADO" || explicit === "HIPÓTESE" || explicit === "PENDENTE") {
    return explicit;
  }
  return String(note.frontmatter?.status || "").toUpperCase() === "OFICIAL" ? "CONFIRMADO" : "PENDENTE";
}

export function deriveCampaignEpistemicStatus(notes: ObsidianNote[], selectedPaths: string[]): EpistemicStatus {
  const selected = notes.filter((note) => selectedPaths.includes(note.path));
  if (selected.length === 0) return "PENDENTE";
  const statuses = selected.map(noteEpistemicStatus);
  if (statuses.every((status) => status === "CONFIRMADO")) return "HIPÓTESE";
  return "PENDENTE";
}

export function normalizeSuggestedTasks(
  rawTasks: unknown,
  campaignId: string,
  outputNotePath: string
): MarketingTask[] {
  if (!Array.isArray(rawTasks)) return [];

  return rawTasks.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const task = raw as Record<string, unknown>;
    const title = String(task.title || "").trim();
    const priority = normalizePriority(task.priority);
    if (!title || !priority) return [];

    const dueDate = validDate(task.dueDate);
    const dueTime = validTime(task.dueTime);
    const reminderDate = validDate(task.reminderDate);
    const reminderTime = validTime(task.reminderTime);
    const reminderConfigured = Boolean(reminderDate && reminderTime);
    const channel = String(task.channel || "").trim();
    const description = String(task.description || "").trim();
    const providedSyntax = String(task.obsidianTaskString || "").trim();
    const obsidianTaskString = providedSyntax || `- [ ] ${title}`;

    return [{
      id: `campaign-${campaignId}-${index + 1}`,
      title,
      description: description || undefined,
      channel: channel || undefined,
      priority,
      status: "todo",
      dueDate,
      dueTime,
      reminderDate: reminderConfigured ? reminderDate : undefined,
      reminderTime: reminderConfigured ? reminderTime : undefined,
      obsidianTaskString,
      obsidianFilePath: outputNotePath,
      linkedCampaignId: campaignId,
      tags: ["campanha"],
      isReminderActive: reminderConfigured,
    } satisfies MarketingTask];
  });
}

export function resultsForCampaign(campaign: MarketingCampaign, history: PostHistoryItem[]): GroundedResult[] {
  return history.filter((item) => {
    const grounded = item as GroundedResult;
    if (grounded.linkedCampaignId && grounded.linkedCampaignId === campaign.id) return true;
    if (!item.linkedObsidianNote) return false;
    return item.linkedObsidianNote === campaign.obsidianOutputNotePath || item.linkedObsidianNote === campaign.title;
  }) as GroundedResult[];
}

export function buildResultsSnapshot(history: PostHistoryItem[]): ResultsSnapshot {
  const ctrValues: number[] = [];
  const conversionValues: number[] = [];
  let impressions = 0;
  let reach = 0;
  let saves = 0;
  let clicksOrLeads = 0;

  history.forEach((item) => {
    impressions += safeMetric(item.metrics?.impressions);
    reach += safeMetric(item.metrics?.reach);
    saves += safeMetric(item.metrics?.saves);
    clicksOrLeads += safeMetric(item.metrics?.clicksOrLeads);

    const ctr = Number(item.metrics?.ctrPercent);
    if (Number.isFinite(ctr) && ctr >= 0) ctrValues.push(ctr);

    const conversion = Number(item.metrics?.conversionRatePercent);
    if (Number.isFinite(conversion) && conversion >= 0) conversionValues.push(conversion);
  });

  return {
    publications: history.length,
    impressions,
    reach,
    saves,
    clicksOrLeads,
    averageCtr: ctrValues.length ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length : null,
    averageConversion: conversionValues.length
      ? conversionValues.reduce((sum, value) => sum + value, 0) / conversionValues.length
      : null,
  };
}

export function campaignResultSummary(campaign: MarketingCampaign, history: PostHistoryItem[]): ResultsSnapshot {
  return buildResultsSnapshot(resultsForCampaign(campaign, history));
}
