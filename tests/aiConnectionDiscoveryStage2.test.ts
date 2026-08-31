import { describe, expect, test } from "bun:test";
import {
  AIConnectionDiscoveryService,
  GEMINI_MODELS_ENDPOINT,
  OPENAI_MODELS_ENDPOINT,
} from "../src/services/ai/AIConnectionDiscoveryService";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI connection Stage 2 provider discovery", () => {
  test("missing key performs no network request", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return jsonResponse({ data: [] });
    }) as typeof fetch;
    const service = new AIConnectionDiscoveryService({ fetchImpl });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.state.status).toBe("SEM_CHAVE");
    expect(calls).toBe(0);
  });

  test("OpenAI discovery calls only the official OpenAI models endpoint and invents no capabilities", async () => {
    const secret = "sk-proj-stage2-openai-secret-123456";
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return jsonResponse({
        data: [
          { id: "model-z", object: "model", owned_by: "openai" },
          { id: "model-a", object: "model", owned_by: "account" },
          { id: "model-a", object: "model", owned_by: "duplicate" },
        ],
      });
    }) as typeof fetch;
    const service = new AIConnectionDiscoveryService({
      fetchImpl,
      now: () => "2026-08-31T03:10:00.000Z",
      idFactory: () => "ai-connection-test",
    });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: secret,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(OPENAI_MODELS_ENDPOINT);
    expect(calls[0].url).not.toContain(secret);
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${secret}`);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful OpenAI discovery");

    expect(result.models).toEqual([
      { id: "model-a", ownedBy: "account" },
      { id: "model-z", ownedBy: "openai" },
    ]);
    expect(result.models.every((model) => model.supportedActions === undefined)).toBe(true);
    expect(result.state).toEqual({
      schemaVersion: 1,
      status: "AGUARDANDO_MODELO",
      connectionId: "ai-connection-test",
      provider: "openai",
      secretRef: "legacy:openaiApiKey",
      credentialConfirmedAt: "2026-08-31T03:10:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.state.status).not.toBe("CONEXAO_ATIVA");
    expect(result.state.model).toBeUndefined();
    expect(result.state.modelConfirmedAt).toBeUndefined();
  });

  test("Gemini discovery uses x-goog-api-key, follows pagination and keeps only generateContent models", async () => {
    const secret = "AIzaStage2GeminiSecret_123456789012345";
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url === GEMINI_MODELS_ENDPOINT) {
        return jsonResponse({
          models: [
            {
              name: "models/gemini-z",
              displayName: "Gemini Z",
              supportedGenerationMethods: ["generateContent", "countTokens"],
            },
            {
              name: "models/embedding-only",
              supportedGenerationMethods: ["embedContent"],
            },
          ],
          nextPageToken: "next page",
        });
      }
      return jsonResponse({
        models: [
          {
            name: "models/gemini-a",
            displayName: "Gemini A",
            supportedActions: ["generateContent"],
          },
          {
            name: "models/gemini-z",
            displayName: "Duplicate",
            supportedActions: ["generateContent"],
          },
        ],
      });
    }) as typeof fetch;
    const service = new AIConnectionDiscoveryService({
      fetchImpl,
      now: () => "2026-08-31T03:11:00.000Z",
      idFactory: () => "gemini-connection-test",
    });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "gemini",
      apiKey: secret,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(GEMINI_MODELS_ENDPOINT);
    expect(calls[1].url).toBe(`${GEMINI_MODELS_ENDPOINT}?pageToken=next%20page`);
    for (const call of calls) {
      expect(call.url).not.toContain(secret);
      expect(call.headers.get("x-goog-api-key")).toBe(secret);
      expect(call.headers.get("authorization")).toBeNull();
    }

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful Gemini discovery");
    expect(result.models).toEqual([
      {
        id: "gemini-a",
        displayName: "Gemini A",
        supportedActions: ["generateContent"],
      },
      {
        id: "gemini-z",
        displayName: "Gemini Z",
        supportedActions: ["countTokens", "generateContent"],
      },
    ]);
    expect(result.state.status).toBe("AGUARDANDO_MODELO");
    expect(result.state.provider).toBe("gemini");
    expect(result.state.secretRef).toBe("legacy:geminiApiKey");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("provider rejection states are normalized without leaking the credential", async () => {
    const secret = "sk-proj-never-leak-this-secret-123456";
    const scenarios = [
      { status: 401, payload: { error: { message: `Incorrect API key ${secret}` } }, expected: "CHAVE_INVALIDA" },
      { status: 403, payload: { error: { message: `Forbidden ${secret}` } }, expected: "SEM_PERMISSAO" },
      { status: 429, payload: { error: { message: `Quota ${secret}` } }, expected: "LIMITE_OU_COTA" },
      { status: 503, payload: { error: { message: `Down ${secret}` } }, expected: "PROVEDOR_INDISPONIVEL" },
    ] as const;

    for (const scenario of scenarios) {
      let calls = 0;
      const fetchImpl = (async () => {
        calls += 1;
        return jsonResponse(scenario.payload, scenario.status);
      }) as typeof fetch;
      const service = new AIConnectionDiscoveryService({ fetchImpl });

      const result = await service.confirmProviderAndDiscoverModels({
        provider: "openai",
        apiKey: secret,
      });

      expect(result.success).toBe(false);
      expect(result.state.status).toBe(scenario.expected);
      expect(calls).toBe(1);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  test("network exceptions are sanitized and never trigger probing of another provider", async () => {
    const secret = "sk-proj-network-secret-123456789";
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new Error(`network failure credential=${secret}`);
    }) as typeof fetch;
    const service = new AIConnectionDiscoveryService({ fetchImpl });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: secret,
    });

    expect(result.success).toBe(false);
    expect(result.state.status).toBe("PROVEDOR_INDISPONIVEL");
    expect(calls).toEqual([OPENAI_MODELS_ENDPOINT]);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.message).not.toContain(secret);
  });

  test("explicit provider choice is the only routing input even when current metadata has another candidate", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return jsonResponse({ data: [{ id: "model-only" }] });
    }) as typeof fetch;
    const service = new AIConnectionDiscoveryService({ fetchImpl });

    const result = await service.confirmProviderAndDiscoverModels({
      provider: "openai",
      apiKey: "sk-proj-selected-provider-123456789",
      currentState: {
        schemaVersion: 1,
        status: "PROVEDOR_POSSIVEL",
        providerCandidate: "gemini",
      },
    });

    expect(result.success).toBe(true);
    expect(calls).toEqual([OPENAI_MODELS_ENDPOINT]);
    if (result.success) expect(result.state.provider).toBe("openai");
  });
});
