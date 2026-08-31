import {
  AI_CONNECTION_SCHEMA_VERSION,
  createEmptyAIConnection,
  parsePersistedAIConnection,
  type AIConnectionProvider,
  type AISecretReference,
  type PersistedAIConnectionState,
} from "../../domain/aiConnection";
import {
  AIConnectionDiscoveryService,
  type AIProviderDiscoveryFailure,
  type AIProviderDiscoveryResult,
  type DiscoveredAIModel,
} from "./AIConnectionDiscoveryService";
import {
  AIConnectionModelValidationService,
  type AIModelValidationFailure,
  type AIModelValidationResult,
} from "./AIConnectionModelValidationService";

export interface AIConnectionRuntimeProposal {
  provider: AIConnectionProvider;
  state: PersistedAIConnectionState;
  models: DiscoveredAIModel[];
}

export interface AIConnectionRuntimeSnapshot {
  state: PersistedAIConnectionState;
  proposal?: AIConnectionRuntimeProposal;
}

export interface AIConnectionRuntimeOperationResult extends AIConnectionRuntimeSnapshot {
  success: boolean;
  provider?: AIConnectionProvider;
  model?: string;
  message?: string;
  code?: string;
}

type Discovery = Pick<AIConnectionDiscoveryService, "confirmProviderAndDiscoverModels">;
type Validator = Pick<AIConnectionModelValidationService, "validateAndActivate">;

type RuntimeOptions = {
  loadState: () => Promise<PersistedAIConnectionState>;
  persistState: (state: PersistedAIConnectionState) => Promise<PersistedAIConnectionState>;
  readSecret: (secretRef: AISecretReference) => Promise<string>;
  discovery?: Discovery;
  validator?: Validator;
};

function legacySecretRef(provider: AIConnectionProvider): AISecretReference {
  return provider === "openai" ? "legacy:openaiApiKey" : "legacy:geminiApiKey";
}

function secretRefMatchesProvider(provider: AIConnectionProvider, secretRef: AISecretReference | undefined): boolean {
  if (!secretRef) return false;
  if (secretRef === "active:aiConnectionKey") return true;
  if (provider === "openai") return secretRef === "legacy:openaiApiKey";
  return secretRef === "legacy:geminiApiKey";
}

function resolveSecretRef(
  provider: AIConnectionProvider,
  state: PersistedAIConnectionState,
): AISecretReference {
  const stateProvider = state.provider ?? state.providerCandidate;
  if (stateProvider === provider && secretRefMatchesProvider(provider, state.secretRef)) {
    return state.secretRef as AISecretReference;
  }
  return legacySecretRef(provider);
}

function sameCredential(
  state: PersistedAIConnectionState,
  provider: AIConnectionProvider,
  secretRef: AISecretReference,
): boolean {
  return state.provider === provider && state.secretRef === secretRef;
}

function isActive(state: PersistedAIConnectionState): boolean {
  return state.status === "CONEXAO_ATIVA";
}

function cloneModels(models: readonly DiscoveredAIModel[]): DiscoveredAIModel[] {
  return models.map((model) => ({
    id: model.id,
    ...(model.displayName ? { displayName: model.displayName } : {}),
    ...(model.ownedBy ? { ownedBy: model.ownedBy } : {}),
    ...(model.supportedActions ? { supportedActions: [...model.supportedActions] } : {}),
  }));
}

function cloneProposal(proposal: AIConnectionRuntimeProposal | null): AIConnectionRuntimeProposal | undefined {
  if (!proposal) return undefined;
  return {
    provider: proposal.provider,
    state: {
      ...proposal.state,
      ...(proposal.state.capabilities ? { capabilities: [...proposal.state.capabilities] } : {}),
    },
    models: cloneModels(proposal.models),
  };
}

function missingSecretState(provider: AIConnectionProvider): PersistedAIConnectionState {
  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status: "SEM_CHAVE",
    providerCandidate: provider,
  };
}

function isCredentialRejection(result: AIProviderDiscoveryResult | AIModelValidationResult): boolean {
  if (result.state.status === "CHAVE_INVALIDA") return true;
  return "code" in result && result.code === "CHAVE_INVALIDA";
}

function isDiscoveryFailure(result: AIProviderDiscoveryResult): result is AIProviderDiscoveryFailure {
  return result.success === false;
}

function isValidationFailure(result: AIModelValidationResult): result is AIModelValidationFailure {
  return result.success === false;
}

/**
 * Trusted-process orchestrator for the single AI connection.
 *
 * The renderer supplies only provider/model choices. Credentials and the
 * discovered-model set are resolved inside the trusted runtime. An existing
 * active connection is kept transactionally until a replacement is fully
 * validated.
 */
export class AIConnectionTrustedRuntimeService {
  private readonly loadState: RuntimeOptions["loadState"];
  private readonly persistState: RuntimeOptions["persistState"];
  private readonly readSecret: RuntimeOptions["readSecret"];
  private readonly discovery: Discovery;
  private readonly validator: Validator;
  private proposal: AIConnectionRuntimeProposal | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(options: RuntimeOptions) {
    this.loadState = options.loadState;
    this.persistState = options.persistState;
    this.readSecret = options.readSecret;
    this.discovery = options.discovery || new AIConnectionDiscoveryService();
    this.validator = options.validator || new AIConnectionModelValidationService();
  }

  async getSnapshot(): Promise<AIConnectionRuntimeSnapshot> {
    return this.exclusive(async () => {
      const state = await this.loadValidatedState();
      const proposal = cloneProposal(this.proposal);
      return {
        state,
        ...(proposal ? { proposal } : {}),
      };
    });
  }

  async confirmProvider(provider: AIConnectionProvider): Promise<AIConnectionRuntimeOperationResult> {
    return this.exclusive(async () => {
      const current = await this.loadValidatedState();
      const secretRef = resolveSecretRef(provider, current);
      const apiKey = (await this.readSecret(secretRef)).trim();

      if (!apiKey) {
        this.proposal = null;
        const empty = missingSecretState(provider);
        const state = isActive(current) && !sameCredential(current, provider, secretRef)
          ? current
          : await this.persistState(empty);
        return {
          success: false,
          provider,
          state,
          message: "A credencial do provedor selecionado não está disponível no armazenamento seguro.",
          code: "MISSING_KEY",
        };
      }

      const discoveryCurrent = (current.provider === provider || current.providerCandidate === provider)
        ? current
        : null;

      const discovered = await this.discovery.confirmProviderAndDiscoverModels({
        provider,
        apiKey,
        currentState: discoveryCurrent,
        secretRef,
      });

      if (isDiscoveryFailure(discovered)) {
        this.proposal = null;

        if (isActive(current)) {
          const shouldInvalidateActive = sameCredential(current, provider, secretRef) && isCredentialRejection(discovered);
          const state = shouldInvalidateActive ? await this.persistState(discovered.state) : current;
          return {
            success: false,
            provider,
            state,
            message: discovered.message,
            code: discovered.state.status,
          };
        }

        const state = await this.persistState(discovered.state);
        return {
          success: false,
          provider,
          state,
          message: discovered.message,
          code: discovered.state.status,
        };
      }

      let proposalState = discovered.state;
      if (current.connectionId && current.provider === provider && sameCredential(current, provider, secretRef)) {
        proposalState = {
          ...proposalState,
          connectionId: current.connectionId,
        };
      }

      this.proposal = {
        provider,
        state: proposalState,
        models: cloneModels(discovered.models),
      };

      const state = isActive(current)
        ? current
        : await this.persistState(proposalState);
      const proposal = cloneProposal(this.proposal);

      return {
        success: true,
        provider,
        state,
        ...(proposal ? { proposal } : {}),
      };
    });
  }

  async validateModel(
    provider: AIConnectionProvider,
    model: string,
  ): Promise<AIConnectionRuntimeOperationResult> {
    return this.exclusive(async () => {
      const current = await this.loadValidatedState();
      const proposal = this.proposal;

      if (!proposal || proposal.provider !== provider) {
        return {
          success: false,
          provider,
          model: typeof model === "string" ? model.trim() : "",
          state: current,
          message: "Confirme o provedor e atualize a lista de modelos antes de validar um modelo.",
          code: "DISCOVERY_REQUIRED",
        };
      }

      const secretRef = proposal.state.secretRef;
      if (!secretRef || !secretRefMatchesProvider(provider, secretRef)) {
        this.proposal = null;
        return {
          success: false,
          provider,
          model: typeof model === "string" ? model.trim() : "",
          state: current,
          message: "A proposta atual não possui uma referência de credencial compatível.",
          code: "INVALID_STATE",
        };
      }

      const apiKey = (await this.readSecret(secretRef)).trim();
      if (!apiKey) {
        this.proposal = null;
        const empty = missingSecretState(provider);
        const state = isActive(current) && !sameCredential(current, provider, secretRef)
          ? current
          : await this.persistState(empty);
        return {
          success: false,
          provider,
          model: typeof model === "string" ? model.trim() : "",
          state,
          message: "A credencial não está mais disponível no armazenamento seguro.",
          code: "MISSING_KEY",
        };
      }

      const result = await this.validator.validateAndActivate({
        provider,
        apiKey,
        model,
        discoveredModels: proposal.models,
        currentState: proposal.state,
      });

      if (!isValidationFailure(result)) {
        const state = await this.persistState(result.state);
        this.proposal = null;
        return {
          success: true,
          provider,
          model: result.model,
          state,
        };
      }

      const failure = result;

      if (isActive(current)) {
        const shouldInvalidateActive = sameCredential(current, provider, secretRef) && isCredentialRejection(failure);
        if (shouldInvalidateActive) {
          const state = await this.persistState(failure.state);
          this.proposal = null;
          return {
            success: false,
            provider,
            model: failure.model,
            state,
            message: failure.message,
            code: failure.code,
          };
        }

        if (failure.code === "CHAVE_INVALIDA") {
          this.proposal = null;
        } else {
          this.proposal = {
            ...proposal,
            state: failure.state,
          };
        }

        const retainedProposal = cloneProposal(this.proposal);
        return {
          success: false,
          provider,
          model: failure.model,
          state: current,
          ...(retainedProposal ? { proposal: retainedProposal } : {}),
          message: failure.message,
          code: failure.code,
        };
      }

      const state = await this.persistState(failure.state);
      if (failure.code === "CHAVE_INVALIDA" || failure.code === "MISSING_KEY" || failure.code === "INVALID_STATE") {
        this.proposal = null;
      } else {
        this.proposal = {
          ...proposal,
          state: failure.state,
        };
      }

      const retainedProposal = cloneProposal(this.proposal);
      return {
        success: false,
        provider,
        model: failure.model,
        state,
        ...(retainedProposal ? { proposal: retainedProposal } : {}),
        message: failure.message,
        code: failure.code,
      };
    });
  }

  private async loadValidatedState(): Promise<PersistedAIConnectionState> {
    const state = await this.loadState();
    return parsePersistedAIConnection(state) || createEmptyAIConnection();
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release: () => void = () => undefined;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
