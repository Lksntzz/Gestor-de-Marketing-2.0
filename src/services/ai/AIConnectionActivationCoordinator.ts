import type { PersistedAIConnectionState } from "../../domain/aiConnection";
import {
  writeAIConnectionMetadata,
} from "./AIConnectionMetadataStore";
import {
  AIConnectionModelValidationService,
  type AIModelValidationRequest,
  type AIModelValidationResult,
} from "./AIConnectionModelValidationService";

type Validator = Pick<AIConnectionModelValidationService, "validateAndActivate">;
type PersistMetadata = (state: PersistedAIConnectionState) => PersistedAIConnectionState;

type CoordinatorOptions = {
  validator?: Validator;
  persistMetadata?: PersistMetadata;
};

const NON_TRANSITION_FAILURES = new Set([
  "MISSING_KEY",
  "INVALID_STATE",
  "MODEL_NOT_DISCOVERED",
]);

/**
 * Coordinates model validation with the secret-free metadata boundary.
 *
 * The API key exists only in the validation request and is never forwarded to
 * persistence. Precondition failures do not mutate persisted connection state.
 */
export class AIConnectionActivationCoordinator {
  private readonly validator: Validator;
  private readonly persistMetadata: PersistMetadata;

  constructor(options: CoordinatorOptions = {}) {
    this.validator = options.validator || new AIConnectionModelValidationService();
    this.persistMetadata = options.persistMetadata || writeAIConnectionMetadata;
  }

  async validateSelection(request: AIModelValidationRequest): Promise<AIModelValidationResult> {
    const result = await this.validator.validateAndActivate(request);

    if (!result.success && NON_TRANSITION_FAILURES.has(result.code)) {
      return result;
    }

    const persistedState = this.persistMetadata(result.state);
    return {
      ...result,
      state: persistedState,
    } as AIModelValidationResult;
  }
}
