import { describe, expect, test } from "bun:test";
import { analyzeAICredentialLocally } from "../src/domain/aiCredentialAnalysis";

describe("local AI credential analysis", () => {
  test("empty credential remains SEM_CHAVE", () => {
    expect(analyzeAICredentialLocally("   ")).toEqual({
      status: "SEM_CHAVE",
      candidates: [],
    });
  });

  test("Gemini-looking key creates only a local candidate", () => {
    const secret = "AIzaSyExampleCredentialShape_123456789";
    const result = analyzeAICredentialLocally(secret);

    expect(result).toEqual({
      status: "PROVEDOR_POSSIVEL",
      candidates: ["gemini"],
      providerCandidate: "gemini",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret.slice(0, 8));
  });

  test("OpenAI-looking key creates only a local candidate", () => {
    const secret = "sk-proj-exampleCredentialShape_1234567890";
    const result = analyzeAICredentialLocally(secret);

    expect(result).toEqual({
      status: "PROVEDOR_POSSIVEL",
      candidates: ["openai"],
      providerCandidate: "openai",
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  test("unknown format requires explicit provider selection and returns no secret-derived fingerprint", () => {
    const secret = "credential-with-an-unknown-shape-123456";
    const result = analyzeAICredentialLocally(secret);

    expect(result).toEqual({
      status: "AGUARDANDO_CONFIRMACAO_DE_PROVEDOR",
      candidates: ["gemini", "openai"],
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(Object.keys(result)).not.toContain("hash");
    expect(Object.keys(result)).not.toContain("maskedKey");
  });
});
