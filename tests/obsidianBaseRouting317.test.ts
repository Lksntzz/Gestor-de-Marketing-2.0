import { describe, expect, test } from "bun:test";
import {
  NISTI_KNOWLEDGE_FOLDERS,
  qualifyNistiKnowledgeFolder,
  qualifyNistiKnowledgePath,
  stripNistiKnowledgeRoot,
} from "../src/services/obsidianKnowledgeAutomation";

describe("roteamento da Base Inicial 3.1.7", () => {
  test("00_Base faz parte da raiz gerenciada", () => {
    expect(NISTI_KNOWLEDGE_FOLDERS).toContain("Nisti Marketing/00_Base");
    expect(qualifyNistiKnowledgeFolder("00_Base")).toBe("Nisti Marketing/00_Base");
  });

  test("documento canônico nunca é redirecionado silenciosamente para Inbox", () => {
    expect(qualifyNistiKnowledgePath("00_Base/Empresa.md"))
      .toBe("Nisti Marketing/00_Base/Empresa.md");
  });

  test("normalização aceita caminhos com ou sem a raiz Nisti Marketing", () => {
    expect(stripNistiKnowledgeRoot("Nisti Marketing/00_Base/Empresa.md"))
      .toBe("00_Base/Empresa.md");
    expect(stripNistiKnowledgeRoot("00_Base/Empresa.md"))
      .toBe("00_Base/Empresa.md");
  });
});
