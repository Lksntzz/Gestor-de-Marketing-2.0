import type { ObsidianNote } from "../../types";
import { evaluateEpistemicWeight } from "./EpistemicClassifier";

export type EpistemicStatus = "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";

export interface KnowledgeContextLimits {
  maxSources: number;
  maxCharsPerSource: number;
  maxTotalChars: number;
}

export interface KnowledgeContextSource {
  path: string;
  title: string;
  relevanceScore: number;
  epistemicStatus: EpistemicStatus;
  content: string;
}

export interface KnowledgeSourceTrace {
  path: string;
  title: string;
  relevanceScore: number;
  epistemicStatus: EpistemicStatus;
}

export interface KnowledgeContextSelection {
  sources: KnowledgeContextSource[];
  warning?: string;
  totalCharacters: number;
  estimatedTokens: number;
}

export interface KnowledgeContextQuery {
  query: string;
  notes: ObsidianNote[];
  preferredSourcePaths?: string[];
  limits?: Partial<KnowledgeContextLimits>;
}

export const DEFAULT_KNOWLEDGE_CONTEXT_LIMITS: KnowledgeContextLimits = {
  maxSources: 5,
  maxCharsPerSource: 2_400,
  maxTotalChars: 9_000,
};

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em",
  "esta", "este", "gerar", "mais", "na", "nas", "no", "nos", "o", "os", "para", "por",
  "que", "se", "sem", "uma", "um",
]);

const INJECTION_LINE = /(?:ignore|ignorar|desconsidere|esque[cç]a|substitua).{0,40}(?:instru[cç][oõ]es|prompt|sistema|developer)|(?:system|developer)\s*(?:prompt|message)|revele.{0,30}(?:segredo|token|chave|prompt)|execute\s+(?:este|o)\s+comando/i;
const SECRET_PATTERNS: RegExp[] = [
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bsk-[0-9A-Za-z_-]{12,}\b/g,
  /\bBearer\s+[0-9A-Za-z._~+/-]{10,}\b/gi,
  /\b(?:api[_ -]?key|token|secret|senha)\s*[:=]\s*[^\s,;]+/gi,
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
];
const WINDOWS_ABSOLUTE_PATH = /\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/g;
const UNIX_ABSOLUTE_PATH = /(^|[\s("'])\/(?:Users|home|var|etc|opt|mnt|private|root|tmp)\/[^\s)"']+/g;

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokens(value: unknown): string[] {
  return [...new Set(normalized(value).match(/[a-z0-9][a-z0-9_-]{1,}/g) || [])]
    .filter((token) => !STOP_WORDS.has(token));
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function safeFrontmatterText(note: ObsidianNote): string {
  const frontmatter = note.frontmatter || {};
  const allowedKeys = [
    "tipo", "status", "epistemic_status", "category", "produto", "nicho", "canal", "projeto",
    "target_audience", "tone", "title", "aliases", "keywords", "tags",
  ];
  return allowedKeys.flatMap((key) => stringList(frontmatter[key])).join(" ");
}

function noteKeywords(note: ObsidianNote): string {
  return [
    ...stringList(note.tags),
    ...stringList(note.frontmatter?.tags),
    ...stringList(note.frontmatter?.keywords),
  ].join(" ");
}

function scoreField(queryTokens: string[], field: unknown, weight: number): number {
  const haystack = normalized(field);
  if (!haystack) return 0;
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? weight : 0), 0);
}

function relevanceScore(note: ObsidianNote, query: string, preferredPaths: Set<string>): number {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0 && !preferredPaths.has(relativeVaultPath(note.path))) return 0;

  let score = preferredPaths.has(relativeVaultPath(note.path)) ? 20 : 0;
  score += scoreField(queryTokens, note.title, 8);
  score += scoreField(queryTokens, noteKeywords(note), 7);
  score += scoreField(queryTokens, safeFrontmatterText(note), 4);
  score += scoreField(queryTokens, `${note.folder} ${note.path}`, 3);
  score += scoreField(queryTokens, note.content, 1);

  const phrase = normalized(query).trim();
  if (phrase.length >= 4 && normalized(note.title).includes(phrase)) score += 8;

  // Apply Epistemic Weight
  const epistemic = evaluateEpistemicWeight(note.folder || note.path, note.frontmatter?.status, note.frontmatter?.epistemic_status);
  score = Math.round(score * epistemic.weightMultiplier);

  return score;
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function relativeVaultPath(input: unknown): string {
  const clean = String(input ?? "").replace(/\\/g, "/").replace(/\/{2,}/g, "/").trim();
  const taxonomy = clean.match(/(?:^|\/)((?:00_Inbox|00_Base|01_Estrategia|02_Produtos|03_Conteudos|04_Campanhas|05_Reunioes|06_Influenciadores_UGC|07_Pesquisas|08_Aprendizados|99_Templates)\/.*)$/i);
  if (taxonomy?.[1]) return taxonomy[1].replace(/^\/+/, "");
  if (/^(?:[A-Za-z]:\/|\/)/.test(clean)) return clean.split("/").filter(Boolean).pop() || "nota.md";
  return clean.replace(/^(?:\.\/)+/, "").replace(/^\.\.\/(?:\.\.\/)*?/g, "").replace(/^\/+/, "") || "nota.md";
}

export function epistemicStatusOf(note: ObsidianNote): EpistemicStatus {
  const epistemic = evaluateEpistemicWeight(
    note.folder || note.path,
    note.frontmatter?.status,
    note.frontmatter?.epistemic_status
  );
  return epistemic.normalizedEpistemicStatus;
}

export function sanitizeKnowledgeContent(input: unknown): string {
  let content = String(input ?? "").replace(/\u0000/g, "");
  for (const pattern of SECRET_PATTERNS) content = content.replace(pattern, "[SEGREDO OMITIDO]");
  content = content.replace(WINDOWS_ABSOLUTE_PATH, "[CAMINHO LOCAL OMITIDO]");
  content = content.replace(UNIX_ABSOLUTE_PATH, "$1[CAMINHO LOCAL OMITIDO]");
  content = content
    .split(/\r?\n/)
    .map((line) => INJECTION_LINE.test(line) ? "[INSTRUÇÃO NÃO CONFIÁVEL OMITIDA]" : line)
    .join("\n")
    .replace(/[<>]/g, (character) => character === "<" ? "‹" : "›");
  return content.trim();
}

function relevantExcerpt(content: string, query: string, maxChars: number): string {
  const safe = sanitizeKnowledgeContent(content);
  if (safe.length <= maxChars) return safe;
  const normalizedContent = normalized(safe);
  const matchAt = tokens(query)
    .map((token) => normalizedContent.indexOf(token))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, matchAt - Math.floor(maxChars * 0.2));
  const end = Math.min(safe.length, start + maxChars);
  return `${start > 0 ? "…" : ""}${safe.slice(start, end).trim()}${end < safe.length ? "…" : ""}`.slice(0, maxChars);
}

function dedupeKeys(note: ObsidianNote): string[] {
  const contentHash = hashText(normalized(note.content).replace(/\s+/g, " ").trim());
  return [
    `path:${normalized(relativeVaultPath(note.path))}`,
    note.id ? `id:${normalized(note.id)}` : "",
    note.frontmatter?.id ? `id:${normalized(note.frontmatter.id)}` : "",
    note.frontmatter?.hash ? `hash:${normalized(note.frontmatter.hash)}` : "",
    `content:${contentHash}`,
  ].filter(Boolean);
}

export function toKnowledgeSourceTrace(source: KnowledgeContextSource): KnowledgeSourceTrace {
  const { path, title, relevanceScore, epistemicStatus } = source;
  return { path, title, relevanceScore, epistemicStatus };
}

export class KnowledgeContextService {
  select(input: KnowledgeContextQuery): KnowledgeContextSelection {
    const limits: KnowledgeContextLimits = { ...DEFAULT_KNOWLEDGE_CONTEXT_LIMITS, ...input.limits };
    const preferredPaths = new Set((input.preferredSourcePaths || []).map(relativeVaultPath));
    const ranked = input.notes
      .map((note) => ({ note, score: relevanceScore(note, input.query, preferredPaths) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || Date.parse(right.note.lastModified || "") - Date.parse(left.note.lastModified || "") || left.note.path.localeCompare(right.note.path));

    const seen = new Set<string>();
    const sources: KnowledgeContextSource[] = [];
    let totalCharacters = 0;

    for (const { note, score } of ranked) {
      if (sources.length >= Math.max(0, limits.maxSources)) break;
      const keys = dedupeKeys(note);
      if (keys.some((key) => seen.has(key))) continue;

      const remaining = Math.max(0, limits.maxTotalChars - totalCharacters);
      const allowed = Math.min(Math.max(0, limits.maxCharsPerSource), remaining);
      if (allowed === 0) break;
      const content = relevantExcerpt(note.content, input.query, allowed);
      if (!content) continue;

      sources.push({
        path: relativeVaultPath(note.path),
        title: sanitizeKnowledgeContent(note.title).slice(0, 300),
        relevanceScore: score,
        epistemicStatus: epistemicStatusOf(note),
        content,
      });
      keys.forEach((key) => seen.add(key));
      totalCharacters += content.length;
    }

    return {
      sources,
      warning: sources.length === 0
        ? "Resposta não fundamentada no Vault: nenhuma fonte local relevante foi encontrada."
        : undefined,
      totalCharacters,
      estimatedTokens: Math.ceil(totalCharacters / 4),
    };
  }
}

export const knowledgeContextService = new KnowledgeContextService();
