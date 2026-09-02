export interface CreativeCommitPayload {
  folder: string;
  title: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  failIfExists?: boolean;
  asset?: unknown;
}

export interface CreativeCommitResult {
  success?: boolean;
  error?: string;
  noteRelativePath?: string;
  [key: string]: unknown;
}

const LEGACY_VAULT_ROOT = "Nisti Marketing";

const CREATIVE_FOLDER_ALIASES: Record<string, string> = {
  "02_Conteudo/Copies": "03_Conteudos/Copies",
  "02_Conteudo/Ativos": "03_Conteudos/Ativos",
};

const CREATIVE_FOLDER_FALLBACKS: Record<string, string> = {
  "03_Conteudos/Ideias": "03_Conteudos",
  "03_Conteudos/Roteiros": "03_Conteudos",
  "03_Conteudos/Copies": "03_Conteudos",
  "03_Conteudos/Ativos": "03_Conteudos",
};

function normalizeSlashes(value: string): string {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

export function canonicalVaultFolder(value: string): string {
  let clean = normalizeSlashes(value).replace(/^vault\//i, "");
  const legacyPrefix = `${LEGACY_VAULT_ROOT}/`;
  if (clean.toLowerCase().startsWith(legacyPrefix.toLowerCase())) {
    clean = clean.slice(legacyPrefix.length);
  } else if (clean.toLowerCase() === LEGACY_VAULT_ROOT.toLowerCase()) {
    clean = "00_Inbox";
  }

  return CREATIVE_FOLDER_ALIASES[clean] || clean || "00_Inbox";
}

export function canonicalVaultPath(value: string): string {
  const clean = normalizeSlashes(value).replace(/^vault\//i, "");
  if (!clean) return "00_Inbox/Nova Nota.md";

  const parts = clean.split("/").filter(Boolean);
  const fileName = parts.pop() || "Nova Nota.md";
  const folder = canonicalVaultFolder(parts.join("/"));
  return `${folder}/${fileName}`;
}

export function creativeCommitCandidates(payload: CreativeCommitPayload): CreativeCommitPayload[] {
  const folder = canonicalVaultFolder(payload.folder);
  const normalized = { ...payload, folder };
  const fallbackFolder = CREATIVE_FOLDER_FALLBACKS[folder];
  if (!fallbackFolder) return [normalized];
  return [normalized, { ...normalized, folder: fallbackFolder }];
}

export function isMissingCreativeFolderError(result: CreativeCommitResult | null | undefined): boolean {
  if (result?.success) return false;
  const message = String(result?.error || "").toLowerCase();
  return message.includes("pasta selecionada não existe") || message.includes("destino selecionado não é uma pasta válida");
}

export function requireSuccessfulCreativeCommit(result: CreativeCommitResult | null | undefined): CreativeCommitResult {
  if (result?.success) return result;
  throw new Error(String(result?.error || "O Vault não confirmou a gravação do conteúdo."));
}
