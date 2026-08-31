import { describe, expect, test } from "bun:test";
import type { PersistedAIConnectionState } from "../src/domain/aiConnection";
import { AIConnectionModelValidationService } from "../src/services/ai/AIConnectionModelValidationService";

const confirmedState: PersistedAIConnectionState = {
  schemaVersion: 1,
  status: "AGUARDANDO_MODELO",
  connectionId: "conn-model-id",
  provider: "openai",
  secretRef: "legacy:openaiApiKey",
  credentialConfirmedAt: "2026-08-31T03:20:00.000Z",
};

describe("AI connection Stage 3 model identifier integrity", () => {
  test("overlong selected model ids fail closed instead of being truncated", async () => {
    const prefix = "m".repeat(200);
    const overlongSelected = `${prefix}A`;
    const differentOverlongDiscovered = `${prefix}B`;
    let providerCalls = 0;

    const service = new AIConnectionModelValidationService({
      providerFactory: () => {
        providerCalls += 1;
        throw new Error("provider must not execute for an invalid identifier");
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-model-id-secret",
      model: overlongSelected,
      discoveredModels: [{ id: differentOverlongDiscovered }],
      currentState: confirmedState,
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected overlong identifier rejection");
    expect(result.code).toBe("MODEL_NOT_DISCOVERED");
    expect(providerCalls).toBe(0);
    expect(result.model).toBeUndefined();
    expect(result.state).toEqual(confirmedState);
  });

  test("valid model ids are preserved exactly apart from surrounding whitespace", async () => {
    const calls: string[] = [];
    const service = new AIConnectionModelValidationService({
      providerFactory: (config) => {
        calls.push(config.model || "");
        return {
          async testConnection() {
            return { success: true as const, provider: "openai", model: config.model || "" };
          },
        };
      },
    });

    const result = await service.validateAndActivate({
      provider: "openai",
      apiKey: "sk-stage3-model-id-secret",
      model: "  vendor/model:v1  ",
      discoveredModels: [{ id: "vendor/model:v1" }],
      currentState: confirmedState,
    });

    expect(result.success).toBe(true);
    expect(calls).toEqual(["vendor/model:v1"]);
    if (result.success) expect(result.state.model).toBe("vendor/model:v1");
  });
});
