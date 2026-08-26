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
});
