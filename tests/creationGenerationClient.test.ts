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
    expect(source).toContain('"x-app-session-token": cachedSessionToken');
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

  test("geração criativa ignora engine legado, rejeita fallback e preserva causa real", async () => {
    const source = await read("src/services/creationGenerationClient.ts");
    expect(source).toContain("Generative creation always uses the configured AI provider");
    expect(source).toContain("if (data?.wasFallback)");
    expect(source).toContain("data?.errorCode");
    expect(source).toContain("creationAIErrorMessage");
    expect(source).toContain("CREATION_AI_MAX_ATTEMPTS");
    expect(source).not.toContain("engineMode: payload.engineMode");
  });

  test("cliente genérico não mantém transportes criativos inseguros ou porta fixa", async () => {
    const source = await read("src/services/api.ts");
    expect(source).not.toContain('fetch("http://localhost:3000/api/ai/plan-week"');
    expect(source).not.toContain("async generateIdeas(payload: any)");
    expect(source).not.toContain("async generateScript(payload: any)");
  });
});
