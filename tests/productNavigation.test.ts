import { describe, expect, test } from "bun:test";
import {
  LEGACY_COMPATIBILITY_VIEWS,
  PLANNING_SUBNAVIGATION,
  PRIMARY_NAVIGATION,
  isPlanningSubnavigationView,
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

  test("keeps only campaigns and calendar as visible subnavigation", () => {
    expect(PLANNING_SUBNAVIGATION).toEqual([
      { id: "campaigns", label: "Campanhas" },
      { id: "editorial", label: "Calendário" },
    ]);

    expect(isPlanningSubnavigationView("campaigns")).toBe(true);
    expect(isPlanningSubnavigationView("editorial")).toBe(true);
    expect(isPlanningSubnavigationView("knowledge")).toBe(false);
    expect(isPlanningSubnavigationView("routine")).toBe(false);
    expect(isPlanningSubnavigationView("tasks")).toBe(false);
    expect(isPlanningSubnavigationView("automations")).toBe(false);
  });
});
