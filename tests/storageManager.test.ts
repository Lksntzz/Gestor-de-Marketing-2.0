import { beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { StorageManager } from "../src/services/storage/StorageManager";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

describe("StorageManager app-state gateway", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
  });

  test("round-trips valid state through the centralized gateway", () => {
    const storage = StorageManager.getInstance();
    const schema = z.array(z.object({ id: z.string() }));
    const value = [{ id: "one" }];

    storage.saveAppState("test-key", value);
    expect(storage.loadAppState("test-key", [], schema)).toEqual(value);
  });

  test("falls back when persisted JSON is corrupted", () => {
    const storage = StorageManager.getInstance();
    localStorage.setItem("broken", "{invalid-json");
    expect(storage.loadAppState("broken", ["fallback"])).toEqual(["fallback"]);
  });

  test("falls back when persisted data fails Zod validation", () => {
    const storage = StorageManager.getInstance();
    localStorage.setItem("wrong-shape", JSON.stringify({ id: 123 }));
    const schema = z.object({ id: z.string() });

    expect(storage.loadAppState("wrong-shape", { id: "fallback" }, schema)).toEqual({ id: "fallback" });
  });

  test("persists provider and model without writing API keys to localStorage", async () => {
    const storage = StorageManager.getInstance();
    const config = {
      endpoint: "https://127.0.0.1:27124",
      apiKey: "obsidian-secret",
      geminiApiKey: "gemini-secret",
      openaiApiKey: "openai-secret",
      aiProvider: "openai" as const,
      aiModel: "gpt-test",
      vaultName: "MarketingVault",
      useHttps: true,
      autoSync: true,
      syncIntervalSeconds: 60,
      connectionStatus: "disconnected" as const,
      allowSelfSignedCerts: true,
    };

    await storage.saveApiConfig(config);
    const persisted = localStorage.getItem("nisti_pkm_api_config_secure_v2") || "";
    expect(persisted).toContain('"aiProvider":"openai"');
    expect(persisted).toContain('"aiModel":"gpt-test"');
    expect(persisted).not.toContain("obsidian-secret");
    expect(persisted).not.toContain("gemini-secret");
    expect(persisted).not.toContain("openai-secret");

    const loaded = await storage.loadApiConfig(config);
    expect(loaded.aiProvider).toBe("openai");
    expect(loaded.aiModel).toBe("gpt-test");
    expect(loaded.openaiApiKey).toBe("openai-secret");
  });
});
