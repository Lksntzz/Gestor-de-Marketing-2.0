import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  AI_CONNECTION_METADATA_STORAGE_KEY,
  ensureAIConnectionMetadataMigration,
  importAIConnectionMetadata,
  readAIConnectionMetadata,
  writeAIConnectionMetadata,
} from "../src/services/ai/AIConnectionMetadataStore";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

describe("AI connection metadata store", () => {
  test("persists migration metadata without serializing raw legacy credentials", () => {
    const state = ensureAIConnectionMetadataMigration({
      aiProvider: "gemini",
      aiModel: "gemini-flash-latest",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "",
    });

    expect(state.status).toBe("PROVEDOR_POSSIVEL");
    const raw = localStorage.getItem(AI_CONNECTION_METADATA_STORAGE_KEY) || "";
    expect(raw).toContain("legacy:geminiApiKey");
    expect(raw).not.toContain("gemini-secret");
    expect(raw).not.toContain("apiKey");
  });

  test("re-derives provisional metadata when the legacy selection changes", () => {
    ensureAIConnectionMetadataMigration({
      aiProvider: "gemini",
      aiModel: "gemini-flash-latest",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "openai-secret",
    });

    const changed = ensureAIConnectionMetadataMigration({
      aiProvider: "openai",
      aiModel: "gpt-5-mini",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "openai-secret",
    });

    expect(changed).toMatchObject({
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "openai",
      modelCandidate: "gpt-5-mini",
      secretRef: "legacy:openaiApiKey",
    });
  });

  test("does not overwrite a later non-provisional connection state during legacy migration", () => {
    writeAIConnectionMetadata({
      schemaVersion: 1,
      status: "CHAVE_CONFIRMADA",
      connectionId: "conn-confirmed",
      provider: "openai",
      secretRef: "active:aiConnectionKey",
      credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
    });

    const preserved = ensureAIConnectionMetadataMigration({
      aiProvider: "gemini",
      aiModel: "gemini-flash-latest",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "",
    });

    expect(preserved.status).toBe("CHAVE_CONFIRMADA");
    expect(preserved.provider).toBe("openai");
    expect(preserved.connectionId).toBe("conn-confirmed");
  });

  test("blocks invalid payloads at the persistence boundary", () => {
    expect(() => writeAIConnectionMetadata({
      schemaVersion: 1,
      status: "PROVEDOR_POSSIVEL",
      providerCandidate: "openai",
      apiKey: "must-not-persist",
    })).toThrow(/persistência bloqueada/i);

    expect(readAIConnectionMetadata()).toBeNull();
  });

  test("downgrades imported active state before storing it on this machine", () => {
    const imported = importAIConnectionMetadata({
      schemaVersion: 1,
      status: "CONEXAO_ATIVA",
      connectionId: "conn-other-machine",
      provider: "gemini",
      model: "gemini-flash-latest",
      secretRef: "active:aiConnectionKey",
      credentialConfirmedAt: "2026-08-31T00:00:00.000Z",
      modelConfirmedAt: "2026-08-31T00:01:00.000Z",
    });

    expect(imported).toEqual({
      schemaVersion: 1,
      status: "SEM_CHAVE",
      providerCandidate: "gemini",
      modelCandidate: "gemini-flash-latest",
    });
    expect(readAIConnectionMetadata()).toEqual(imported);
  });
});
