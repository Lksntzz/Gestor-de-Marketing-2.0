import type { ObsidianApiConfig } from "../types";
import { StorageManager } from "./storage/StorageManager";

const storage = StorageManager.getInstance();

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

export interface EditorialPlanningPayload {
  weekStart: string;
  count: number;
  platforms: string[];
  formats: string[];
  objectives: string[];
  customInstructions?: string;
  existingItems: Array<{
    title: string;
    date: string;
    time?: string;
    platform: string;
    format: string;
    objective: string;
  }>;
  engineMode: string;
}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  const [sessionResponse, aiConfig] = await Promise.all([
    fetch("/api/auth/session", { cache: "no-store" }),
    storage.loadAIRequestConfig(DEFAULT_CONFIG),
  ]);

  const session = sessionResponse.ok ? await sessionResponse.json().catch(() => ({})) : {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-ai-provider": aiConfig.provider,
  };

  if (session?.token) headers["x-app-session-token"] = String(session.token);
  if (aiConfig.model) headers["x-ai-model"] = aiConfig.model;
  if (aiConfig.apiKey.trim()) headers["x-ai-api-key"] = aiConfig.apiKey.trim();
  return headers;
}

export async function generateEditorialPlanSuggestions(payload: EditorialPlanningPayload): Promise<any> {
  if (payload.engineMode === "local") {
    return {
      success: true,
      data: [],
      warning: "O modo local não fabrica agenda editorial. Configure e ative um provedor de IA para gerar sugestões.",
      wasFallback: false,
    };
  }

  const headers = await authenticatedHeaders();
  if (!headers["x-ai-api-key"]) {
    throw new Error("Configure a chave do provedor de IA antes de gerar sugestões editoriais.");
  }

  const response = await fetch("/api/ai/plan-week", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Planejamento editorial retornou HTTP ${response.status}.`);
  }

  if (data?.wasFallback) {
    return {
      ...data,
      data: [],
      warning: data?.warning || "O provedor de IA falhou. O fallback sintético foi descartado e nada foi aplicado ao calendário.",
    };
  }

  return data;
}
