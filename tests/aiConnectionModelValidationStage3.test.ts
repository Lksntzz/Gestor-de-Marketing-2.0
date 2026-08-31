import { describe, expect, test } from "bun:test";
import type { PersistedAIConnectionState } from "../src/domain/aiConnection";
import {
  AIProviderError,
  type AIProviderConfig,
} from "../src/services/ai/AIProvider";
import { AIConnectionModelValidationService } from "../src/services/ai/AIConnectionModelValidationService";

const pendingState: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "AGUARDANDO_MODELO",
  connectionId: "conn-stage3",
  provider: "openai",
  secretRef: "legacy:openaiApiKey",
  credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
};

const activeState: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "CONEXAO_ATIVA",
  connectionId: "conn-active",
  provider: "openai",
  model: "model-old",
  secretRef: "legacy:openaiApiKey",
  capabilities: ["text_generation"],
  credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
  modelConfirmedAt: "2026-08-31T03:21:00.000Z",
};

const discoveredModels = [
  { id: "model-a" },
  { id: "model-b" },
];

function successFactory(calls: AIProviderConfig[]) {
  return (config: AIProviderConfig) => {
    calls.push(config);
    return {
      async testConnection() {
        return {
          success: true as const,
          provider: config.provider,
          model: config.model || "",
        };
      },
    };
  };
}

describe("AI connection Stage 3 model validation", () => {
  test("invalid connection state fails before creating a provider", async () => {
    let calls = 0;
    const service = new AIConnectionModelValidationService({
      providerFactory: () => {
        calls += 1;
        throw new Error("must not execute");
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-secret",
      model: "model-a",
      discoveredModels,
      currentState: {
        schemaVersion: 1,
        status: "PROVEDOR_POSSIVEL",
        providerCandidate: "openai",
        secretRef: "legacy:openaiApiKey",
      },
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid state");
    expect(result.code).toBe("INVALID_STATE");
    expect(calls).toBe(0);
  });

  test("provider mismatch fails closed before any network-capable provider is created", async () => {
    let calls = 0;
    const service = new AIConnectionModelValidationService({
      providerFactory: () => {
        calls += 1;
        throw new Error("must not execute");
      },
    });

    const result = await service.validateAndActivate({
      provider: "gemini",
      apiKey: "AIzaStage3Secret",
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("INVALID_STATE");
    expect(calls).toBe(0);
  });

  test("missing key fails without provider call", async () => {
    let calls = 0;
    const service = new AIConnectionModelValidationService({
      providerFactory: () => {
        calls += 1;
        throw new Error("must not execute");
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "   ",
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("MISSING_KEY");
    expect(calls).toBe(0);
  });

  test("model outside the current discovery fails without provider call", async () => {
    let calls = 0;
    const service = new AIConnectionModelValidationService({
      providerFactory: () => {
        calls += 1;
        throw new Error("must not execute");
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-secret",
      model: "model-not-discovered",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("MODEL_NOT_DISCOVERED");
    expect(calls).toBe(0);
  });

  test("successful validation activates exactly the selected model", async () => {
    const secret = "sk-stage3-secret-never-return";
    const calls: AIProviderConfig[] = [];
    const service = new AIConnectionModelValidationService({
      providerFactory: successFactory(calls),
      now: () => "2026-08-31T03:40:00.000Z",
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: secret,
      model: "model-b",
      discoveredModels,
      currentState: {
        ...pendingState,
        modelCandidate: "model-a",
      },
    });

    expect(calls).toEqual([{
      provider: "openai",
      apiKey: secret,
      model: "model-b",
    }]);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected active connection");
    expect(result.state).toEqual({
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "conn-stage3",
      provider: "openai",
      model: "model-b",
      secretRef: "legacy:openaiApiKey",
      capabilities: ["text_generation"],
      credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
      modelConfirmedAt: "2026-08-31T03:40:00.000Z",
    });
    expect(result.state.modelCandidate).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(Object.keys(result.state)).not.toContain("apiKey");
  });

  test("provider-returned alias does not replace the explicitly selected model id", async () => {
    const service = new AIConnectionModelValidationService({
      providerFactory: () => ({
        async testConnection() {
          return { success: true as const, provider: "openai", model: "resolved-backend-alias" };
        },
      }),
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-secret",
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.state.model).toBe("model-a");
  });

  test("invalid model keeps confirmed credential but never activates", async () => {
    const secret = "sk-invalid-model-secret";
    const service = new AIConnectionModelValidationService({
      providerFactory: () => ({
        async testConnection() {
          throw new AIProviderError(
            "INVALID_MODEL",
            `model error credential=${secret}`,
            "openai",
            404,
          );
        },
      }),
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: secret,
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected invalid model");
    expect(result.code).toBe("INVALID_MODEL");
    expect(result.state).toMatchObject({
      status: "AGUARDANDO_MODELO",
      connectionId: "conn-stage3",
      provider: "openai",
      secretRef: "legacy:openaiApiKey",
      credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
      modelCandidate: "model-a",
    });
    expect(result.state.model).toBeUndefined();
    expect(result.state.modelConfirmedAt).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("failed model replacement preserves the previous active connection transactionally", async () => {
    const service = new AIConnectionModelValidationService({
      providerFactory: () => ({
        async testConnection() {
          throw new AIProviderError("INVALID_MODEL", "replacement unavailable", "openai", 404);
        },
      }),
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-secret",
      model: "model-a",
      discoveredModels,
      currentState: activeState,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected replacement failure");
    expect(result.code).toBe("INVALID_MODEL");
    expect(result.state).toEqual(activeState);
  });

  test("explicit credential rejection invalidates previous trust even during model replacement", async () => {
    const secret = "sk-revoked-stage3-secret";
    const service = new AIConnectionModelValidationService({
      providerFactory: () => ({
        async testConnection() {
          throw new AIProviderError("INVALID_API_KEY", `revoked ${secret}`, "openai", 401);
        },
      }),
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: secret,
      model: "model-a",
      discoveredModels,
      currentState: activeState,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected rejected credential");
    expect(result.code).toBe("CHAVE_INVALIDA");
    expect(result.state).toEqual({
      schemaVersion: 1,
      status: "CHAVE_INVALIDA",
      providerCandidate: "openai",
      secretRef: "legacy:openaiApiKey",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("403, quota and provider outage map to explicit non-active states before first activation", async () => {
    const scenarios = [
      {
        error: new AIProviderError("INVALID_API_KEY", "forbidden", "openai", 403),
        code: "SEM_PERMISSAO",
        status: "SEM_PERMISSAO",
      },
      {
        error: new AIProviderError("RATE_LIMIT", "quota", "openai", 429),
        code: "LIMITE_OU_COTA",
        status: "LIMITE_OU_COTA",
      },
      {
        error: new AIProviderError("SERVICE_UNAVAILABLE", "down", "openai", 503),
        code: "PROVEDOR_INDISPONIVEL",
        status: "PROVEDOR_INDISPONIVEL",
      },
    ] as const;

    for (const scenario of scenarios) {
      const service = new AIConnectionModelValidationService({
        providerFactory: () => ({
          async testConnection() {
            throw scenario.error;
          },
        }),
      });

      const result = await service.validateAndActivate({
        provider: "openai",
        apiKey: "sk-stage3-secret",
        model: "model-a",
        discoveredModels,
        currentState: pendingState,
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected provider failure");
      expect(result.code).toBe(scenario.code);
      expect(result.state.status).toBe(scenario.status);
      expect(result.state.connectionId).toBe("conn-stage3");
      expect(result.state.provider).toBe("openai");
      expect(result.state.model).toBeUndefined();
    }
  });

  test("transient failure during model replacement preserves previous active state", async () => {
    for (const error of [
      new AIProviderError("INVALID_API_KEY", "forbidden", "openai", 403),
      new AIProviderError("RATE_LIMIT", "quota", "openai", 429),
      new AIProviderError("SERVICE_UNAVAILABLE", "down", "openai", 503),
      new Error("network exploded"),
    ]) {
      const service = new AIConnectionModelValidationService({
        providerFactory: () => ({
          async testConnection() {
            throw error;
          },
        }),
      });

      const result = await service.validateAndActivate({
        provider: "openai",
        apiKey: "sk-stage3-secret",
        model: "model-a",
        discoveredModels,
        currentState: activeState,
      });

      expect(result.success).toBe(false);
      expect(result.state).toEqual(activeState);
    }
  });

  test("a provider identity mismatch cannot activate the connection", async () => {
    const service = new AIConnectionModelValidationService({
      providerFactory: () => ({
        async testConnection() {
          return { success: true as const, provider: "gemini", model: "model-a" };
        },
      }),
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-secret",
      model: "model-a",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PROVEDOR_INDISPONIVEL");
    expect(result.state).toEqual(pendingState);
  });

  test("one validation attempt creates exactly one provider and tests exactly one model", async () => {
    const configs: AIProviderConfig[] = [];
    let tests = 0;
    const service = new AIConnectionModelValidationService({
      providerFactory: (config) => {
        configs.push(config);
        return {
          async testConnection() {
            tests += 1;
            return { success: true as const, provider: "openai", model: config.model || "" };
          },
        };
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-one-call",
      model: "model-b",
      discoveredModels,
      currentState: pendingState,
    });

    expect(result.success).toBe(true);
    expect(configs).toHaveLength(1);
    expect(configs[0].provider).toBe("openai");
    expect(configs[0].model).toBe("model-b");
    expect(tests).toBe(1);
  });
});
