import { describe, expect, test } from "bun:test";
import {
  AI_CONNECTION_SCHEMA_VERSION,
  createEmptyAIConnection,
  downgradeImportedAIConnection,
  migrateAIConnectionConfig,
  parsePersistedAIConnection,
} from "../src/domain/aiConnection";

describe("AI connection stage 1 contract", () => {
  test("starts fail-closed when there is no legacy credential", () => {
    expect(migrateAIConnectionConfig({})).toEqual(createEmptyAIConnection());
    expect(migrateAIConnectionConfig({ aiProvider: "gemini", aiModel: "gemini-flash-latest" })).toEqual({
      schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
      status: "SEM_CHAVE",
    });
  });

  test("migrates Gemini metadata as an unconfirmed provider candidate", () => {
    expect(migrateAIConnectionConfig(
      { aiProvider: "gemini", aiModel: " gemini-flash-latest " },
      { legacySecrets: { gemini: true, openai: false } },
    )).toEqual({
      schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "gemini",
      modelCandidate: "gemini-flash-latest",
      secretRef: "legacy:geminiApiKey",
    });
  });

  test("migrates OpenAI metadata without marking the key or model as confirmed", () => {
    const result = migrateAIConnectionConfig(
      { aiProvider: "openai", aiModel: "gpt-5-mini" },
      { legacySecrets: { gemini: true, openai: true } },
    );

    expect(result.status).toBe("PROVEDOR_POSSIVEL");
    expect(result.providerCandidate).toBe("openai");
    expect(result.modelCandidate).toBe("gpt-5-mini");
    expect(result.provider).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.connectionId).toBeUndefined();
    expect(result.credentialConfirmedAt).toBeUndefined();
    expect(result.modelConfirmedAt).toBeUndefined();
  });

  test("can infer only an unambiguous legacy provider slot when old provider metadata is absent", () => {
    expect(migrateAIConnectionConfig(
      { aiModel: "gpt-5-mini" },
      { legacySecrets: { openai: true, gemini: false } },
    )).toMatchObject({
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "openai",
      secretRef: "legacy:openaiApiKey",
    });

    expect(migrateAIConnectionConfig(
      { aiModel: "unknown" },
      { legacySecrets: { openai: true, gemini: true } },
    ).status).toBe("SEM_CHAVE");
  });

  test("migration is idempotent for an existing valid V1 state", () => {
    const first = migrateAIConnectionConfig(
      { aiProvider: "gemini", aiModel: "gemini-flash-latest" },
      { legacySecrets: { gemini: true } },
    );
    const second = migrateAIConnectionConfig(
      { aiConnection: first, aiProvider: "openai", aiModel: "other-model" },
      { legacySecrets: { gemini: true, openai: true } },
    );

    expect(second).toEqual(first);
  });

  test("strict parser rejects raw secret fields instead of persisting them", () => {
    const parsed = parsePersistedAIConnection({
      schemaVersion: 1,
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "gemini",
      secretRef: "legacy:geminiApiKey",
      apiKey: "must-never-persist",
    });

    expect(parsed).toBeNull();
  });

  test("invalid or unknown legacy provider fails closed", () => {
    expect(migrateAIConnectionConfig(
      { aiProvider: "other-provider", aiModel: "model" },
      { legacySecrets: { gemini: true, openai: true } },
    )).toEqual(createEmptyAIConnection());
  });

  test("legacy migration drops overlong model hints instead of truncating identifiers", () => {
    const overlongModel = `model-${"x".repeat(210)}`;
    const result = migrateAIConnectionConfig(
      { aiProvider: "openai", aiModel: overlongModel },
      { legacySecrets: { openai: true } },
    );

    expect(result.status).toBe("PROVEDOR_POSSIVEL");
    expect(result.providerCandidate).toBe("openai");
    expect(result.modelCandidate).toBeUndefined();
  });

  test("active state requires identity and both confirmation timestamps", () => {
    expect(parsePersistedAIConnection({
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "conn_test",
      provider: "openai",
      model: "gpt-5-mini",
      secretRef: "active:aiConnectionKey",
    })).toBeNull();

    expect(parsePersistedAIConnection({
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "conn_test",
      provider: "openai",
      model: "gpt-5-mini",
      secretRef: "active:aiConnectionKey",
      credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
      modelConfirmedAt: "2026-08-31T00:01:00.000Z",
    })?.status).toBe("CONEXAO_ATIVA");
  });

  test("provider and legacy secret reference must remain compatible", () => {
    expect(parsePersistedAIConnection({
      schemaVersion: 1,
      status: "AGUARDANDO_MODELO",
      connectionId: "conn_mismatch",
      provider: "openai",
      secretRef: "legacy:geminiApiKey",
      credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
    })).toBeNull();

    expect(parsePersistedAIConnection({
      schemaVersion: 1,
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "gemini",
      secretRef: "legacy:openaiApiKey",
    })).toBeNull();
  });

  test("backup import removes trust claims and secret references", () => {
    const imported = downgradeImportedAIConnection({
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "conn_external_machine",
      provider: "gemini",
      model: "gemini-flash-latest",
      secretRef: "active:aiConnectionKey",
      capabilities: ["structured_output"],
      credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
      modelConfirmedAt: "2026-08-31T00:01:00.000Z",
    });

    expect(imported).toEqual({
      schemaVersion: 1,
      status: "SEM_CHAVE",
      providerCandidate: "gemini",
      modelCandidate: "gemini-flash-latest",
    });
  });
});
