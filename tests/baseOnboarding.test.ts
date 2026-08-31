import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("legacy Base onboarding isolation", () => {
  test("legacy document builder remains available only for backward compatibility", async () => {
    const legacy = await readFile(new URL("../src/domain/baseOnboarding.ts", import.meta.url), "utf8");
    expect(legacy).toContain("BASE_ONBOARDING_SECTIONS");
    expect(legacy).toContain("buildBaseDocumentPlans");
  });

  test("active Vault and App no longer require or render 00_Base onboarding", async () => {
    const [app, vault, briefing] = await Promise.all([
      readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/components/VaultView.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/domain/creationBriefing.ts", import.meta.url), "utf8"),
    ]);

    expect(app).toContain("assessSmartKnowledgeReadiness");
    expect(app).not.toContain("assessBaseReadiness");
    expect(vault).not.toContain("BaseOnboardingPanel");
    expect(briefing).toContain("assessSmartKnowledgeReadiness");
    expect(briefing).not.toContain("assessBaseReadiness");
  });
});
