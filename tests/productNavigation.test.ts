import { describe, expect, test } from "bun:test";
import {
  LEGACY_COMPATIBILITY_VIEWS,
  PLANNING_SUBNAVIGATION,
  PRIMARY_NAVIGATION,
  isPlanningSubnavigationView,
  isPrimaryNavigationDestination,
} from "../src/navigation/productNavigation";

describe("primary product navigation", () => {
  test("exposes the six audited workflow destinations", () => {
    expect(PRIMARY_NAVIGATION.map((item) => item.label)).toEqual([
      "Início",
      "Base",
      "Criar",
      "Planejar",
      "Executar",
      "Aprender",
    ]);

    expect(PRIMARY_NAVIGATION.map((item) => item.id)).toEqual([
      "dashboard",
      "vault",
      "content",
      "editorial",
      "tasks",
      "routine",
    ]);
  });

  test("keeps only true compatibility views outside the primary workflow", () => {
    expect(LEGACY_COMPATIBILITY_VIEWS).toEqual(["knowledge", "automations"]);
    for (const view of LEGACY_COMPATIBILITY_VIEWS) {
      expect(isPrimaryNavigationDestination(view)).toBe(false);
    }
    expect(isPrimaryNavigationDestination("routine")).toBe(true);
  });

  test("maps related compatibility views to their correct active area", () => {
    const activeFor = (view: string) =>
      PRIMARY_NAVIGATION.find((item) => item.matches.includes(view as never))?.label;

    expect(activeFor("campaigns")).toBe("Planejar");
    expect(activeFor("routine")).toBe("Aprender");
    expect(activeFor("automations")).toBe("Executar");
    expect(activeFor("knowledge")).toBe("Base");
  });

  test("keeps only campaigns and calendar as visible planning subnavigation", () => {
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
