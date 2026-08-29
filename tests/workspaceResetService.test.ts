import { beforeEach, describe, expect, test } from "bun:test";
import { resetLocalWorkspace } from "../src/services/workspaceResetService";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.has(key) ? this.values.get(key)! : null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
  get length(): number { return this.values.size; }
}

describe("local workspace reset", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
    delete (globalThis as any).window;
  });

  test("clears browser-local state without requiring Electron", async () => {
    localStorage.setItem("campaigns", "keep-no-more");
    const result = await resetLocalWorkspace();
    expect(result.editorialItemsRemoved).toBe(0);
    expect(localStorage.getItem("campaigns")).toBeNull();
  });

  test("clears all SQLite editorial items through the existing safe IPC bridge", async () => {
    localStorage.setItem("tasks", "local-state");
    const deleted: string[] = [];
    (globalThis as any).window = {
      electronAPI: {
        editorialList: async () => [
          { id: "editorial-1", title: "Post 1" },
          { id: "editorial-2", title: "Post 2" },
        ],
        editorialDelete: async (id: string) => {
          deleted.push(id);
          return { success: true };
        },
        deleteSecret: async () => ({ success: true }),
      },
    };

    const result = await resetLocalWorkspace();
    expect(result.editorialItemsRemoved).toBe(2);
    expect(deleted).toEqual(["editorial-1", "editorial-2"]);
    expect(localStorage.getItem("tasks")).toBeNull();
  });

  test("fails before clearing localStorage when the calendar cannot be reconciled", async () => {
    localStorage.setItem("tasks", "must-survive");
    (globalThis as any).window = {
      electronAPI: {
        editorialList: async () => [{ id: "editorial-1", title: "Post 1" }],
        editorialDelete: async () => ({ success: false }),
        deleteSecret: async () => ({ success: true }),
      },
    };

    await expect(resetLocalWorkspace()).rejects.toThrow("reset foi interrompido");
    expect(localStorage.getItem("tasks")).toBe("must-survive");
  });
});
