import type { ObsidianNote } from "../types";
import {
  NISTI_INBOX_FOLDER,
  NISTI_VAULT_ROOT,
  qualifyNistiKnowledgeFolder,
  type KnowledgeTriageClassification,
} from "../services/obsidianKnowledgeAutomation";

export const AI_TRIAGE_CONFIDENCE = 0.9;
export const PLANNING_KNOWLEDGE_FOLDERS = [
  `${NISTI_VAULT_ROOT}/01_Estrategia`,
  `${NISTI_VAULT_ROOT}/02_Produtos`,
  `${NISTI_VAULT_ROOT}/03_Conteudos`,
  `${NISTI_VAULT_ROOT}/07_Pesquisas`,
  `${NISTI_VAULT_ROOT}/08_Aprendizados`,
] as const;

const AI_TRIAGE_RELATIVE_FOLDERS = new Set([
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
]);

export interface AiTriageCandidate {
  folder: string;
  confidence: number;
  reason: string;
}

export function normalizeAiTriageCandidate(
  input: unknown,
  deterministic: KnowledgeTriageClassification,
): AiTriageCandidate | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const folder = qualifyNistiKnowledgeFolder(String(raw.folder || ""));
  const relative = folder.split("/").pop() || "";
  if (!AI_TRIAGE_RELATIVE_FOLDERS.has(relative) || folder === NISTI_INBOX_FOLDER) return null;

  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence) || confidence < AI_TRIAGE_CONFIDENCE || confidence > 1) return null;
  const reason = String(raw.reason || "").trim();
  if (reason.length < 8) return null;

  if (
    deterministic.folder !== NISTI_INBOX_FOLDER
    && deterministic.confidence >= 0.7
    && deterministic.folder !== folder
  ) {
    return null;
  }

  return {
    folder,
    confidence: Number(confidence.toFixed(2)),
    reason,
  };
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeMetricNumber(raw: string, compact: boolean): string {
  const value = raw.replace(/\s/g, "");
  if (compact) {
    const lastComma = value.lastIndexOf(",");
    const lastDot = value.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      const decimalIndex = Math.max(lastComma, lastDot);
      const integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, "");
      return `${integerPart}.${value.slice(decimalIndex + 1).replace(/[.,]/g, "")}`;
    }
    return value.replace(",", ".");
  }

  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) {
    return value.replace(/[.,]/g, "");
  }
  if (value.includes(",") && value.includes(".")) {
    const decimalIndex = Math.max(value.lastIndexOf(","), value.lastIndexOf("."));
    const integerPart = value.slice(0, decimalIndex).replace(/[.,]/g, "");
    return `${integerPart}.${value.slice(decimalIndex + 1).replace(/[.,]/g, "")}`;
  }
  return value.replace(",", ".");
}

function numberFromToken(value: string): number | undefined {
  const clean = value.trim().toLowerCase().replace(/\s/g, "");
  const match = clean.match(/^([0-9][0-9.,]*)([km])?$/i);
  if (!match) return undefined;
  const suffix = match[2]?.toLowerCase();
  const base = Number(normalizeMetricNumber(match[1], Boolean(suffix)));
  if (!Number.isFinite(base) || base < 0) return undefined;
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  return Math.round(base * multiplier);
}

function percentFromToken(value: string): number | undefined {
  const parsed = Number(value.trim().replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

function firstMetric(text: string, labels: string[], percent = false): number | undefined {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|[\\n;|•-])\\s*${escaped}\\s*[:=\\-]?\\s*([0-9][0-9.,]*\\s*[kKmM]?%?)`, "i");
    const match = text.match(regex);
    if (!match?.[1]) continue;
    const parsed = percent ? percentFromToken(match[1]) : numberFromToken(match[1].replace("%", ""));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export type SocialPlatform = "instagram" | "tiktok" | "unknown";

export interface SocialPerformanceMetrics {
  platform: SocialPlatform;
  impressions?: number;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicksOrLeads?: number;
  followersGained?: number;
  watchTimeSeconds?: number;
  avgWatchTimeSeconds?: number;
  completionRatePercent?: number;
  engagementRatePercent?: number;
  ctrPercent?: number;
  conversionRatePercent?: number;
}

export function parseSocialPerformanceText(input: unknown): SocialPerformanceMetrics {
  const text = String(input ?? "");
  const normalized = normalize(text);
  const platform: SocialPlatform = normalized.includes("tiktok")
    ? "tiktok"
    : normalized.includes("instagram") || normalized.includes("reels")
      ? "instagram"
      : "unknown";

  return {
    platform,
    impressions: firstMetric(text, ["impressões", "impressoes", "impressions"]),
    reach: firstMetric(text, ["alcance", "reach", "contas alcançadas", "contas alcancadas"]),
    views: firstMetric(text, ["visualizações", "visualizacoes", "views", "video views"]),
    likes: firstMetric(text, ["curtidas", "likes"]),
    comments: firstMetric(text, ["comentários", "comentarios", "comments"]),
    shares: firstMetric(text, ["compartilhamentos", "shares"]),
    saves: firstMetric(text, ["salvamentos", "saves"]),
    clicksOrLeads: firstMetric(text, ["cliques", "clicks", "leads", "cliques no link"]),
    followersGained: firstMetric(text, ["seguidores ganhos", "novos seguidores", "followers gained"]),
    watchTimeSeconds: firstMetric(text, ["tempo de exibição (s)", "tempo de exibicao (s)", "watch time (s)"]),
    avgWatchTimeSeconds: firstMetric(text, ["tempo médio de exibição (s)", "tempo medio de exibicao (s)", "average watch time (s)"]),
    completionRatePercent: firstMetric(text, ["taxa de conclusão", "taxa de conclusao", "completion rate"], true),
    engagementRatePercent: firstMetric(text, ["taxa de engajamento", "engagement rate"], true),
    ctrPercent: firstMetric(text, ["ctr"], true),
    conversionRatePercent: firstMetric(text, ["taxa de conversão", "taxa de conversao", "conversion rate"], true),
  };
}

export function hasMeaningfulSocialMetrics(metrics: SocialPerformanceMetrics): boolean {
  return Object.entries(metrics).some(([key, value]) => key !== "platform" && typeof value === "number");
}

export function socialPerformanceFrontmatter(metrics: SocialPerformanceMetrics): Record<string, unknown> {
  const entries = Object.entries(metrics).filter(([key, value]) => key !== "platform" && typeof value === "number");
  return Object.fromEntries([
    ["social_platform", metrics.platform],
    ["metric_source", "observed"],
    ...entries.map(([key, value]) => [`metric_${key}`, value]),
  ]);
}

function normalizedPath(note: ObsidianNote): string {
  return String(note.path || "").replace(/\\/g, "/");
}

export function preferredPlanningSourcePaths(notes: ObsidianNote[]): string[] {
  return notes
    .filter((note) => {
      const path = normalizedPath(note);
      return PLANNING_KNOWLEDGE_FOLDERS.some((folder) => path.startsWith(`${folder}/`));
    })
    .map((note) => normalizedPath(note));
}

export function assessSmartKnowledgeReadiness(notes: ObsidianNote[]): {
  ready: boolean;
  usableSources: number;
  pendingSources: number;
  strategicSources: number;
} {
  const managed = notes.filter((note) => normalizedPath(note).startsWith(`${NISTI_VAULT_ROOT}/`));
  const usable = managed.filter((note) => {
    const path = normalizedPath(note);
    if (path.startsWith(`${NISTI_INBOX_FOLDER}/`) || path.includes("/99_Templates/")) return false;
    const epistemic = String(note.frontmatter?.epistemic_status || note.frontmatter?.status || "PENDENTE").toUpperCase();
    return epistemic === "CONFIRMADO" || epistemic === "HIPÓTESE" || epistemic === "OFICIAL";
  });
  const strategic = usable.filter((note) => PLANNING_KNOWLEDGE_FOLDERS.some((folder) => normalizedPath(note).startsWith(`${folder}/`)));
  const pendingSources = managed.filter((note) => {
    const epistemic = String(note.frontmatter?.epistemic_status || note.frontmatter?.status || "PENDENTE").toUpperCase();
    return epistemic === "PENDENTE" || epistemic === "NOVO" || epistemic === "EM REVISÃO";
  }).length;

  return {
    ready: strategic.length > 0,
    usableSources: usable.length,
    pendingSources,
    strategicSources: strategic.length,
  };
}
