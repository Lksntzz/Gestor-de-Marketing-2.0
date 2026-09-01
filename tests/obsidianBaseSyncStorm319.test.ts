import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const gate = readFileSync("src/components/BaseInitialGate.tsx", "utf8");

describe("3.1.9 Base Initial Obsidian sync stability", () => {
  test("consumes snapshot payload without starting another REST crawl", () => {
    const start = gate.indexOf("const onSnapshot = (event: Event) => {");
    const end = gate.indexOf("window.addEventListener(OBSIDIAN_CONNECTED_EVENT", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const handler = gate.slice(start, end);
    expect(handler).toContain("detail?.notes");
    expect(handler).toContain("setNotes(snapshot)");
    expect(handler).not.toContain("refreshFromRest");
    expect(handler).not.toContain("syncWebObsidianNotes");
  });

  test("coalesces connection-triggered REST refreshes", () => {
    expect(gate).toContain("const refreshInFlightRef = useRef<Promise<void> | null>(null)");
    expect(gate).toContain("if (refreshInFlightRef.current) return refreshInFlightRef.current");
    expect(gate).toContain("refreshInFlightRef.current = refresh");
    expect(gate).toContain("refreshInFlightRef.current = null");
  });

  test("keeps the verified final read as the Base completion authority", () => {
    expect(gate).toContain("const verifiedNotes = await api.syncWebObsidianNotes(config)");
    expect(gate).toContain("assessBaseReadiness(normalizeBaseNotes(verifiedNotes))");
    expect(gate).toContain("if (!verifiedReadiness.structurallyComplete)");
  });
});
