import type { EpistemicStatus, KnowledgeContextSource, KnowledgeSourceTrace } from "./KnowledgeContextService";

export interface EpistemicHierarchyRule {
  level: number; // 1 = highest truth, 3 = lowest truth
  weightMultiplier: number;
  description: string;
  allowedAsTruthFact: boolean;
}

export const EPISTEMIC_HIERARCHY: Record<string, EpistemicHierarchyRule> = {
  verified_truth: {
    level: 1,
    weightMultiplier: 1.5,
    description: "Fato canônico verificado e homologado pela Nisti Print (01_Estrategia, 02_Produtos)",
    allowedAsTruthFact: true,
  },
  CONFIRMADO: {
    level: 1,
    weightMultiplier: 1.5,
    description: "Fato oficial aprovado",
    allowedAsTruthFact: true,
  },
  OFICIAL: {
    level: 1,
    weightMultiplier: 1.5,
    description: "Status de workflow oficial homologado",
    allowedAsTruthFact: true,
  },
  work_in_progress: {
    level: 2,
    weightMultiplier: 1.0,
    description: "Rascunho de trabalho ou material em revisão (03_Conteudos, 04_Campanhas)",
    allowedAsTruthFact: false,
  },
  "EM REVISÃO": {
    level: 2,
    weightMultiplier: 1.0,
    description: "Item em revisão",
    allowedAsTruthFact: false,
  },
  HIPÓTESE: {
    level: 2,
    weightMultiplier: 1.0,
    description: "Hipótese de marketing ou inferência a ser validada",
    allowedAsTruthFact: false,
  },
  raw_capture: {
    level: 3,
    weightMultiplier: 0.6,
    description: "Captura bruta não triada ou transcrição (00_Inbox)",
    allowedAsTruthFact: false,
  },
  NOVO: {
    level: 3,
    weightMultiplier: 0.6,
    description: "Item recém-criado sem validação",
    allowedAsTruthFact: false,
  },
  PENDENTE: {
    level: 3,
    weightMultiplier: 0.6,
    description: "Status pendente de aprovação",
    allowedAsTruthFact: false,
  },
};

export interface EpistemicEvaluationResult {
  normalizedEpistemicStatus: EpistemicStatus;
  canonicalStatus: "verified_truth" | "work_in_progress" | "raw_capture";
  priorityLevel: number;
  weightMultiplier: number;
  isOfficialFact: boolean;
}

export function evaluateEpistemicWeight(
  folder: string,
  rawStatus?: unknown,
  rawEpistemicStatus?: unknown
): EpistemicEvaluationResult {
  const statusStr = String(rawStatus || "").trim().toUpperCase();
  const epistemicStr = String(rawEpistemicStatus || "").trim().toLowerCase();

  // 1. Explicit canonical frontmatter has top priority
  if (epistemicStr === "verified_truth" || epistemicStr === "confirmado" || statusStr === "OFICIAL") {
    return {
      normalizedEpistemicStatus: "CONFIRMADO",
      canonicalStatus: "verified_truth",
      priorityLevel: 1,
      weightMultiplier: 1.5,
      isOfficialFact: true,
    };
  }

  if (epistemicStr === "work_in_progress" || epistemicStr === "hipotese" || epistemicStr === "hipótese" || statusStr === "EM REVISÃO") {
    return {
      normalizedEpistemicStatus: "HIPÓTESE",
      canonicalStatus: "work_in_progress",
      priorityLevel: 2,
      weightMultiplier: 1.0,
      isOfficialFact: false,
    };
  }

  if (
    epistemicStr === "raw_capture" ||
    epistemicStr === "pendente" ||
    epistemicStr === "novo" ||
    epistemicStr === "rascunho" ||
    statusStr === "NOVO" ||
    statusStr === "PENDENTE" ||
    statusStr === "RASCUNHO"
  ) {
    return {
      normalizedEpistemicStatus: "PENDENTE",
      canonicalStatus: "raw_capture",
      priorityLevel: 3,
      weightMultiplier: 0.6,
      isOfficialFact: false,
    };
  }

  // 2. Folder-based default classification if metadata is missing or vague.
  // Rigor epistêmico: Nenhuma pasta gera CONFIRMADO / isOfficialFact: true automaticamente
  // sem evidência explícita (status: "OFICIAL" ou epistemic_status: "CONFIRMADO").
  const normalizedFolder = String(folder || "").replace(/\\/g, "/");
  if (normalizedFolder.includes("01_Estrategia") || normalizedFolder.includes("02_Produtos") || normalizedFolder.includes("08_Aprendizados")) {
    return {
      normalizedEpistemicStatus: "HIPÓTESE",
      canonicalStatus: "work_in_progress",
      priorityLevel: 2,
      weightMultiplier: 1.0,
      isOfficialFact: false,
    };
  }

  if (normalizedFolder.includes("03_Conteudos") || normalizedFolder.includes("04_Campanhas") || normalizedFolder.includes("05_Reunioes") || normalizedFolder.includes("06_Influenciadores_UGC") || normalizedFolder.includes("07_Pesquisas")) {
    return {
      normalizedEpistemicStatus: "HIPÓTESE",
      canonicalStatus: "work_in_progress",
      priorityLevel: 2,
      weightMultiplier: 1.0,
      isOfficialFact: false,
    };
  }

  // Default fallback for 00_Inbox and unclassified notes
  return {
    normalizedEpistemicStatus: "PENDENTE",
    canonicalStatus: "raw_capture",
    priorityLevel: 3,
    weightMultiplier: 0.6,
    isOfficialFact: false,
  };
}
