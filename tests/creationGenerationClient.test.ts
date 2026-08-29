import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("creation generation client", () => {
  test("autentica backend e provedor usando armazenamento seguro", async () => {
    const source = await read("src/services/creationGenerationClient.ts");
    expect(source).toContain('fetch("/api/auth/session"');
    expect(source).toContain('headers["x-ai-provider"]');
    expect(source).toContain('headers["x-ai-api-key"]');
    expect(source).toContain('headers["x-app-session-token"]');
    expect(source).toContain("storage.loadAIRequestConfig");
  });

  test("consulta o KnowledgeIndex e não envia a coleção bruta de notas no body", async () => {
    const source = await read("src/services/creationGenerationClient.ts");
    expect(source).toContain("window.electronAPI?.queryKnowledge");
    expect(source).toContain("knowledgeContextService.select");
    expect(source).toContain('postCreation("/api/ai/generate-ideas"');
    expect(source).toContain('postCreation("/api/ai/generate-script"');
    expect(source).not.toContain("body: JSON.stringify(payload)");
  });
});
