import type { LearningInsight, ObsidianApiConfig, ObsidianNote, PostHistoryItem } from "../types";
import { knowledgeContextService } from "./knowledge/KnowledgeContextService";
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

export interface LearningSynthesisResponse {
  executiveSummary: string;
  strengthsAndWins: string[];
  weaknessesAndRisks: string[];
  validatedRules: Array<{
    title: string;
    category: "formato" | "canal" | "copy" | "oferta" | "audiência";
    verdict: "CONFIRMADO" | "REFUTADO" | "EM_TESTE";
    ruleOfThumb: string;
    evidenceData: string;
    suggestedAction: string;
  }>;
  hypothesesToTest: string[];
  nextCyclePriorities: string[];
  epistemicStatus?: string;
  usedModel?: string;
  usedProvider?: string;
}

export async function requestLearningSynthesis(payload: {
  postHistory: PostHistoryItem[];
  existingLearnings: LearningInsight[];
  knowledgeNotes: ObsidianNote[];
  customFocus?: string;
  engineMode?: string;
  apiConfig?: ObsidianApiConfig;
}): Promise<LearningSynthesisResponse> {
  const cfg = payload.apiConfig || DEFAULT_CONFIG;
  const selection = knowledgeContextService.select({
    query: `Síntese de aprendizados, métricas de performance e validação epistêmica de marketing ${payload.customFocus || ""}`,
    notes: payload.knowledgeNotes || [],
  });

  const headers = await sessionHeaders();
  const provider = cfg.aiProvider || "gemini";
  const model = cfg.aiModel || "";

  const response = await fetch("/api/ai/synthesize-learnings", {
    method: "POST",
    headers: {
      ...headers,
      "x-ai-provider": provider,
      "x-ai-model": model,
    },
    body: JSON.stringify({
      postHistory: payload.postHistory,
      existingLearnings: payload.existingLearnings,
      knowledgeSources: selection.sources,
      customFocus: payload.customFocus || "",
      engineMode: payload.engineMode || "hybrid",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na síntese de aprendizados (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "A IA não retornou uma síntese válida.");
  }

  return {
    ...json.data,
    usedModel: json.usedModel,
    usedProvider: json.usedProvider,
  };
}
