import type { LearningInsight, PostHistoryItem } from "../types";

export interface LearningSnapshot {
  recordedResults: number;
  reach: number;
  clicksOrLeads: number;
  averageCtr: number | null;
  averageConversionRate: number | null;
  latestResults: PostHistoryItem[];
  learnings: LearningInsight[];
}

function finiteMetric(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resultTimestamp(item: PostHistoryItem): number {
  const timestamp = Date.parse(item.publishedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function buildLearningSnapshot(
  postHistory: PostHistoryItem[],
  learnings: LearningInsight[],
): LearningSnapshot {
  const ctrValues: number[] = [];
  const conversionValues: number[] = [];
  let reach = 0;
  let clicksOrLeads = 0;

  for (const item of postHistory) {
    const reachValue = finiteMetric(item.metrics?.reach);
    const leadsValue = finiteMetric(item.metrics?.clicksOrLeads);
    const ctrValue = finiteMetric(item.metrics?.ctrPercent);
    const conversionValue = finiteMetric(item.metrics?.conversionRatePercent);

    if (reachValue !== null) reach += reachValue;
    if (leadsValue !== null) clicksOrLeads += leadsValue;
    if (ctrValue !== null) ctrValues.push(ctrValue);
    if (conversionValue !== null) conversionValues.push(conversionValue);
  }

  return {
    recordedResults: postHistory.length,
    reach,
    clicksOrLeads,
    averageCtr: ctrValues.length
      ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length
      : null,
    averageConversionRate: conversionValues.length
      ? conversionValues.reduce((sum, value) => sum + value, 0) / conversionValues.length
      : null,
    latestResults: postHistory.slice().sort((a, b) => resultTimestamp(b) - resultTimestamp(a)),
    learnings: learnings.slice().sort((a, b) => String(b.dateCreated || "").localeCompare(String(a.dateCreated || ""))),
  };
}

export function formatRecordedMetric(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}
