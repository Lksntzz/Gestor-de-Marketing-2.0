import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  creativeCommitCandidates,
  isMissingCreativeFolderError,
  requireSuccessfulCreativeCommit,
} from "../src/services/creativeVaultPersistence";
import {
  CREATION_AI_MAX_ATTEMPTS,
  creationAIErrorMessage,
  creationAIRetryDelayMs,
  isRetryableCreationAIErrorCode,
} from "../src/services/ai/creationRequestRetry";

describe("hotfix 3.1.10 — persistência criativa", () => {
  test("tenta subpasta criativa e recua apenas para 03_Conteudos quando ela ainda não existe", () => {
    const candidates = creativeCommitCandidates({
      folder: "03_Conteudos/Ideias",
      title: "Ideia validada",
      content: "# Ideia",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0].folder).toBe("03_Conteudos/Ideias");
    expect(candidates[1].folder).toBe("03_Conteudos");

    const scriptCandidates = creativeCommitCandidates({
      folder: "03_Conteudos/Roteiros",
      title: "Roteiro validado",
      content: "# Roteiro",
    });
    expect(scriptCandidates.map((item) => item.folder)).toEqual(["03_Conteudos/Roteiros", "03_Conteudos"]);
  });

  test("não altera destinos arbitrários e só reconhece erro explícito de pasta ausente", () => {
    expect(creativeCommitCandidates({ folder: "07_Pesquisas", title: "Fonte", content: "Texto" })).toHaveLength(1);
    expect(isMissingCreativeFolderError({ success: false, error: "A pasta selecionada não existe no Vault atual." })).toBe(true);
    expect(isMissingCreativeFolderError({ success: false, error: "Falha de permissão." })).toBe(false);
  });

  test("falha de commit é propagada em vez de virar falso sucesso na Biblioteca", () => {
    expect(() => requireSuccessfulCreativeCommit({ success: false, error: "Falha real do Vault" })).toThrow("Falha real do Vault");
    expect(requireSuccessfulCreativeCommit({ success: true, noteRelativePath: "03_Conteudos/Ideia.md" }).success).toBe(true);
  });

  test("preload usa commit transacional antes de devolver sucesso ao React", async () => {
    const source = await readFile(new URL("../src/preload.ts", import.meta.url), "utf8");
    expect(source).toContain("commitKnowledgeSafely");
    expect(source).toContain("creativeCommitCandidates");
    expect(source).toContain("requireSuccessfulCreativeCommit");
    expect(source).toContain('ipcRenderer.invoke("knowledge:commit"');
  });
});

describe("hotfix 3.1.10 — geração de roteiro resiliente", () => {
  test("repete somente falhas transitórias/estruturais seguras", () => {
    expect(CREATION_AI_MAX_ATTEMPTS).toBe(3);
    expect(isRetryableCreationAIErrorCode("RATE_LIMIT")).toBe(true);
    expect(isRetryableCreationAIErrorCode("SERVICE_UNAVAILABLE")).toBe(true);
    expect(isRetryableCreationAIErrorCode("INVALID_RESPONSE")).toBe(true);
    expect(isRetryableCreationAIErrorCode("UNKNOWN")).toBe(true);
    expect(isRetryableCreationAIErrorCode("INVALID_API_KEY")).toBe(false);
    expect(isRetryableCreationAIErrorCode("INVALID_MODEL")).toBe(false);
  });

  test("backoff cresce sem exceder o limite e preserva a causa real", () => {
    expect(creationAIRetryDelayMs(1)).toBe(600);
    expect(creationAIRetryDelayMs(2)).toBe(1200);
    expect(creationAIRetryDelayMs(3)).toBe(2400);
    expect(creationAIRetryDelayMs(10)).toBe(2500);
    expect(creationAIErrorMessage({ warning: "Limite atingido", errorCode: "RATE_LIMIT" })).toBe("Limite atingido");
    expect(creationAIErrorMessage({ errorCode: "INVALID_RESPONSE" })).toContain("resposta estruturada válida");
  });

  test("cliente de criação não aceita fallback sintético e tenta novamente com código do provedor", async () => {
    const source = await readFile(new URL("../src/services/creationGenerationClient.ts", import.meta.url), "utf8");
    expect(source).toContain("CREATION_AI_MAX_ATTEMPTS");
    expect(source).toContain("data?.wasFallback");
    expect(source).toContain("data?.errorCode");
    expect(source).toContain("isRetryableCreationAIErrorCode");
    expect(source).not.toContain("O Nisti descartou o fallback sintético");
  });
});
