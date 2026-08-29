import { describe, expect, test } from "bun:test";
import {
  LEGACY_COMPATIBILITY_VIEWS,
  PRIMARY_NAVIGATION,
  isPrimaryNavigationDestination,
} from "../src/navigation/productNavigation";

describe("primary product navigation", () => {
  test("exposes only the current audited workflow destinations", () => {
    expect(PRIMARY_NAVIGATION.map((item) => item.label)).toEqual([
      "Início",
      "Base",
      "Criar",
      "Planejar",
      "Executar",
    ]);

    expect(PRIMARY_NAVIGATION.map((item) => item.id)).toEqual([
      "dashboard",
      "vault",
      "content",
      "editorial",
      "tasks",
    ]);
  });

  test("keeps legacy views addressable without making them primary destinations", () => {
    expect(LEGACY_COMPATIBILITY_VIEWS).toEqual(["knowledge", "routine", "automations"]);
    for (const view of LEGACY_COMPATIBILITY_VIEWS) {
      expect(isPrimaryNavigationDestination(view)).toBe(false);
    }
  });

  test("maps campaign planning and legacy compatibility views to the correct active area", () => {
    const activeFor = (view: string) =>
      PRIMARY_NAVIGATION.find((item) => item.matches.includes(view as never))?.label;

    expect(activeFor("campaigns")).toBe("Planejar");
    expect(activeFor("routine")).toBe("Planejar");
    expect(activeFor("automations")).toBe("Executar");
    expect(activeFor("knowledge")).toBe("Base");
  });
});
