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
  impressions: number | null;
  reach: number | null;
  saves: number | null;
  clicksOrLeads: number | null;
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

function finiteMetric(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function sumRecorded(values: Array<number | null>): number | null {
  const recorded = values.filter((value): value is number => value !== null);
  return recorded.length ? recorded.reduce((sum, value) => sum + value, 0) : null;
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
    return Boolean(
      campaign.obsidianOutputNotePath
      && item.linkedObsidianNote
      && item.linkedObsidianNote === campaign.obsidianOutputNotePath
    );
  }) as GroundedResult[];
}

export function buildResultsSnapshot(history: PostHistoryItem[]): ResultsSnapshot {
  const impressionsValues: Array<number | null> = [];
  const reachValues: Array<number | null> = [];
  const savesValues: Array<number | null> = [];
  const clickValues: Array<number | null> = [];
  const ctrValues: number[] = [];
  const conversionValues: number[] = [];

  history.forEach((item) => {
    impressionsValues.push(finiteMetric(item.metrics?.impressions));
    reachValues.push(finiteMetric(item.metrics?.reach));
    savesValues.push(finiteMetric(item.metrics?.saves));
    clickValues.push(finiteMetric(item.metrics?.clicksOrLeads));

    const ctr = finiteMetric(item.metrics?.ctrPercent);
    if (ctr !== null) ctrValues.push(ctr);

    const conversion = finiteMetric(item.metrics?.conversionRatePercent);
    if (conversion !== null) conversionValues.push(conversion);
  });

  return {
    publications: history.length,
    impressions: sumRecorded(impressionsValues),
    reach: sumRecorded(reachValues),
    saves: sumRecorded(savesValues),
    clicksOrLeads: sumRecorded(clickValues),
    averageCtr: ctrValues.length ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length : null,
    averageConversion: conversionValues.length
      ? conversionValues.reduce((sum, value) => sum + value, 0) / conversionValues.length
      : null,
  };
}

export function campaignResultSummary(campaign: MarketingCampaign, history: PostHistoryItem[]): ResultsSnapshot {
  return buildResultsSnapshot(resultsForCampaign(campaign, history));
}
