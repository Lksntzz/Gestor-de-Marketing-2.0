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

const CREATIVE_FOLDER_ALIASES: Record<string, string> = {
  "02_Conteudo/Copies": "03_Conteudos/Copies",
};

const CREATIVE_FOLDER_FALLBACKS: Record<string, string> = {
  "03_Conteudos/Ideias": "03_Conteudos",
  "03_Conteudos/Roteiros": "03_Conteudos",
  "03_Conteudos/Copies": "03_Conteudos",
};

function normalizeFolder(value: string): string {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

export function creativeCommitCandidates(payload: CreativeCommitPayload): CreativeCommitPayload[] {
  const requestedFolder = normalizeFolder(payload.folder);
  const folder = CREATIVE_FOLDER_ALIASES[requestedFolder] || requestedFolder;
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
