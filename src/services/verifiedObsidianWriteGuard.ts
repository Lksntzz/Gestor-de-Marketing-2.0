import type { ObsidianApiConfig } from "../types";
import { parseMarkdownDocument } from "../utils/markdownFrontmatter";
import { serializeMarkdownNote } from "../utils/obsidianUri";
import {
  encodeVaultRelativePath,
  qualifyNistiKnowledgePath,
} from "./obsidianKnowledgeAutomation";

interface ObsidianWriteApi {
  pushNoteToObsidian: (
    config: ObsidianApiConfig,
    filePath: string,
    markdownContent: string,
    frontmatter?: Record<string, unknown>,
  ) => Promise<any>;
}

interface ProxyResult {
  response: Response;
  data: any;
}

let cachedSessionToken = "";

function normalizeEndpoint(endpoint?: string): string {
  let clean = String(endpoint || "").trim();
  if (!clean) return "https://127.0.0.1:27124";
  if (!/^https?:\/\//i.test(clean)) {
    clean = clean.includes("27123") ? `http://${clean}` : `https://${clean}`;
  }
  return clean.replace(/\/+$/, "");
}

async function getSessionToken(): Promise<string> {
  if (cachedSessionToken) return cachedSessionToken;
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível abrir a sessão local segura para gravar no Obsidian.");
  const data = await response.json().catch(() => ({}));
  const token = String(data?.token || "").trim();
  if (!token) throw new Error("A sessão local segura não retornou um token válido.");
  cachedSessionToken = token;
  return token;
}

async function proxyRequest(
  config: ObsidianApiConfig,
  method: "GET" | "PUT",
  path: string,
  body?: string,
): Promise<ProxyResult> {
  const token = await getSessionToken();
  const response = await fetch("/api/obsidian/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-session-token": token,
    },
    body: JSON.stringify({
      endpoint: normalizeEndpoint(config.endpoint),
      apiKey: config.apiKey || "saved-in-secure-storage",
      method,
      path,
      body,
      headers: body !== undefined ? { "Content-Type": "text/markdown; charset=utf-8" } : {},
    }),
  });
  const data = await response.json().catch(() => ({
    success: false,
    status: response.status,
    message: `Proxy do Obsidian retornou HTTP ${response.status}.`,
  }));
  return { response, data };
}

function proxyStatus(result: ProxyResult): number {
  return Number(result.data?.status || result.response.status || 0);
}

function proxySucceeded(result: ProxyResult): boolean {
  return Boolean(result.response.ok && result.data?.success);
}

function proxyText(result: ProxyResult): string {
  const value = result.data?.data;
  if (typeof value === "string") return value;
  if (typeof value?.data === "string") return value.data;
  return "";
}

function normalizeMarkdown(value: string): string {
  return String(value || "").replace(/\r\n/g, "\n").trimEnd();
}

function markdownBody(value: string): string {
  return normalizeMarkdown(parseMarkdownDocument(value).body);
}

export async function writeVerifiedObsidianNote(
  config: ObsidianApiConfig,
  filePath: string,
  markdownContent: string,
  frontmatter?: Record<string, unknown>,
): Promise<{ success: boolean; message: string; path?: string; status?: number }> {
  const qualifiedPath = qualifyNistiKnowledgePath(filePath);
  const targetPath = `/vault/${encodeVaultRelativePath(qualifiedPath)}`;
  const payloadMarkdown = markdownContent.trimStart().startsWith("---")
    ? markdownContent
    : serializeMarkdownNote(frontmatter || {}, markdownContent);

  const before = await proxyRequest(config, "GET", targetPath);
  const beforeStatus = proxyStatus(before);
  if (proxySucceeded(before)) {
    return {
      success: false,
      path: qualifiedPath,
      status: beforeStatus,
      message: `Já existe uma nota em ${qualifiedPath}. A gravação foi bloqueada para evitar sobrescrita ou anexação silenciosa.`,
    };
  }
  if (beforeStatus !== 404) {
    return {
      success: false,
      path: qualifiedPath,
      status: beforeStatus,
      message: before.data?.message || before.data?.error || "Não foi possível confirmar que o caminho está livre no Vault autenticado.",
    };
  }

  const write = await proxyRequest(config, "PUT", targetPath, payloadMarkdown);
  if (!proxySucceeded(write)) {
    return {
      success: false,
      path: qualifiedPath,
      status: proxyStatus(write),
      message: write.data?.message || write.data?.error || "O Obsidian não confirmou a gravação.",
    };
  }

  const after = await proxyRequest(config, "GET", targetPath);
  if (!proxySucceeded(after)) {
    return {
      success: false,
      path: qualifiedPath,
      status: proxyStatus(after),
      message: "O Obsidian aceitou a escrita, mas o arquivo não pôde ser relido no mesmo Vault autenticado.",
    };
  }

  const persistedMarkdown = proxyText(after);
  if (!persistedMarkdown || markdownBody(persistedMarkdown) !== markdownBody(payloadMarkdown)) {
    return {
      success: false,
      path: qualifiedPath,
      status: proxyStatus(after),
      message: "A releitura do Obsidian não corresponde ao conteúdo solicitado. O sucesso foi recusado para evitar falso positivo.",
    };
  }

  return {
    success: true,
    path: qualifiedPath,
    status: proxyStatus(after),
    message: `Gravação confirmada por releitura do Obsidian em ${qualifiedPath}.`,
  };
}

export function installVerifiedObsidianWriteGuard(api: ObsidianWriteApi): void {
  const original = api.pushNoteToObsidian.bind(api);
  api.pushNoteToObsidian = async (config, filePath, markdownContent, frontmatter) => {
    // Browser mode keeps the existing direct-client behavior. The Windows desktop
    // uses REST-first exclusively so a stale physical Vault path cannot receive a write.
    if (typeof window === "undefined" || !window.electronAPI) {
      return original(config, filePath, markdownContent, frontmatter);
    }
    try {
      return await writeVerifiedObsidianNote(config, filePath, markdownContent, frontmatter);
    } catch (error: any) {
      return {
        success: false,
        message: error?.message || "Falha ao verificar a gravação no Vault autenticado.",
      };
    }
  };
}
