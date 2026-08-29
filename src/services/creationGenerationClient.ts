import type { ObsidianApiConfig, ObsidianNote } from "../types";
import { knowledgeContextService, type KnowledgeContextSource } from "./knowledge/KnowledgeContextService";
import { StorageManager } from "./storage/StorageManager";

const storage = StorageManager.getInstance();
let cachedSessionToken: string | null = null;

const DEFAULT_CONFIG: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "MarketingVault",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

export interface CreationIdeaRequest {
  objective: string;
  format: string;
  channel: string;
  theme?: string;
  customInstructions?: string;
  count?: number;
  /** Legacy caller compatibility only. Generative creation always uses the configured AI provider. */
  engineMode?: string;
  knowledgeNotes: ObsidianNote[];
}

export interface CreationScriptRequest {
  idea: string;
  format: string;
  platform: string;
  objective: string;
  customInstructions?: string;
  /** Legacy caller compatibility only. Generative creation always uses the configured AI provider. */
  engineMode?: string;
  knowledgeNotes: ObsidianNote[];
}

async function sessionHeaders(): Promise<Record<string, string>> {
  if (!cachedSessionToken) {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível abrir uma sessão segura com o backend local.");
    const data = await response.json().catch(() => ({}));
    cachedSessionToken = String(data?.token || "").trim() || null;
  }

  if (!cachedSessionToken) throw new Error("O backend local não forneceu um token de sessão válido.");
  return {
    "Content-Type": "application/json",
    "x-app-session-token": cachedSessionToken,
  };
}

async function aiHeaders(): Promise<Record<string, string>> {
  const headers = await sessionHeaders();
  const config = await storage.loadAIRequestConfig(DEFAULT_CONFIG);
  headers["x-ai-provider"] = config.provider;
  if (config.model.trim()) headers["x-ai-model"] = config.model.trim();
  if (config.apiKey.trim()) headers["x-ai-api-key"] = config.apiKey.trim();
  return headers;
}

async function selectKnowledge(
  notes: ObsidianNote[],
  query: string,
): Promise<{ knowledgeSources: KnowledgeContextSource[]; knowledgeWarning?: string }> {
  if (typeof window !== "undefined" && window.electronAPI?.queryKnowledge) {
    try {
      const response = await window.electronAPI.queryKnowledge(query, []);
      return { knowledgeSources: response.sources, knowledgeWarning: response.warning };
    } catch (error) {
      console.warn("Creation knowledge query via IPC failed; using in-memory selector.", error);
    }
  }

  const selection = knowledgeContextService.select({ query, notes });
  return { knowledgeSources: selection.sources, knowledgeWarning: selection.warning };
}

function rejectSyntheticFallback<T extends { wasFallback?: boolean; usedModel?: string }>(data: T): T {
  if (data?.wasFallback) {
    throw new Error(
      "O provedor de IA não respondeu com uma geração válida. O Nisti descartou o fallback sintético para não apresentar conteúdo inventado como resultado fundamentado.",
    );
  }
  return data;
}

async function postCreation<T extends { wasFallback?: boolean; usedModel?: string }>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const headers = await aiHeaders();
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.error || `Falha HTTP ${response.status} na geração criativa.`));
  }
  return rejectSyntheticFallback(data as T);
}

export const creationGenerationClient = {
  async generateIdeas(payload: CreationIdeaRequest): Promise<any> {
    const query = [
      "ideias de conteúdo",
      payload.objective,
      payload.format,
      payload.channel,
      payload.theme || "",
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);

    return await postCreation("/api/ai/generate-ideas", {
      objective: payload.objective,
      format: payload.format,
      channel: payload.channel,
      theme: payload.theme || "",
      customInstructions: payload.customInstructions || "",
      count: payload.count || 3,
      ...knowledge,
    });
  },

  async generateScript(payload: CreationScriptRequest): Promise<any> {
    const query = [
      "roteiro de conteúdo",
      payload.idea,
      payload.objective,
      payload.format,
      payload.platform,
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);

    return await postCreation("/api/ai/generate-script", {
      idea: payload.idea,
      format: payload.format,
      platform: payload.platform,
      objective: payload.objective,
      customInstructions: payload.customInstructions || "",
      ...knowledge,
    });
  },
};
