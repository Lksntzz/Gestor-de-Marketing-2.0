import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("Base Inicial onboarding 3.1.7", () => {
  test("document builder canônico permanece disponível", async () => {
    const domain = await readFile(new URL("../src/domain/baseOnboarding.ts", import.meta.url), "utf8");
    expect(domain).toContain("BASE_ONBOARDING_SECTIONS");
    expect(domain).toContain("buildBaseDocumentPlans");
    expect(domain).toContain("assessBaseReadiness");
  });

  test("fluxo ativo exige Base canônica e expõe o onboarding antes do App", async () => {
    const [main, briefing, gate] = await Promise.all([
      readFile(new URL("../src/main.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/domain/creationBriefing.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/components/BaseInitialGate.tsx", import.meta.url), "utf8"),
    ]);

    expect(main).toContain("BaseInitialGate");
    expect(main).toContain("<BaseInitialGate>");
    expect(briefing).toContain("assessBaseReadiness");
    expect(briefing).not.toContain("assessSmartKnowledgeReadiness");
    expect(gate).toContain("Onboarding da Base Inicial");
    expect(gate).toContain("Gravar e verificar Base Inicial");
    expect(gate).toContain("syncWebObsidianNotes");
  });
});
