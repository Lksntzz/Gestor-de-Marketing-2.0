import type { KnowledgeContextSource, KnowledgeSourceTrace } from "./KnowledgeContextService";

export interface GroundingGuardrailCheckResult {
  hasGrounding: boolean;
  officialFactSourcesCount: number;
  unverifiedSourcesCount: number;
  groundingWarning?: string;
  sourceAttributionMarkdown: string;
  sourceIds: string[];
}

export class GroundingGuardrailService {
  /**
   * Validates if the context has sufficient grounding to generate strategic or product copy.
   */
  public static checkGrounding(sources: KnowledgeContextSource[]): GroundingGuardrailCheckResult {
    if (!sources || sources.length === 0) {
      return {
        hasGrounding: false,
        officialFactSourcesCount: 0,
        unverifiedSourcesCount: 0,
        groundingWarning: "Nenhum documento canônico relevante foi encontrado no Vault. A IA responderá com base em conhecimento geral de marketing, sem garantias de conformidade com as regras internas da Nisti Print.",
        sourceAttributionMarkdown: "",
        sourceIds: [],
      };
    }

    let officialFactSourcesCount = 0;
    let unverifiedSourcesCount = 0;
    const sourceIds: string[] = [];

    const attributionLines: string[] = ["### 📚 Fontes Canônicas Utilizadas"];

    for (const [index, source] of sources.entries()) {
      if (source.epistemicStatus === "CONFIRMADO") {
        officialFactSourcesCount++;
      } else {
        unverifiedSourcesCount++;
      }

      sourceIds.push(source.path);
      const icon = source.epistemicStatus === "CONFIRMADO" ? "🟢 Fato Oficial" : source.epistemicStatus === "HIPÓTESE" ? "🟡 Hipótese" : "⚪ Rascunho";
      attributionLines.push(`${index + 1}. **[[${source.title}]]** (\`${source.path}\`) — *${icon}* (Score: ${source.relevanceScore})`);
    }

    let groundingWarning: string | undefined;
    if (officialFactSourcesCount === 0 && unverifiedSourcesCount > 0) {
      groundingWarning = "Aviso de Fundamentação: As fontes recuperadas consistem apenas de rascunhos ou hipóteses (status não homologado). Revise os fatos gerados.";
    }

    return {
      hasGrounding: true,
      officialFactSourcesCount,
      unverifiedSourcesCount,
      groundingWarning,
      sourceAttributionMarkdown: attributionLines.join("\n"),
      sourceIds,
    };
  }

  /**
   * Generates strict system guardrails prompt instructions
   */
  public static getGuardrailInstructions(): string {
    return [
      "DIRETRIZES DE FUNDAMENTAÇÃO E RASTREABILIDADE (CANONICAL RAG):",
      "1. Fatos e especificações técnicas de produtos (papéis, gramaturas, miolos, linhas) DEVEM ser extraídos EXCLUSIVAMENTE das fontes classificadas como CONFIRMADO.",
      "2. Qualquer alegação vinda de fontes classificadas como HIPÓTESE deve ser tratada como possibilidade, nunca afirmada como verdade absoluta.",
      "3. Fontes de PENDENTE / 00_Inbox são dados brutos não auditados; NÃO utilize como regra de ouro da marca.",
      "4. Se faltar alguma especificação crucial no contexto do Vault, declare explicitamente a ausência em vez de inventar números ou materiais.",
    ].join("\n");
  }
}
