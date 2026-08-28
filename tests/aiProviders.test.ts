import { describe, expect, test } from "bun:test";
import { AIProviderFactory } from "../src/services/ai/AIProviderFactory";
import { AIProviderError, normalizeAIError } from "../src/services/ai/AIProvider";
import { GeminiProvider } from "../src/services/ai/providers/GeminiProvider";
import { OpenAIProvider } from "../src/services/ai/providers/OpenAIProvider";

describe("AI provider architecture", () => {
  test("factory selects Gemini and OpenAI through the same interface", () => {
    const gemini = AIProviderFactory.create({ provider: "gemini", apiKey: "test-key" });
    const openai = AIProviderFactory.create({ provider: "openai", apiKey: "test-key" });

    expect(gemini).toBeInstanceOf(GeminiProvider);
    expect(openai).toBeInstanceOf(OpenAIProvider);
    for (const provider of [gemini, openai]) {
      expect(typeof provider.generateText).toBe("function");
      expect(typeof provider.generateJson).toBe("function");
      expect(typeof provider.analyzeDocument).toBe("function");
      expect(typeof provider.testConnection).toBe("function");
    }
  });

  test("Gemini continues generating structured data through the common contract", async () => {
    const provider = new GeminiProvider(
      { provider: "gemini", apiKey: "gemini-key", model: "gemini-test" },
      () => ({ models: { generateContent: async () => ({ text: '{"status":"ok"}' }) } })
    );

    const result = await provider.generateJson<{ status: string }>({
      prompt: "Retorne status",
      schema: { type: "object", properties: { status: { type: "string" } }, required: ["status"] },
    });

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("gemini-test");
    expect(result.data).toEqual({ status: "ok" });
  });

  test("OpenAI generates structured data through the same contract", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({
      model: "gpt-test",
      output_text: '{"status":"ok"}',
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const provider = new OpenAIProvider(
      { provider: "openai", apiKey: "openai-key", model: "gpt-test" },
      fakeFetch as typeof fetch
    );

    const result = await provider.generateJson<{ status: string }>({
      prompt: "Retorne status",
      schema: { type: "object", properties: { status: { type: "string" } }, required: ["status"] },
    });

    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-test");
    expect(result.data).toEqual({ status: "ok" });
  });

  test("invalid API key is normalized", async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    const provider = new OpenAIProvider(
      { provider: "openai", apiKey: "wrong-key" },
      fakeFetch as typeof fetch
    );

    try {
      await provider.testConnection();
      throw new Error("Expected the connection test to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      expect((error as AIProviderError).code).toBe("INVALID_API_KEY");
      expect((error as Error).message).toContain("inválida");
    }
  });

  test("missing or unsupported provider configuration fails in a controlled way", () => {
    expect(() => AIProviderFactory.create({ provider: "gemini", apiKey: "" })).toThrow(AIProviderError);
    expect(() => AIProviderFactory.create({ provider: "unsupported" as any, apiKey: "key" })).toThrow("Provedor de IA não suportado");
  });

  test("provider transport errors use stable cross-provider codes", () => {
    expect(normalizeAIError({ status: 404, message: "model not found" }, "openai").code).toBe("INVALID_MODEL");
    expect(normalizeAIError({ status: 429, message: "rate limit" }, "gemini").code).toBe("RATE_LIMIT");
    expect(normalizeAIError({ status: 503, message: "service unavailable" }, "openai").code).toBe("SERVICE_UNAVAILABLE");
  });
});
