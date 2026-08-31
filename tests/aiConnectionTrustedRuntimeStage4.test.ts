import { describe, expect, test } from "bun:test";
import type {
  AIConnectionProvider,
  AISecretReference,
  PersistedAIConnectionState,
} from "../src/domain/aiConnection";
import type { DiscoveredAIModel } from "../src/services/ai/AIConnectionDiscoveryService";
import { AIProviderError } from "../src/services/ai/AIProvider";
import { AIConnectionModelValidationService } from "../src/services/ai/AIConnectionModelValidationService";
import { AIConnectionTrustedRuntimeService } from "../src/services/ai/AIConnectionTrustedRuntimeService";

const pendingOpenAI: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "AGUARDANDO_MODELO",
  connectionId: "conn-openai",
  provider: "openai",
  secretRef: "legacy:openaiApiKey",
  credentialConfirmedAt: "2026-08-31T06:00:00.000Z",
};

const activeOpenAI: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "CONEXAO_ATIVA",
  connectionId: "conn-active-openai",
  provider: "openai",
  model: "model-old",
  secretRef: "legacy:openaiApiKey",
  capabilities: ["text_generation"],
  credentialConfirmedAt: "2026-08-31T06:00:00.000Z",
  modelConfirmedAt: "2026-08-31T06:01:00.000Z",
};

const models: DiscoveredAIModel[] = [{ id: "model-a" }, { id: "model-b" }];

function createStore(initial: PersistedAIConnectionState) {
  let state = initial;
  const writes: PersistedAIConnectionState[] = [];
  return {
    loadState: async () => state,
    persistState: async (next: PersistedAIConnectionState) => {
      state = next;
      writes.push(next);
      return next;
    },
    writes,
    current: () => state,
  };
}

function secretReader(values: Partial<Record<AISecretReference, string>>, reads: AISecretReference[]) {
  return async (secretRef: AISecretReference) => {
    reads.push(secretRef);
    return values[secretRef] || "";
  };
}

function successfulDiscovery(connectionId: string) {
  return {
    async confirmProviderAndDiscoverModels(request: {
      provider: AIConnectionProvider;
      apiKey: string;
      secretRef?: AISecretReference;
    }) {
      return {
        success: true as const,
        provider: request.provider,
        models,
        state: {
          schemaVersion: 1 as const,
          status: "AGUARDANDO_MODELO" as const,
          connectionId,
          provider: request.provider,
          secretRef: request.secretRef || (request.provider === "openai" ? "legacy:openaiApiKey" : "legacy:geminiApiKey"),
          credentialConfirmedAt: "2026-08-31T06:10:00.000Z",
        },
      };
    },
  };
}

describe("AI connection Stage 4 trusted runtime", () => {
  test("initial confirmation reads the secret internally and persists only secret-free metadata", async () => {
    const store = createStore({ schemaVersion: 1, status: "PROVEDOR_POSSIVEL", providerCandidate: "openai", secretRef: "legacy:openaiApiKey" });
    const reads: AISecretReference[] = [];
    const secret = "sk-runtime-secret-never-return";
    let discoveryKey = "";

    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: secretReader({ "legacy:openaiApiKey": secret }, reads),
      discovery: {
        async confirmProviderAndDiscoverModels(request) {
          discoveryKey = request.apiKey;
          return successfulDiscovery("conn-new").confirmProviderAndDiscoverModels(request);
        },
      },
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(true);
    expect(reads).toEqual(["legacy:openaiApiKey"]);
    expect(discoveryKey).toBe(secret);
    expect(store.current().status).toBe("AGUARDANDO_MODELO");
    expect(store.writes).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(store.writes)).not.toContain(secret);
  });

  test("model validation cannot run without the trusted in-memory discovery session", async () => {
    const store = createStore(pendingOpenAI);
    let validatorCalls = 0;
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "sk-secret",
      validator: {
        async validateAndActivate() {
          validatorCalls += 1;
          throw new Error("must not execute");
        },
      },
    });

    const result = await runtime.validateModel("openai", "model-a");

    expect(result.success).toBe(false);
    expect(result.code).toBe("DISCOVERY_REQUIRED");
    expect(validatorCalls).toBe(0);
    expect(store.writes).toHaveLength(0);
  });

  test("rediscovery for the same active connection preserves persisted state and connection identity", async () => {
    const store = createStore(activeOpenAI);
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "sk-active",
      discovery: successfulDiscovery("should-not-replace-active-id"),
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(true);
    expect(result.state).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);
    expect(result.proposal?.state.connectionId).toBe("conn-active-openai");
    expect(result.proposal?.state.status).toBe("AGUARDANDO_MODELO");
  });

  test("temporary secure-storage unavailability does not revoke an active connection", async () => {
    const store = createStore(activeOpenAI);
    let discoveryCalls = 0;
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "",
      discovery: {
        async confirmProviderAndDiscoverModels() {
          discoveryCalls += 1;
          throw new Error("must not execute without a credential");
        },
      },
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_KEY");
    expect(result.state).toEqual(activeOpenAI);
    expect(store.current()).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);
    expect(discoveryCalls).toBe(0);
  });

  test("credential becoming unavailable after discovery preserves the active connection", async () => {
    const store = createStore(activeOpenAI);
    let reads = 0;
    let validatorCalls = 0;
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => {
        reads += 1;
        return reads === 1 ? "sk-active" : "";
      },
      discovery: successfulDiscovery("ignored-id"),
      validator: {
        async validateAndActivate() {
          validatorCalls += 1;
          throw new Error("must not execute without a credential");
        },
      },
    });

    await runtime.confirmProvider("openai");
    const result = await runtime.validateModel("openai", "model-a");

    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_KEY");
    expect(result.state).toEqual(activeOpenAI);
    expect(store.current()).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);
    expect(validatorCalls).toBe(0);
  });

  test("invalid replacement model preserves the previous active connection transactionally", async () => {
    const store = createStore(activeOpenAI);
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "sk-active",
      discovery: successfulDiscovery("ignored-id"),
      validator: new AIConnectionModelValidationService({
        providerFactory: () => ({
          async testConnection() {
            throw new AIProviderError("INVALID_MODEL", "bad replacement", "openai", 404);
          },
        }),
      }),
    });

    await runtime.confirmProvider("openai");
    const result = await runtime.validateModel("openai", "model-a");

    expect(result.success).toBe(false);
    expect(result.code).toBe("INVALID_MODEL");
    expect(result.state).toEqual(activeOpenAI);
    expect(store.current()).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);
    expect(result.proposal?.state.status).toBe("AGUARDANDO_MODELO");
  });

  test("provider switch remains a proposal until its selected model succeeds", async () => {
    const store = createStore(activeOpenAI);
    const calls: Array<{ provider: string; model?: string; apiKey: string }> = [];
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async (ref) => ref === "legacy:geminiApiKey" ? "AIza-candidate" : "sk-active",
      discovery: successfulDiscovery("conn-gemini-candidate"),
      validator: new AIConnectionModelValidationService({
        providerFactory: (config) => {
          calls.push({ provider: config.provider, model: config.model, apiKey: config.apiKey });
          return {
            async testConnection() {
              return { success: true as const, provider: config.provider, model: config.model || "" };
            },
          };
        },
        now: () => "2026-08-31T06:20:00.000Z",
      }),
    });

    const discovered = await runtime.confirmProvider("gemini");
    expect(discovered.success).toBe(true);
    expect(discovered.state).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);

    const activated = await runtime.validateModel("gemini", "model-b");
    expect(activated.success).toBe(true);
    expect(activated.state).toMatchObject({
      status: "CONEXAO_ATIVA",
      connectionId: "conn-gemini-candidate",
      provider: "gemini",
      model: "model-b",
      secretRef: "legacy:geminiApiKey",
    });
    expect(store.writes).toHaveLength(1);
    expect(calls).toEqual([{ provider: "gemini", model: "model-b", apiKey: "AIza-candidate" }]);
  });

  test("invalid credential for another provider never destroys the active connection", async () => {
    const store = createStore(activeOpenAI);
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "AIza-invalid-candidate",
      discovery: {
        async confirmProviderAndDiscoverModels() {
          return {
            success: false as const,
            provider: "gemini" as const,
            models: [] as [],
            state: {
              schemaVersion: 1 as const,
              status: "CHAVE_INVALIDA" as const,
              providerCandidate: "gemini" as const,
              secretRef: "legacy:geminiApiKey" as const,
            },
            message: "A credencial foi rejeitada pelo provedor selecionado.",
          };
        },
      },
    });

    const result = await runtime.confirmProvider("gemini");

    expect(result.success).toBe(false);
    expect(result.state).toEqual(activeOpenAI);
    expect(store.current()).toEqual(activeOpenAI);
    expect(store.writes).toHaveLength(0);
  });

  test("explicit rejection of the same active credential revokes the active state", async () => {
    const store = createStore(activeOpenAI);
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "sk-revoked",
      discovery: {
        async confirmProviderAndDiscoverModels() {
          return {
            success: false as const,
            provider: "openai" as const,
            models: [] as [],
            state: {
              schemaVersion: 1 as const,
              status: "CHAVE_INVALIDA" as const,
              providerCandidate: "openai" as const,
              secretRef: "legacy:openaiApiKey" as const,
            },
            message: "A credencial foi rejeitada pelo provedor selecionado.",
          };
        },
      },
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(false);
    expect(result.state.status).toBe("CHAVE_INVALIDA");
    expect(store.current().status).toBe("CHAVE_INVALIDA");
    expect(store.writes).toHaveLength(1);
  });

  test("selected model is validated only against the runtime-owned discovered set", async () => {
    const store = createStore({ schemaVersion: 1, status: "PROVEDOR_POSSIVEL", providerCandidate: "openai", secretRef: "legacy:openaiApiKey" });
    let providerCalls = 0;
    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async () => "sk-secret",
      discovery: successfulDiscovery("conn-owned-models"),
      validator: new AIConnectionModelValidationService({
        providerFactory: () => {
          providerCalls += 1;
          throw new Error("must not execute for undiscovered model");
        },
      }),
    });

    await runtime.confirmProvider("openai");
    const result = await runtime.validateModel("openai", "renderer-injected-model");

    expect(result.success).toBe(false);
    expect(result.code).toBe("MODEL_NOT_DISCOVERED");
    expect(providerCalls).toBe(0);
  });
});
