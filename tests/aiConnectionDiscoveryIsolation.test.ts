import { describe, expect, test } from "bun:test";
import { AIConnectionDiscoveryService } from "../src/services/ai/AIConnectionDiscoveryService";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI discovery connection isolation", () => {
  test("provider confirmation creates a new connection identity and drops a foreign model candidate", async () => {
    const service = new AIConnectionDiscoveryService({
      fetchImpl: (async () => jsonResponse({ data: [{ id: "openai-model" }] })) as typeof fetch,
      idFactory: () => "new-connection-id",
      now: () => "2026-08-31T03:30:00.000Z",
    });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: "sk-proj-new-credential-123456789",
      currentState: {
        schemaVersion: 1,
        status: "CONEXAO_ATIVA",
        connectionId: "old-connection-id",
        provider: "gemini",
        model: "gemini-old-model",
        modelCandidate: "gemini-other-model",
        secretRef: "legacy:geminiApiKey",
        credentialConfirmedAt: "2026-08-30T00:00:00.000Z",
        modelConfirmedAt: "2026-08-30T00:01:00.000Z",
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful discovery");
    expect(result.state.connectionId).toBe("new-connection-id");
    expect(result.state.connectionId).not.toBe("old-connection-id");
    expect(result.state.modelCandidate).toBeUndefined();
    expect(result.state.model).toBeUndefined();
    expect(result.state.modelConfirmedAt).toBeUndefined();
    expect(result.state.provider).toBe("openai");
    expect(result.state.secretRef).toBe("legacy:openaiApiKey");
  });

  test("a model candidate is preserved only when it belongs to the selected provider flow", async () => {
    const service = new AIConnectionDiscoveryService({
      fetchImpl: (async () => jsonResponse({ data: [{ id: "openai-model" }] })) as typeof fetch,
      idFactory: () => "same-provider-connection",
    });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: "sk-proj-same-provider-123456789",
      currentState: {
        schemaVersion: 1,
        status: "PROVEDOR_POSSIVEL",
        providerCandidate: "openai",
        modelCandidate: "openai-model",
        secretRef: "legacy:openaiApiKey",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.state.modelCandidate).toBe("openai-model");
  });
});
