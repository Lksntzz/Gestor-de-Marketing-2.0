import { describe, expect, test } from "bun:test";
import type { PersistedAIConnectionState } from "../src/domain/aiConnection";
import { AIConnectionActivationCoordinator } from "../src/services/ai/AIConnectionActivationCoordinator";
import { AIConnectionModelValidationService } from "../src/services/ai/AIConnectionModelValidationService";

const pendingState: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "AGUARDANDO_MODELO",
  connectionId: "coord-connection",
  provider: "openai",
  secretRef: "legacy:openaiApiKey",
  credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
};

const discoveredModels = [{ id: "model-a" }];

describe("AI connection activation coordinator", () => {
  test("persists only the secret-free active state after real successful validation", async () => {
    const secret = "sk-coordinator-secret-never-persist";
    const persisted: PersistedAIConnectionState[] = [];
    const validator = new AIConnectionModelValidationService({
      providerFactory: (config) => ({
        async testConnection() {
          return { success: true as const, provider: config.provider, model: config.model || "" };
        },
      }),
      now: () => "2026-08-31T04:00:00.000Z",
    });
    const coordinator = new AIConnectionActivationCoordinator({
      validator,
      persistMetadata: (state) => {
        persisted.push(state);
        return state;
      },
    });

    const result = await coordinator.validateSelection({
      provider: "openai",
      apiKey: secret,
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(true);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].status).toBe("CONEXAO_ATIVA");
    expect(JSON.stringify(persisted[0])).not.toContain(secret);
    expect(Object.keys(persisted[0])).not.toContain("apiKey");
  });

  test("precondition failures do not overwrite persisted metadata", async () => {
    let writes = 0;
    const coordinator = new AIConnectionActivationCoordinator({
      validator: new AIConnectionModelValidationService({
        providerFactory: () => {
          throw new Error("provider must not execute");
        },
      }),
      persistMetadata: (state) => {
        writes += 1;
        return state;
      },
    });

    const missingKey = await coordinator.validateSelection({
      provider: "openai",
      apiKey: "",
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });
    const missingModel = await coordinator.validateSelection({
      provider: "openai",
      apiKey: "sk-secret",
      model: "not-discovered",
      discoveredModels,
      currentState: pendingState,
    });
    const invalidState = await coordinator.validateSelection({
      provider: "openai",
      apiKey: "sk-secret",
      model: "model-a",
      discoveredModels,
      currentState: {
        schemaVersion: 1,
        status: "PROVEDOR_POSSIVEL",
        providerCandidate: "openai",
        secretRef: "legacy:openaiApiKey",
      },
    });

    expect(missingKey.success).toBe(false);
    expect(missingModel.success).toBe(false);
    expect(invalidState.success).toBe(false);
    expect(writes).toBe(0);
  });

  test("provider-attempt failures persist only the sanitized transition state", async () => {
    const secret = "sk-provider-failure-secret";
    const writes: PersistedAIConnectionState[] = [];
    const coordinator = new AIConnectionActivationCoordinator({
      validator: new AIConnectionModelValidationService({
        providerFactory: () => ({
          async testConnection() {
            const { AIProviderError } = await import("../src/services/ai/AIProvider");
            throw new AIProviderError("INVALID_MODEL", `bad model ${secret}`, "openai", 404);
          },
        }),
      }),
      persistMetadata: (state) => {
        writes.push(state);
        return state;
      },
    });

    const result = await coordinator.validateSelection({
      provider: "openai",
      apiKey: secret,
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    expect(writes).toHaveLength(1);
    expect(writes[0].status).toBe("AGUARDANDO_MODELO");
    expect(JSON.stringify(writes[0])).not.toContain(secret);
  });
});
