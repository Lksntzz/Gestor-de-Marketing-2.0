import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  consumeEditorialPlanningHandoff,
  storeEditorialPlanningHandoff,
} from "../src/services/editorialPlanningHandoff";

const originalWindow = (globalThis as any).window;

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
});

function installSessionStorage() {
  const values = new Map<string, string>();
  (globalThis as any).window = {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
  return values;
}

describe("editorial planning handoff", () => {
  test("preserva somente o ID explícito e metadados de agenda informados", () => {
    installSessionStorage();
    storeEditorialPlanningHandoff({
      scriptId: "  script-42  ",
      scheduledDate: "2026-09-03",
      scheduledTime: "",
    });

    expect(consumeEditorialPlanningHandoff()).toEqual({
      scriptId: "script-42",
      scheduledDate: "2026-09-03",
      scheduledTime: undefined,
    });
  });

  test("handoff é de uso único e não persiste estado paralelo", () => {
    installSessionStorage();
    storeEditorialPlanningHandoff({ scriptId: "script-1" });
    expect(consumeEditorialPlanningHandoff()?.scriptId).toBe("script-1");
    expect(consumeEditorialPlanningHandoff()).toBeNull();
  });

  test("bloqueia handoff sem scriptId", () => {
    installSessionStorage();
    expect(() => storeEditorialPlanningHandoff({ scriptId: "   " })).toThrow("roteiro aprovado identificado explicitamente");
  });

  test("calendário consome o handoff somente depois que o SQLite terminou de carregar", async () => {
    const source = await readFile(new URL("../src/components/EditorialCalendarView.tsx", import.meta.url), "utf8");
    expect(source).toContain("consumeEditorialPlanningHandoff");
    expect(source).toContain("itemsLoaded");
    expect(source).toContain("if (!itemsLoaded) return");
    expect(source).toContain("item.scriptId === handoff.scriptId");
    expect(source).toContain("candidate.id === handoff.scriptId");
    expect(source).toContain("approvedScriptToEditorialDraft");
  });
});
