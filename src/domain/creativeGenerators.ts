import type { CreativeScript, IdeaItem, ObsidianNote } from "../types";
import { KnowledgeContextSource } from "../services/knowledge/KnowledgeContextService";

export type ContentFormatType =
  | "video_reels"
  | "video_youtube"
  | "carrossel_slide"
  | "post_feed"
  | "artigo_blog"
  | "email_newsletter"
  | "podcast_intro"
  | "landing_page_copy";

export type CopywritingFramework = "AIDA" | "PAS" | "BAB" | "DIRECT_RESPONSE" | "STORYTELLING";

export interface CreativeGenerationOptions {
  format: ContentFormatType;
  channel: string;
  objective: string;
  theme?: string;
  targetAudience?: string;
  tone?: string;
  framework?: CopywritingFramework;
  customInstructions?: string;
  sourceIdea?: IdeaItem;
  count?: number;
}

export interface GeneratedCopySection {
  title: string;
  content: string;
  guidelines?: string;
}

export interface GroundedCopywritingResult {
  title: string;
  format: ContentFormatType;
  channel: string;
  objective: string;
  framework: CopywritingFramework;
  hook: string;
  sections: GeneratedCopySection[];
  callToAction: string;
  suggestedHashtagsOrKeywords: string[];
  productionNotes: string;
  sourceAttribution: string[];
  epistemicWarning?: string;
}

export interface AssetAnalysisResult {
  assetTitle: string;
  visualSummary: string;
  detectedElements: string[];
  suggestedAngles: string[];
  potentialHooks: string[];
  recommendedChannels: string[];
  hypotheses: string[];
  epistemicStatus: "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";
}

/**
 * Builds standard instructions and formatting for the copywriting generators
 */
export function getCopywritingFrameworkPrompt(framework: CopywritingFramework): string {
  switch (framework) {
    case "AIDA":
      return "Estruture a cópia rigorosamente no modelo AIDA (Atenção, Interesse, Desejo, Ação).";
    case "PAS":
      return "Estruture a cópia rigorosamente no modelo PAS (Problema, Agitação, Solução comprovada).";
    case "BAB":
      return "Estruture a cópia rigorosamente no modelo BAB (Before / Antes, After / Depois, Bridge / Ponte com o produto/serviço).";
    case "STORYTELLING":
      return "Estruture a cópia em arco narrativo com contexto, tensão, revelação da solução e conclusão prática.";
    case "DIRECT_RESPONSE":
    default:
      return "Estruture a cópia com foco em resposta direta: gancho imediato, proposta de valor clara, quebra de objeções baseada em fatos e chamada para ação explícita.";
  }
}

/**
 * Validates whether a generated script or copy is epistemically sound
 */
export function validateGenerationEpistemicStatus(
  resultSources: KnowledgeContextSource[]
): {
  hasConfirmedTruth: boolean;
  hasWarnings: boolean;
  notes: string[];
} {
  const notes = resultSources.map((s) => s.title || s.path);
  const hasConfirmedTruth = resultSources.some((s) => s.epistemicStatus === "CONFIRMADO");
  const hasWarnings = resultSources.some((s) => s.epistemicStatus === "PENDENTE" || s.epistemicStatus === "HIPÓTESE");

  return {
    hasConfirmedTruth,
    hasWarnings,
    notes,
  };
}
