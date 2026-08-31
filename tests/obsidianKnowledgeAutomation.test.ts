import { describe, expect, it } from "bun:test";
import {
  AUTO_TRIAGE_CONFIDENCE,
  NISTI_INBOX_FOLDER,
  NISTI_KNOWLEDGE_FOLDERS,
  classifyKnowledgeForVault,
  qualifyNistiKnowledgeFolder,
  qualifyNistiKnowledgePath,
} from "../src/services/obsidianKnowledgeAutomation";

function note(title: string, content: string, frontmatter: Record<string, unknown> = {}, tags: string[] = []) {
  return { title, content, frontmatter, tags };
}

describe("Obsidian smart knowledge automation", () => {
  it("uses a single Nisti Marketing root", () => {
    expect(NISTI_KNOWLEDGE_FOLDERS).toContain("Nisti Marketing/00_Inbox");
    expect(qualifyNistiKnowledgeFolder("03_Conteudos")).toBe("Nisti Marketing/03_Conteudos");
    expect(qualifyNistiKnowledgePath("03_Conteudos/Roteiro.md")).toBe("Nisti Marketing/03_Conteudos/Roteiro.md");
    expect(qualifyNistiKnowledgePath("captura.md")).toBe("Nisti Marketing/00_Inbox/captura.md");
  });

  it("classifies scripts and video references as content", () => {
    const result = classifyKnowledgeForVault(note("Roteiro Reels lançamento", "Gancho, cenas do vídeo e CTA final para Instagram Reels."));
    expect(result.folder).toBe("Nisti Marketing/03_Conteudos");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_TRIAGE_CONFIDENCE);
  });

  it("classifies Instagram and TikTok performance as learnings", () => {
    const result = classifyKnowledgeForVault(note("Instagram Insights - Reels", "Alcance 28000, salvamentos 870, compartilhamentos 430, retenção e CTR."));
    expect(result.folder).toBe("Nisti Marketing/08_Aprendizados");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_TRIAGE_CONFIDENCE);
  });

  it("keeps ambiguous information in inbox", () => {
    const result = classifyKnowledgeForVault(note("Anotação", "Lembrar de verificar isso depois."));
    expect(result.folder).toBe(NISTI_INBOX_FOLDER);
    expect(result.confidence).toBeLessThan(AUTO_TRIAGE_CONFIDENCE);
  });
});
