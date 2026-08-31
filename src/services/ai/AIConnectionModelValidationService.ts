import {
  AI_CONNECTION_SCHEMA_VERSION,
  parsePersistedAIConnection,
  type AIConnectionProvider,
  type AISecretReference,
  type PersistedAIConnectionState,
} from "../../domain/aiConnection";
import {
  AIProviderError,
  type AIProvider,
  type AIProviderConfig,
} from "./AIProvider";
import { AIProviderFactory } from "./AIProviderFactory";
import type { DiscoveredAIModel } from "./AIConnectionDiscoveryService";

export type AIModelValidationFailureCode =
  | "MISSING_KEY"
  | "INVALID_STATE"
  | "MODEL_NOT_DISCOVERED"
  | "INVALID_MODEL"
  | "CHAVE_INVALIDA"
  | "SEM_PERMISSAO"
  | "LIMITE_OU_COTA"
  | "PROVEDOR_INDISPONIVEL";

export interface AIModelValidationRequest {
  provider: AIConnectionProvider;
  apiKey: string;
  model: string;
  discoveredModels: readonly DiscoveredAIModel[];
  currentState: PersistedAIConnectionState;
}

export interface AIModelValidationSuccess {
  success: true;
  provider: AIConnectionProvider;
  model: string;
  state: PersistedAIConnectionState;
}

export interface AIModelValidationFailure {
  success: false;
  provider: AIConnectionProvider;
  model?: string;
  code: AIModelValidationFailureCode;
  message: string;
  state: PersistedAIConnectionState;
}

export type AIModelValidationResult = AIModelValidationSuccess | AIModelValidationFailure;

type ModelTestProvider = Pick<AIProvider, "testConnection">;
type ProviderFactory = (config: AIProviderConfig) => ModelTestProvider;

type ServiceOptions = {
  providerFactory?: ProviderFactory;
  now?: () => string;
};

const VALIDATABLE_STATUSES = new Set<PersistedAIConnectionState["status"]>([
  "AGUARDANDO_MODELO",
  "VALIDANDO_MODELO",
  "SEM_PERMISSAO",
  "LIMITE_OU_COTA",
  "PROVEDOR_INDISPONIVEL",
  "CONEXAO_ATIVA",
]);

function secretRefMatchesProvider(provider: AIConnectionProvider, secretRef: AISecretReference): boolean {
  if (secretRef === "active:aiConnectionKey") return true;
  if (provider === "openai") return secretRef === "legacy:openaiApiKey";
  return secretRef === "legacy:geminiApiKey";
}

function sanitizeModel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 200);
}

function isDiscoveredModel(model: string, discoveredModels: readonly DiscoveredAIModel[]): boolean {
  return discoveredModels.some((item) => sanitizeModel(item?.id) === model);
}

function isConfirmedProviderState(
  state: PersistedAIConnectionState,
  provider: AIConnectionProvider,
): boolean {
  return Boolean(
    VALIDATABLE_STATUSES.has(state.status) &&
      state.connectionId &&
      state.provider === provider &&
      state.secretRef &&
      secretRefMatchesProvider(provider, state.secretRef) &&
      state.credentialConfirmedAt,
  );
}

function isActiveState(state: PersistedAIConnectionState): boolean {
  return state.status === "CONEXAO_ATIVA";
}

function confirmedPendingState(
  state: PersistedAIConnectionState,
  status: Extract<
    PersistedAIConnectionState["status"],
    "AGUARDANDO_MODELO" | "SEM_PERMISSAO" | "LIMITE_OU_COTA" | "PROVEDOR_INDISPONIVEL"
  >,
  modelCandidate?: string,
): PersistedAIConnectionState {
  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status,
    connectionId: state.connectionId,
    provider: state.provider,
    secretRef: state.secretRef,
    credentialConfirmedAt: state.credentialConfirmedAt,
    ...(modelCandidate ? { modelCandidate } : {}),
  };
}

function invalidCredentialState(
  provider: AIConnectionProvider,
  secretRef: AISecretReference | undefined,
): PersistedAIConnectionState {
  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status: "CHAVE_INVALIDA",
    providerCandidate: provider,
    ...(secretRef && secretRefMatchesProvider(provider, secretRef) ? { secretRef } : {}),
  };
}

function publicMessage(code: AIModelValidationFailureCode): string {
  switch (code) {
    case "MISSING_KEY":
      return "A credencial não está disponível para validar o modelo.";
    case "INVALID_STATE":
      return "A conexão ainda não possui provedor e credencial confirmados para validar um modelo.";
    case "MODEL_NOT_DISCOVERED":
      return "O modelo selecionado não pertence à descoberta atual desta conexão.";
    case "INVALID_MODEL":
      return "O modelo selecionado não pôde ser validado para esta conexão.";
    case "CHAVE_INVALIDA":
      return "A credencial foi rejeitada pelo provedor durante a validação do modelo.";
    case "SEM_PERMISSAO":
      return "A credencial não possui permissão para usar o modelo selecionado.";
    case "LIMITE_OU_COTA":
      return "O provedor recusou temporariamente o teste por limite ou cota.";
    default:
      return "O provedor está temporariamente indisponível para validar o modelo.";
  }
}

function classifyProviderFailure(error: unknown): AIModelValidationFailureCode {
  if (!(error instanceof AIProviderError)) return "PROVEDOR_INDISPONIVEL";
  if (error.code === "INVALID_MODEL") return "INVALID_MODEL";
  if (error.code === "RATE_LIMIT") return "LIMITE_OU_COTA";
  if (error.code === "SERVICE_UNAVAILABLE") return "PROVEDOR_INDISPONIVEL";
  if (error.code === "INVALID_API_KEY") {
    return error.status === 403 ? "SEM_PERMISSAO" : "CHAVE_INVALIDA";
  }
  return "PROVEDOR_INDISPONIVEL";
}

export class AIConnectionModelValidationService {
  private readonly providerFactory: ProviderFactory;
  private readonly now: () => string;

  constructor(options: ServiceOptions = {}) {
    this.providerFactory = options.providerFactory || ((config) => AIProviderFactory.create(config));
    this.now = options.now || (() => new Date().toISOString());
  }

  async validateAndActivate(request: AIModelValidationRequest): Promise<AIModelValidationResult> {
    const parsedState = parsePersistedAIConnection(request.currentState);
    const model = sanitizeModel(request.model);
    const apiKey = typeof request.apiKey === "string" ? request.apiKey.trim() : "";

    if (!parsedState || !isConfirmedProviderState(parsedState, request.provider)) {
      return {
        success: false,
        provider: request.provider,
        ...(model ? { model } : {}),
        code: "INVALID_STATE",
        message: publicMessage("INVALID_STATE"),
        state: parsedState || {
          schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
          status: "SEM_CHAVE",
        },
      };
    }

    if (!apiKey) {
      return {
        success: false,
        provider: request.provider,
        ...(model ? { model } : {}),
        code: "MISSING_KEY",
        message: publicMessage("MISSING_KEY"),
        state: parsedState,
      };
    }

    if (!model || !isDiscoveredModel(model, request.discoveredModels)) {
      return {
        success: false,
        provider: request.provider,
        ...(model ? { model } : {}),
        code: "MODEL_NOT_DISCOVERED",
        message: publicMessage("MODEL_NOT_DISCOVERED"),
        state: parsedState,
      };
    }

    try {
      const provider = this.providerFactory({
        provider: request.provider,
        apiKey,
        model,
      });
      const tested = await provider.testConnection();

      if (tested.provider !== request.provider) {
        return {
          success: false,
          provider: request.provider,
          model,
          code: "PROVEDOR_INDISPONIVEL",
          message: publicMessage("PROVEDOR_INDISPONIVEL"),
          state: parsedState,
        };
      }

      const activeState: PersistedAIConnectionState = {
        schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
        status: "CONEXAO_ATIVA",
        connectionId: parsedState.connectionId,
        provider: request.provider,
        model,
        secretRef: parsedState.secretRef,
        capabilities: ["text_generation"],
        credentialConfirmedAt: parsedState.credentialConfirmedAt,
        modelConfirmedAt: this.now(),
      };

      return {
        success: true,
        provider: request.provider,
        model,
        state: activeState,
      };
    } catch (error) {
      const code = classifyProviderFailure(error);

      if (code === "CHAVE_INVALIDA") {
        const state = invalidCredentialState(request.provider, parsedState.secretRef);
        return {
          success: false,
          provider: request.provider,
          model,
          code,
          message: publicMessage(code),
          state,
        };
      }

      if (isActiveState(parsedState)) {
        return {
          success: false,
          provider: request.provider,
          model,
          code,
          message: publicMessage(code),
          state: parsedState,
        };
      }

      const status = code === "INVALID_MODEL"
        ? "AGUARDANDO_MODELO"
        : code === "SEM_PERMISSAO"
          ? "SEM_PERMISSAO"
          : code === "LIMITE_OU_COTA"
            ? "LIMITE_OU_COTA"
            : "PROVEDOR_INDISPONIVEL";

      return {
        success: false,
        provider: request.provider,
        model,
        code,
        message: publicMessage(code),
        state: confirmedPendingState(parsedState, status, model),
      };
    }
  }
}
