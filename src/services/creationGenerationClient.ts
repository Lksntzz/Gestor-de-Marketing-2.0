import type { ObsidianApiConfig, ObsidianNote } from "../types";
import { preferredPlanningSourcePaths } from "../domain/smartKnowledgeStage2";
import { knowledgeContextService, type KnowledgeContextSource } from "./knowledge/KnowledgeContextService";
import { StorageManager } from "./storage/StorageManager";
import {
  CREATION_AI_MAX_ATTEMPTS,
  creationAIErrorMessage,
  creationAIRetryDelayMs,
  isRetryableCreationAIErrorCode,
} from "./ai/creationRequestRetry";

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

type CreationResponseMeta = {
  wasFallback?: boolean;
  usedModel?: string;
  warning?: string;
  errorCode?: string;
};

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
  const preferredSourcePaths = preferredPlanningSourcePaths(notes);
  if (typeof window !== "undefined" && window.electronAPI?.queryKnowledge) {
    try {
      const response = await window.electronAPI.queryKnowledge(query, preferredSourcePaths);
      if (Array.isArray(response?.sources) && response.sources.length > 0) {
        return { knowledgeSources: response.sources, knowledgeWarning: response.warning };
      }
      if (notes.length === 0) {
        return { knowledgeSources: [], knowledgeWarning: response?.warning };
      }
      console.warn("Electron knowledge index returned no sources; using the REST Vault snapshot in memory.");
    } catch (error) {
      console.warn("Creation knowledge query via IPC failed; using in-memory selector.", error);
    }
  }

  const selection = knowledgeContextService.select({ query, notes, preferredSourcePaths });
  return { knowledgeSources: selection.sources, knowledgeWarning: selection.warning };
}

function requireGroundedKnowledge(
  knowledge: { knowledgeSources: KnowledgeContextSource[]; knowledgeWarning?: string },
): void {
  if (knowledge.knowledgeSources.length > 0) return;
  throw new Error(
    knowledge.knowledgeWarning
      || "O planejamento foi bloqueado porque nenhuma evidência relevante foi encontrada em Estratégia, Produtos, Conteúdos, Pesquisas ou Aprendizados do Obsidian.",
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postCreation<T extends CreationResponseMeta>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  const headers = await aiHeaders();
  let lastMessage = "O provedor de IA não respondeu com uma geração válida.";

  for (let attempt = 1; attempt <= CREATION_AI_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = String(data?.code || "UNKNOWN").toUpperCase();
        lastMessage = creationAIErrorMessage({
          error: data?.error,
          errorCode: code,
          status: response.status,
        });
        if (attempt < CREATION_AI_MAX_ATTEMPTS && isRetryableCreationAIErrorCode(code)) {
          await wait(creationAIRetryDelayMs(attempt));
          continue;
        }
        throw new Error(lastMessage);
      }

      if (data?.wasFallback) {
        const code = String(data?.errorCode || "UNKNOWN").toUpperCase();
        lastMessage = creationAIErrorMessage({
          warning: data?.warning,
          errorCode: code,
        });
        if (attempt < CREATION_AI_MAX_ATTEMPTS && isRetryableCreationAIErrorCode(code)) {
          await wait(creationAIRetryDelayMs(attempt));
          continue;
        }
        throw new Error(lastMessage);
      }

      return data as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (message === lastMessage) throw error;
      lastMessage = message || "Falha de rede ao chamar o provedor de IA.";
      if (attempt >= CREATION_AI_MAX_ATTEMPTS) throw new Error(lastMessage);
      await wait(creationAIRetryDelayMs(attempt));
    }
  }

  throw new Error(lastMessage);
}

export const creationGenerationClient = {
  async generateIdeas(payload: CreationIdeaRequest): Promise<any> {
    const query = [
      "planejamento ideias de conteúdo estratégia produto pesquisa aprendizados resultados performance",
      payload.objective,
      payload.format,
      payload.channel,
      payload.theme || "",
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);
    requireGroundedKnowledge(knowledge);

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
      "roteiro de conteúdo estratégia produto pesquisa aprendizados resultados performance",
      payload.idea,
      payload.objective,
      payload.format,
      payload.platform,
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);
    requireGroundedKnowledge(knowledge);

    return await postCreation("/api/ai/generate-script", {
      idea: payload.idea,
      format: payload.format,
      platform: payload.platform,
      objective: payload.objective,
      customInstructions: payload.customInstructions || "",
      ...knowledge,
    });
  },

  async generateCopywriting(payload: {
    title: string;
    format: string;
    channel: string;
    objective: string;
    framework?: string;
    targetAudience?: string;
    tone?: string;
    customInstructions?: string;
    knowledgeNotes: ObsidianNote[];
  }): Promise<any> {
    const query = [
      "copywriting redação texto estratégia produto pesquisa aprendizados resultados performance",
      payload.title,
      payload.objective,
      payload.format,
      payload.channel,
      payload.targetAudience || "",
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);
    requireGroundedKnowledge(knowledge);

    return await postCreation("/api/ai/generate-copywriting", {
      title: payload.title,
      format: payload.format,
      channel: payload.channel,
      objective: payload.objective,
      framework: payload.framework || "DIRECT_RESPONSE",
      targetAudience: payload.targetAudience || "",
      tone: payload.tone || "",
      customInstructions: payload.customInstructions || "",
      ...knowledge,
    });
  },

  async analyzeCreativeAsset(payload: {
    title: string;
    imageBase64: string;
    objective?: string;
    customInstructions?: string;
    knowledgeNotes: ObsidianNote[];
  }): Promise<any> {
    const query = [
      "ativo visual imagem análise",
      payload.title,
      payload.objective || "",
      payload.customInstructions || "",
    ].filter(Boolean).join(" ");
    const knowledge = await selectKnowledge(payload.knowledgeNotes, query);

    return await postCreation("/api/ai/analyze-asset", {
      title: payload.title,
      imageBase64: payload.imageBase64,
      objective: payload.objective || "",
      customInstructions: payload.customInstructions || "",
      ...knowledge,
    });
  },
};
