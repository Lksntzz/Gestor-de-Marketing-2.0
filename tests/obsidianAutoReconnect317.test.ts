import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const main = readFileSync("src/main.tsx", "utf8");

describe("3.1.7 Obsidian automatic reconnect", () => {
  test("retries persisted desktop connection without manual testing", () => {
    expect(main).toContain("OBSIDIAN_RECONNECT_MIN_DELAY_MS = 3_000");
    expect(main).toContain("OBSIDIAN_RECONNECT_MAX_DELAY_MS = 30_000");
    expect(main).toContain("void reconnect();");
    expect(main).toContain("scheduleReconnect(reconnectDelayForAttempt(reconnectAttempts))");
  });

  test("recovers after a later runtime disconnect", () => {
    expect(main).toContain("OBSIDIAN_DISCONNECTED_EVENT");
    expect(main).toContain("scheduleReconnect(OBSIDIAN_RECONNECT_MIN_DELAY_MS)");
  });

  test("keeps REST-first reconnect independent from a physical vault path", () => {
    expect(main).toContain("const hasSavedConnection = Boolean(config.endpoint?.trim() && config.apiKey?.trim())");
    expect(main).not.toContain("const vaultPath = window.electronAPI ? await window.electronAPI.getVaultPath() : null");
  });
});
