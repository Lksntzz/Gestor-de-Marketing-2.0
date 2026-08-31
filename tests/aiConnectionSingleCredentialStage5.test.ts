import { describe, expect, test } from "bun:test";
import type {
  AIConnectionProvider,
  AISecretReference,
  PersistedAIConnectionState,
} from "../src/domain/aiConnection";
import { AIConnectionTrustedRuntimeService } from "../src/services/ai/AIConnectionTrustedRuntimeService";

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

function discovery(connectionId: string) {
  return {
    async confirmProviderAndDiscoverModels(request: {
      provider: AIConnectionProvider;
      apiKey: string;
      secretRef?: AISecretReference;
    }) {
      return {
        success: true as const,
        provider: request.provider,
        models: [{ id: "model-a" }],
        state: {
          schemaVersion: 1 as const,
          status: "AGUARDANDO_MODELO" as const,
          connectionId,
          provider: request.provider,
          secretRef: request.secretRef,
          credentialConfirmedAt: "2026-08-31T12:00:00.000Z",
        },
      };
    },
  };
}

describe("AI connection Stage 5 single credential foundation", () => {
  test("fresh connection reads only the canonical active credential", async () => {
    const store = createStore({ schemaVersion: 1, status: "SEM_CHAVE" });
    const reads: AISecretReference[] = [];
    let discoveryKey = "";

    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async (ref) => {
        reads.push(ref);
        return ref === "active:aiConnectionKey" ? "single-secret" : "legacy-secret-must-not-be-read";
      },
      discovery: {
        async confirmProviderAndDiscoverModels(request) {
          discoveryKey = request.apiKey;
          return discovery("conn-single").confirmProviderAndDiscoverModels(request);
        },
      },
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(true);
    expect(reads).toEqual(["active:aiConnectionKey"]);
    expect(discoveryKey).toBe("single-secret");
    expect(result.proposal?.state.secretRef).toBe("active:aiConnectionKey");
    expect(JSON.stringify(result)).not.toContain("single-secret");
  });

  test("explicit migrated legacy reference remains compatible for the same provider", async () => {
    const store = createStore({
      schemaVersion: 1,
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "gemini",
      secretRef: "legacy:geminiApiKey",
    });
    const reads: AISecretReference[] = [];

    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async (ref) => {
        reads.push(ref);
        return ref === "legacy:geminiApiKey" ? "legacy-gemini" : "";
      },
      discovery: discovery("conn-legacy"),
    });

    const result = await runtime.confirmProvider("gemini");

    expect(result.success).toBe(true);
    expect(reads).toEqual(["legacy:geminiApiKey"]);
    expect(result.proposal?.state.secretRef).toBe("legacy:geminiApiKey");
  });

  test("provider switch from a legacy active connection uses the canonical credential, not the other legacy slot", async () => {
    const activeLegacyOpenAI: PersistedAIConnectionState = {
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "legacy-openai-active",
      provider: "openai",
      model: "model-old",
      secretRef: "legacy:openaiApiKey",
      capabilities: ["text_generation"],
      credentialConfirmedAt: "2026-08-31T11:00:00.000Z",
      modelConfirmedAt: "2026-08-31T11:01:00.000Z",
    };
    const store = createStore(activeLegacyOpenAI);
    const reads: AISecretReference[] = [];

    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async (ref) => {
        reads.push(ref);
        if (ref === "active:aiConnectionKey") return "new-single-key";
        if (ref === "legacy:geminiApiKey") return "old-other-provider-key";
        return "old-openai-key";
      },
      discovery: discovery("conn-new-gemini"),
    });

    const result = await runtime.confirmProvider("gemini");

    expect(result.success).toBe(true);
    expect(reads).toEqual(["active:aiConnectionKey"]);
    expect(result.state).toEqual(activeLegacyOpenAI);
    expect(result.proposal?.provider).toBe("gemini");
    expect(result.proposal?.state.secretRef).toBe("active:aiConnectionKey");
  });

  test("fresh connection fails closed when the canonical credential is absent without probing legacy secrets", async () => {
    const store = createStore({ schemaVersion: 1, status: "SEM_CHAVE" });
    const reads: AISecretReference[] = [];
    let discoveryCalls = 0;

    const runtime = new AIConnectionTrustedRuntimeService({
      ...store,
      readSecret: async (ref) => {
        reads.push(ref);
        return "";
      },
      discovery: {
        async confirmProviderAndDiscoverModels() {
          discoveryCalls += 1;
          throw new Error("discovery must not run without the active credential");
        },
      },
    });

    const result = await runtime.confirmProvider("openai");

    expect(result.success).toBe(false);
    expect(result.code).toBe("MISSING_KEY");
    expect(reads).toEqual(["active:aiConnectionKey"]);
    expect(discoveryCalls).toBe(0);
  });
});
