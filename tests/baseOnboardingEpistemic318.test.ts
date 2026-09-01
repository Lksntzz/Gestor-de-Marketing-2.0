import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const builder = readFileSync("src/services/knowledge/KnowledgeContextBuilder.ts", "utf8");
const gate = readFileSync("src/components/BaseInitialGate.tsx", "utf8");

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
});
