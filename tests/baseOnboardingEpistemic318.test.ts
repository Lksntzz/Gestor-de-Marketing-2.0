import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const builder = readFileSync("src/services/knowledge/KnowledgeContextBuilder.ts", "utf8");
const gate = readFileSync("src/components/BaseInitialGate.tsx", "utf8");
const briefing = readFileSync("src/domain/creationBriefing.ts", "utf8");

describe("3.1.8 epistemic onboarding safeguards", () => {
  test("knowledge context never promotes hypothesis or pending to fact", () => {
    expect(builder).toContain("Trate CONFIRMADO como fato da empresa");
    expect(builder).toContain("HIPÓTESE apenas como inferência");
    expect(builder).toContain("nunca apresente PENDENTE como fato");
    expect(builder).toContain('source.epistemicStatus === "CONFIRMADO" ? "FATO CANÔNICO HOMOLOGADO" : "DADOS NÃO CONFIRMADOS"');
  });

  test("active onboarding gate distinguishes review from confirmation", () => {
    expect(gate).toContain("countUnreviewedBaseAnswers");
    expect(gate).toContain("readiness.structurallyComplete");
    expect(gate).toContain("sem revisão/classificação");
    expect(gate).toContain("HIPÓTESE ou PENDENTE");
    expect(gate).not.toContain('answer.status !== "CONFIRMADO"');
  });

  test("onboarding can be deferred for the current session without completing the Base", () => {
    expect(gate).toContain("deferredForSession");
    expect(gate).toContain("Continuar no Nisti por enquanto");
    expect(gate).toContain("Retomar onboarding");
    expect(gate).toContain("Você saiu do onboarding somente nesta sessão");
    expect(gate).not.toContain("localStorage.setItem(\"nisti_base_onboarding_deferred");");
  });

  test("creation remains fail-closed while canonical Base is structurally incomplete", () => {
    expect(briefing).toContain("ready: readiness.structurallyComplete");
    expect(briefing).toContain("missingDocuments: readiness.missingSectionIds.length");
  });
});
