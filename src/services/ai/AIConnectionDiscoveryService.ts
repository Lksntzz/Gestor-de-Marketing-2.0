import {
  AI_CONNECTION_SCHEMA_VERSION,
  type AIConnectionProvider,
  type AIConnectionStatus,
  type AISecretReference,
  type PersistedAIConnectionState,
} from "../../domain/aiConnection";
import { generateUUID } from "../../utils/crypto";

export const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
export const GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface DiscoveredAIModel {
  id: string;
  displayName?: string;
  ownedBy?: string;
  supportedActions?: string[];
}

export interface AIProviderDiscoveryRequest {
  provider: AIConnectionProvider;
  apiKey: string;
  currentState?: PersistedAIConnectionState | null;
  secretRef?: AISecretReference;
}

export interface AIProviderDiscoverySuccess {
  success: true;
  provider: AIConnectionProvider;
  models: DiscoveredAIModel[];
  state: PersistedAIConnectionState;
}

export interface AIProviderDiscoveryFailure {
  success: false;
  provider: AIConnectionProvider;
  models: [];
  state: PersistedAIConnectionState;
  message: string;
}

export type AIProviderDiscoveryResult = AIProviderDiscoverySuccess | AIProviderDiscoveryFailure;

type FetchLike = typeof fetch;

type ServiceOptions = {
  fetchImpl?: FetchLike;
  now?: () => string;
  idFactory?: () => string;
};

function defaultSecretRef(provider: AIConnectionProvider): AISecretReference {
  return provider === "openai" ? "legacy:openaiApiKey" : "legacy:geminiApiKey";
}

function resolveSecretRef(
  provider: AIConnectionProvider,
  requested: AISecretReference | undefined,
  current: AISecretReference | undefined,
): AISecretReference {
  const candidate = requested || current;
  if (candidate === "active:aiConnectionKey") return candidate;
  if (provider === "openai" && candidate === "legacy:openaiApiKey") return candidate;
  if (provider === "gemini" && candidate === "legacy:geminiApiKey") return candidate;
  return defaultSecretRef(provider);
}

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueSortedModels(models: DiscoveredAIModel[]): DiscoveredAIModel[] {
  const byId = new Map<string, DiscoveredAIModel>();
  for (const model of models) {
    const id = sanitizeText(model.id);
    if (!id || byId.has(id)) continue;
    byId.set(id, { ...model, id });
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function inspectProviderError(payload: unknown): string {
  try {
    return JSON.stringify(payload).toLowerCase();
  } catch {
    return "";
  }
}

function failureStatus(status: number | undefined, payload: unknown): Exclude<
  AIConnectionStatus,
  | "SEM_CHAVE"
  | "ANALISANDO_LOCALMENTE"
  | "PROVEDOR_POSSIVEL"
  | "AGUARDANDO_CONFIRMACAO_DE_PROVEDOR"
  | "VALIDANDO_CREDENCIAL"
  | "CHAVE_CONFIRMADA"
  | "DESCOBRINDO_MODELOS"
  | "AGUARDANDO_MODELO"
  | "VALIDANDO_MODELO"
  | "CONEXAO_ATIVA"
> {
  const detail = inspectProviderError(payload);
  if (
    status === 401 ||
    /invalid[_ -]?api[_ -]?key|api[_ -]?key[_ -]?invalid|incorrect api key|invalid credential/.test(detail)
  ) {
    return "CHAVE_INVALIDA";
  }
  if (status === 403) return "SEM_PERMISSAO";
  if (status === 429) return "LIMITE_OU_COTA";
  return "PROVEDOR_INDISPONIVEL";
}

function failureMessage(status: AIProviderDiscoveryFailure["state"]["status"]): string {
  switch (status) {
    case "CHAVE_INVALIDA":
      return "A credencial foi rejeitada pelo provedor selecionado.";
    case "SEM_PERMISSAO":
      return "A credencial não possui acesso a modelos de geração utilizáveis.";
    case "LIMITE_OU_COTA":
      return "O provedor recusou temporariamente a descoberta por limite ou cota.";
    default:
      return "Não foi possível confirmar o provedor e descobrir modelos neste momento.";
  }
}

function failureState(
  provider: AIConnectionProvider,
  status: ReturnType<typeof failureStatus>,
  secretRef: AISecretReference,
  currentState?: PersistedAIConnectionState | null,
): PersistedAIConnectionState {
  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status,
    providerCandidate: provider,
    secretRef,
    ...(currentState?.modelCandidate ? { modelCandidate: currentState.modelCandidate } : {}),
  };
}

function parseOpenAIModels(payload: unknown): DiscoveredAIModel[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return uniqueSortedModels(data.map((item): DiscoveredAIModel | null => {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const id = sanitizeText(source.id);
    if (!id) return null;
    const ownedBy = sanitizeText(source.owned_by);
    return {
      id,
      ...(ownedBy ? { ownedBy } : {}),
    };
  }).filter((item): item is DiscoveredAIModel => item !== null));
}

function parseGeminiModels(payload: unknown): DiscoveredAIModel[] {
  if (!payload || typeof payload !== "object") return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  return uniqueSortedModels(models.map((item): DiscoveredAIModel | null => {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const rawName = sanitizeText(source.name);
    if (!rawName) return null;

    const actionsInput = Array.isArray(source.supportedGenerationMethods)
      ? source.supportedGenerationMethods
      : Array.isArray(source.supportedActions)
        ? source.supportedActions
        : [];
    const supportedActions = actionsInput
      .map((value) => sanitizeText(value))
      .filter(Boolean);

    if (!supportedActions.includes("generateContent")) return null;

    const id = rawName.startsWith("models/") ? rawName.slice("models/".length) : rawName;
    const displayName = sanitizeText(source.displayName);
    return {
      id,
      ...(displayName ? { displayName } : {}),
      supportedActions: Array.from(new Set(supportedActions)).sort(),
    };
  }).filter((item): item is DiscoveredAIModel => item !== null));
}

export class AIConnectionDiscoveryService {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => string;
  private readonly idFactory: () => string;

  constructor(options: ServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.now = options.now || (() => new Date().toISOString());
    this.idFactory = options.idFactory || (() => `ai_${generateUUID()}`);
  }

  async confirmProviderAndDiscoverModels(
    request: AIProviderDiscoveryRequest,
  ): Promise<AIProviderDiscoveryResult> {
    const apiKey = request.apiKey.trim();
    const secretRef = resolveSecretRef(request.provider, request.secretRef, request.currentState?.secretRef);

    if (!apiKey) {
      return {
        success: false,
        provider: request.provider,
        models: [],
        state: {
          schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
          status: "SEM_CHAVE",
          providerCandidate: request.provider,
        },
        message: "Informe uma credencial antes de confirmar o provedor.",
      };
    }

    try {
      const models = request.provider === "openai"
        ? await this.discoverOpenAIModels(apiKey)
        : await this.discoverGeminiModels(apiKey);

      if (models.length === 0) {
        const status = "SEM_PERMISSAO" as const;
        return {
          success: false,
          provider: request.provider,
          models: [],
          state: failureState(request.provider, status, secretRef, request.currentState),
          message: failureMessage(status),
        };
      }

      const state: PersistedAIConnectionState = {
        schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
        status: "AGUARDANDO_MODELO",
        connectionId: request.currentState?.connectionId || this.idFactory(),
        provider: request.provider,
        secretRef,
        credentialConfirmedAt: this.now(),
        ...(request.currentState?.modelCandidate ? { modelCandidate: request.currentState.modelCandidate } : {}),
      };

      return {
        success: true,
        provider: request.provider,
        models,
        state,
      };
    } catch (error) {
      const failure = error as { httpStatus?: number; payload?: unknown };
      const status = failureStatus(failure?.httpStatus, failure?.payload);
      return {
        success: false,
        provider: request.provider,
        models: [],
        state: failureState(request.provider, status, secretRef, request.currentState),
        message: failureMessage(status),
      };
    }
  }

  private async discoverOpenAIModels(apiKey: string): Promise<DiscoveredAIModel[]> {
    const response = await this.fetchImpl(OPENAI_MODELS_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "nisti-marketing-2.0",
      },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw this.httpFailure(response.status, payload);
    return parseOpenAIModels(payload);
  }

  private async discoverGeminiModels(apiKey: string): Promise<DiscoveredAIModel[]> {
    const models: DiscoveredAIModel[] = [];
    let pageToken = "";
    let pageCount = 0;

    do {
      if (pageCount >= 20) {
        throw this.httpFailure(undefined, { reason: "pagination_limit" });
      }
      const url = pageToken
        ? `${GEMINI_MODELS_ENDPOINT}?pageToken=${encodeURIComponent(pageToken)}`
        : GEMINI_MODELS_ENDPOINT;
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
          "x-goog-api-client": "nisti-marketing/2.2.1",
          "User-Agent": "nisti-marketing-2.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw this.httpFailure(response.status, payload);
      models.push(...parseGeminiModels(payload));
      pageToken = sanitizeText(payload.nextPageToken);
      pageCount += 1;
    } while (pageToken);

    return uniqueSortedModels(models);
  }

  private httpFailure(status: number | undefined, payload: unknown): Error & { httpStatus?: number; payload?: unknown } {
    const error = new Error("AI provider discovery failed") as Error & { httpStatus?: number; payload?: unknown };
    error.httpStatus = status;
    error.payload = payload;
    return error;
  }
}
