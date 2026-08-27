import type { ObsidianNote } from "../types";

export type VaultSourceKind = "markdown" | "text" | "pdf" | "image";
export type EpistemicState = "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";

export interface FolderInsight {
  folder: string | null;
  total: number;
  byKind: Record<VaultSourceKind, number>;
  byState: Record<EpistemicState, number>;
  latestModified?: string;
  categories: string[];
}

export function cleanMarkdown(value: string): string {
  return (value || "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sourceKind(note: ObsidianNote): VaultSourceKind {
  const raw = String(note.frontmatter?.asset_kind || note.frontmatter?.source_type || "markdown").toLowerCase();
  if (raw.includes("image") || raw === "png" || raw === "jpg" || raw === "jpeg" || raw === "webp") return "image";
  if (raw.includes("pdf")) return "pdf";
  if (raw.includes("text") || raw === "txt") return "text";
  return "markdown";
}

export function epistemicState(note: ObsidianNote): EpistemicState {
  const raw = String(note.frontmatter?.epistemic_status || note.frontmatter?.status || "PENDENTE").toUpperCase();
  if (raw === "CONFIRMADO" || raw === "OFICIAL") return "CONFIRMADO";
  if (raw === "HIPÓTESE" || raw === "HIPOTESE") return "HIPÓTESE";
  return "PENDENTE";
}

function extractStructuredSection(content: string, heading: string): string | null {
  const target = `## ${heading}`.trim().toLocaleLowerCase("pt-BR");
  const lines = (content || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLocaleLowerCase("pt-BR") === target);
  if (start < 0) return null;

  const section: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s+/.test(line.trim())) break;
    section.push(line);
  }

  const value = section.join("\n").trim();
  return value || null;
}

export function noteSummary(note: ObsidianNote): string {
  const declared = note.frontmatter?.summary;
  if (typeof declared === "string" && declared.trim()) return declared.trim().slice(0, 520);

  const structured = extractStructuredSection(note.content || "", "Resumo inteligente");
  if (structured) return cleanMarkdown(structured).slice(0, 520);

  const paragraphs = (note.content || "")
    .replace(/^---[\s\S]*?---/m, "")
    .split(/\n\s*\n/)
    .map((part) => cleanMarkdown(part))
    .filter(Boolean);

  return paragraphs[0]?.slice(0, 520) || "Sem síntese disponível para esta fonte.";
}

export function noteKeyFacts(note: ObsidianNote): string[] {
  const explicit = note.frontmatter?.key_facts || note.frontmatter?.keyFacts || note.frontmatter?.highlights;
  if (Array.isArray(explicit)) {
    return Array.from(new Set(explicit.map(String).map((item) => item.trim()).filter(Boolean))).slice(0, 6);
  }

  const section = extractStructuredSection(note.content || "", "Pontos importantes");
  if (!section) return [];

  return Array.from(
    new Set(
      section
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter((line) => line.length >= 4),
    ),
  ).slice(0, 6);
}

export function noteCategory(note: ObsidianNote): string | undefined {
  const raw = note.frontmatter?.category || note.frontmatter?.tipo || note.frontmatter?.projeto;
  const value = raw === undefined || raw === null ? "" : String(raw).trim();
  return value || undefined;
}

export function noteKeywords(note: ObsidianNote): string[] {
  const candidates: unknown[] = [note.frontmatter?.tags, note.tags];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return Array.from(new Set(candidate.map(String).map((item) => item.trim()).filter(Boolean))).slice(0, 8);
    }
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
  }
  return [];
}

export function folderContains(folder: string, candidate: string): boolean {
  return candidate === folder || candidate.startsWith(`${folder}/`);
}

export function visibleFolders(folders: string[], collapsed: Record<string, boolean>): string[] {
  const normalized = Array.from(new Set(folders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return normalized.filter((folder) => {
    const parts = folder.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const ancestor = parts.slice(0, i).join("/");
      if (collapsed[ancestor]) return false;
    }
    return true;
  });
}

export function folderHasChildren(folder: string, folders: string[]): boolean {
  return folders.some((candidate) => candidate !== folder && candidate.startsWith(`${folder}/`));
}

function parseTimestamp(value?: string): number | null {
  const raw = value?.trim();
  if (!raw) return null;
  const normalized = raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function folderInsight(notes: ObsidianNote[], folder: string | null): FolderInsight {
  const scoped = folder
    ? notes.filter((note) => folderContains(folder, note.folder || "00_Inbox"))
    : notes;

  const byKind: FolderInsight["byKind"] = { markdown: 0, text: 0, pdf: 0, image: 0 };
  const byState: FolderInsight["byState"] = { CONFIRMADO: 0, HIPÓTESE: 0, PENDENTE: 0 };
  const categorySet = new Set<string>();
  let latestTimestamp: number | null = null;
  let latestModified: string | undefined;

  scoped.forEach((note) => {
    byKind[sourceKind(note)] += 1;
    byState[epistemicState(note)] += 1;
    const category = noteCategory(note);
    if (category) categorySet.add(category);

    const timestamp = parseTimestamp(note.lastModified);
    if (timestamp !== null && (latestTimestamp === null || timestamp > latestTimestamp)) {
      latestTimestamp = timestamp;
      latestModified = note.lastModified;
    }
  });

  return {
    folder,
    total: scoped.length,
    byKind,
    byState,
    latestModified,
    categories: Array.from(categorySet).slice(0, 4),
  };
}

export function compactFolderSummary(insight: FolderInsight): string {
  if (insight.total === 0) return "Nenhuma fonte indexada nesta seleção.";

  const sourceParts = [
    insight.byKind.markdown ? `${insight.byKind.markdown} Markdown` : "",
    insight.byKind.pdf ? `${insight.byKind.pdf} PDF` : "",
    insight.byKind.image ? `${insight.byKind.image} ${insight.byKind.image === 1 ? "imagem" : "imagens"}` : "",
    insight.byKind.text ? `${insight.byKind.text} ${insight.byKind.text === 1 ? "texto" : "textos"}` : "",
  ].filter(Boolean);

  const stateParts = [
    insight.byState.CONFIRMADO ? `${insight.byState.CONFIRMADO} confirmado${insight.byState.CONFIRMADO === 1 ? "" : "s"}` : "",
    insight.byState.HIPÓTESE ? `${insight.byState.HIPÓTESE} hipótese${insight.byState.HIPÓTESE === 1 ? "" : "s"}` : "",
    insight.byState.PENDENTE ? `${insight.byState.PENDENTE} pendente${insight.byState.PENDENTE === 1 ? "" : "s"}` : "",
  ].filter(Boolean);

  return `${insight.total} ${insight.total === 1 ? "fonte" : "fontes"} • ${sourceParts.join(" • ")}${stateParts.length ? ` • ${stateParts.join(" • ")}` : ""}`;
}
