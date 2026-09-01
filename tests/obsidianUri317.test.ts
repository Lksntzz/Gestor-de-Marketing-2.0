import { describe, expect, test } from "bun:test";
import {
  buildObsidianAdvancedUri,
  buildObsidianNewNoteUri,
  buildObsidianOpenUri,
  sanitizeObsidianVaultName,
} from "../src/utils/obsidianUri";

describe("Obsidian URI 3.1.7", () => {
  test("remove o placeholder Vault ativo em vez de tentar abrir um Vault inexistente", () => {
    expect(sanitizeObsidianVaultName("Vault ativo")).toBe("");
    expect(buildObsidianOpenUri("Vault ativo", "Nisti Marketing/00_Inbox/Teste.md"))
      .toBe("obsidian://open?file=Nisti%20Marketing%2F00_Inbox%2FTeste");
  });

  test("preserva nome real detectado do Vault", () => {
    const uri = buildObsidianOpenUri("Marketing Principal", "Nisti Marketing/00_Inbox/Teste.md");
    expect(uri).toContain("vault=Marketing%20Principal");
    expect(uri).toContain("file=Nisti%20Marketing%2F00_Inbox%2FTeste");
  });

  test("new e advanced-uri também não propagam placeholder", () => {
    expect(buildObsidianNewNoteUri("Vault ativo", "00_Inbox/Nova.md", "teste"))
      .toBe("obsidian://new?name=00_Inbox%2FNova&content=teste");
    expect(buildObsidianAdvancedUri("Vault ativo", { filepath: "00_Inbox/Nova.md" }))
      .toBe("obsidian://advanced-uri?filepath=00_Inbox%2FNova.md");
  });
});
