import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildCreativeArtifactMarkdown,
  buildExplicitEditorialItem,
  buildScriptBriefFromIdea,
  resolveCreativeScriptType,
} from "../src/utils/contentWorkflow";

describe("creative workflow", () => {
  test("desenvolve roteiro apenas com contexto realmente registrado na ideia", () => {
    const brief = buildScriptBriefFromIdea({
      id: "idea-1",
      title: "Bastidores de produção",
      hook: "Como isso é feito?",
      format: "Reel",
      channel: "Instagram",
      objective: "Mostrar processo",
      concept: "Acompanhar uma etapa real da produção",
      keyMessage: "O processo é documentado",
      callToAction: "Conheça o processo",
    });

    expect(brief).toContain("Bastidores de produção");
    expect(brief).toContain("Conceito: Acompanhar uma etapa real da produção");
    expect(brief).not.toContain("Engajamento");
    expect(brief).not.toContain("Vendas");
  });

  test("salva artefato criativo como hipótese em revisão com origem explícita", () => {
    const markdown = buildCreativeArtifactMarkdown({
      kind: "script",
      objective: "Apresentar produto",
      format: "Reel",
      channel: "Instagram",
      theme: "Bastidores",
      briefingInstructions: "Não mencionar preço.",
      sourceIdeaId: "idea-1",
      sourceIdeaTitle: "Bastidores de produção",
      now: new Date(2026, 7, 29, 10, 0, 0),
    }, "# Roteiro\n\nConteúdo em revisão.");

    expect(markdown).toContain('tipo: "Roteiro de Conteúdo"');
    expect(markdown).toContain('status: "EM REVISÃO"');
    expect(markdown).toContain('epistemic_status: "HIPÓTESE"');
    expect(markdown).toContain('source_idea_id: "idea-1"');
    expect(markdown).toContain('source_idea_title: "Bastidores de produção"');
    expect(markdown).toContain('briefing_instructions: "Não mencionar preço."');
    expect(markdown).toContain('created_at: "2026-08-29"');
    expect(markdown).not.toContain('epistemic_status: "CONFIRMADO"');
  });

  test("mapeia tipo do roteiro a partir do formato ou plataforma escolhidos", () => {
    expect(resolveCreativeScriptType("Carrossel", "Instagram")).toBe("carrossel_slide");
    expect(resolveCreativeScriptType("Vídeo", "YouTube")).toBe("video_youtube");
    expect(resolveCreativeScriptType("Newsletter", "E-mail")).toBe("email_story");
    expect(resolveCreativeScriptType("Podcast", "Spotify")).toBe("podcast_intro");
    expect(resolveCreativeScriptType("Reel", "Instagram")).toBe("video_reels");
  });

  test("planejamento exige data explícita e preserva plataforma escolhida", () => {
    expect(() => buildExplicitEditorialItem({
      id: "ed-1",
      title: "Conteúdo",
      contentType: "Reel",
      platform: "TikTok",
      objective: "Apresentar produto",
      scheduledDate: "",
      status: "IN_PRODUCTION",
      now: 1000,
    })).toThrow("Escolha uma data real");

    const item = buildExplicitEditorialItem({
      id: "ed-2",
      title: "Conteúdo",
      contentType: "Reel",
      platform: "TikTok",
      objective: "Apresentar produto",
      scheduledDate: "2026-09-02",
      scheduledTime: "14:30",
      status: "IN_PRODUCTION",
      scriptId: "script-1",
      now: 1000,
    });

    expect(item.platform).toBe("TikTok");
    expect(item.scheduledDate).toBe("2026-09-02");
    expect(item.scheduledTime).toBe("14:30");
    expect(item.scriptId).toBe("script-1");
    expect(item.createdAt).toBe(1000);
  });

  test("UI de criação mantém briefing como primeira etapa e não injeta decisões silenciosas", async () => {
    const source = await readFile(new URL("../src/components/ContentView.tsx", import.meta.url), "utf8");

    expect(source).toContain('type CreationStage = "briefing" | "ideas" | "develop"');
    expect(source).toContain("1. Briefing");
    expect(source).toContain("2. Ideias");
    expect(source).toContain("3. Desenvolver");
    expect(source).toContain("creationBriefingBaseStatus");
    expect(source).toContain("creationGenerationClient.generateIdeas");
    expect(source).toContain("creationGenerationClient.generateScript");
    expect(source).toContain("customInstructions: briefingInstructions");
    expect(source).toContain("buildCreativeArtifactMarkdown");
    expect(source).not.toContain('scheduledDate: new Date().toISOString().split("T")[0]');
    expect(source).not.toContain('platform: "Instagram"');
    expect(source).not.toContain('objective: "Engajamento"');
    expect(source).not.toContain('type: "video_reels"');
    expect(source).toContain("Ideias salvas");
    expect(source).toContain("Escolha a data de publicação");
  });
});
