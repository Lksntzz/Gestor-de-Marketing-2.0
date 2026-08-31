import { afterEach, describe, expect, it } from "bun:test";
import { publishObsidianSnapshot } from "../src/services/obsidianRuntimeState";

const originalWindow = (globalThis as any).window;
const originalCustomEvent = (globalThis as any).CustomEvent;

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class TestCustomEvent<T = unknown> extends Event {
  detail: T;

  constructor(type: string, init?: { detail?: T }) {
    super(type);
    this.detail = init?.detail as T;
  }
}

afterEach(() => {
  (globalThis as any).window = originalWindow;
  (globalThis as any).CustomEvent = originalCustomEvent;
});

describe("Obsidian snapshot state bridge", () => {
  it("publishes markdown notes into the persistent app notes state", () => {
    const target = new EventTarget() as EventTarget & {
      localStorage: MemoryStorage;
      electronAPI: Record<string, unknown>;
    };
    target.localStorage = new MemoryStorage();
    target.electronAPI = {};

    target.localStorage.setItem(
      "obsidian_marketing_notes",
      JSON.stringify([
        {
          id: "local-note",
          path: "00_Inbox/local.md",
          title: "local",
          folder: "00_Inbox",
          content: "local",
        },
      ])
    );

    (globalThis as any).window = target;
    (globalThis as any).CustomEvent = TestCustomEvent;

    let stateEvent: any = null;
    let snapshotEvent: any = null;
    target.addEventListener("nisti:persistent-state-updated", (event) => {
      stateEvent = (event as any).detail;
    });
    target.addEventListener("nisti:obsidian-snapshot", (event) => {
      snapshotEvent = (event as any).detail;
    });

    publishObsidianSnapshot(
      [
        {
          id: "obsidian-note",
          path: "01_Estrategia\\Posicionamento.md",
          title: "Posicionamento",
          folder: "01_Estrategia",
          content: "Conteúdo estratégico existente no Obsidian",
          frontmatter: { status: "PENDENTE" },
          tags: [],
          wikilinks: [],
          lastModified: "2026-08-31 16:00",
          syncedWithApi: false,
        } as any,
      ],
      ["01_Estrategia"]
    );

    expect(stateEvent?.key).toBe("obsidian_marketing_notes");
    expect(stateEvent?.sourceId).toBe("obsidian-runtime-snapshot");
    expect(stateEvent?.value).toHaveLength(2);

    const imported = stateEvent.value.find((note: any) => note.id === "obsidian-note");
    expect(imported?.path).toBe("01_Estrategia/Posicionamento.md");
    expect(imported?.content).toContain("Conteúdo estratégico");
    expect(imported?.syncedWithApi).toBe(true);

    expect(snapshotEvent?.notes).toHaveLength(1);
    expect(snapshotEvent?.folders).toEqual(["01_Estrategia"]);
  });
});
