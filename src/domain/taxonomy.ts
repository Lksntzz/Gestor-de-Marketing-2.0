import { z } from "zod";

/**
 * Official 10 Obsidian Vault Folders for Nisti Print PKM
 */
export const OFFICIAL_TAXONOMY_FOLDERS = [
  "00_Inbox",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates"
] as const;

export type TaxonomyFolder = (typeof OFFICIAL_TAXONOMY_FOLDERS)[number];

export const TAXONOMY_METADATA: Record<TaxonomyFolder, { label: string; description: string; defaultStatus: "NOVO" | "EM REVISÃO" | "OFICIAL"; iconName: string }> = {
  "00_Inbox": {
    label: "Inbox & Triagem Inicial",
    description: "Ponto de entrada obrigatório para qualquer conteúdo bruto, rascunho ou captura sem classificação imediata.",
    defaultStatus: "NOVO",
    iconName: "Inbox"
  },
  "01_Estrategia": {
    label: "Estratégia, Brand Voice & Personas",
    description: "Diretrizes de marca, declarações de missão, tom de voz oficial e personas detalhadas.",
    defaultStatus: "OFICIAL",
    iconName: "Target"
  },
  "02_Produtos": {
    label: "Produtos, Catálogo & Especificações",
    description: "Linhas de produtos (Planners, Devocionais), tabelas de preços, acabamentos gráficos e dados técnicos.",
    defaultStatus: "OFICIAL",
    iconName: "Package"
  },
  "03_Conteudos": {
    label: "Conteúdos, Roteiros & Copywriting",
    description: "Playbooks de copy, ganchos persuasivos, roteiros de Reels/TikTok e artigos aprovados.",
    defaultStatus: "EM REVISÃO",
    iconName: "FileText"
  },
  "04_Campanhas": {
    label: "Campanhas, Lançamentos & Cronogramas",
    description: "Planos de campanhas sazonais, distribuição de canais, orçamentos e cronogramas de lançamento.",
    defaultStatus: "OFICIAL",
    iconName: "Calendar"
  },
  "05_Reunioes": {
    label: "Reuniões, Atas & Briefings",
    description: "Atas de reuniões de alinhamento, briefings internos e decisões de equipe.",
    defaultStatus: "EM REVISÃO",
    iconName: "Users"
  },
  "06_Influenciadores_UGC": {
    label: "Influenciadores, Parceiros & UGC",
    description: "Mapeamento de criadores de conteúdo de papelaria, contratos de parceria e conteúdo gerado por usuários.",
    defaultStatus: "EM REVISÃO",
    iconName: "Share2"
  },
  "07_Pesquisas": {
    label: "Pesquisas, Benchmarks & Mercado",
    description: "Estudos de mercado de papelaria personalizada, análises de concorrentes e pesquisas de tendência.",
    defaultStatus: "EM REVISÃO",
    iconName: "Search"
  },
  "08_Aprendizados": {
    label: "Aprendizados, Post-Mortems & Métricas",
    description: "Relatórios pós-campanha, aprendizados estratégicos e análises de ROI.",
    defaultStatus: "OFICIAL",
    iconName: "TrendingUp"
  },
  "99_Templates": {
    label: "Templates & Modelos Padronizados",
    description: "Modelos estruturados para criação ágil de novas notas em conformidade com o YAML schema.",
    defaultStatus: "OFICIAL",
    iconName: "FileCode"
  }
};

/**
 * Validates whether a given folder is one of the official 10 folders.
 */
export function isTaxonomyFolder(folder: string): folder is TaxonomyFolder {
  return OFFICIAL_TAXONOMY_FOLDERS.includes(folder as TaxonomyFolder);
}

/**
 * Normalizes any folder name into the official taxonomy.
 * Default fallback is strictly "00_Inbox".
 */
export function normalizeTaxonomyFolder(rawFolder: string | undefined | null): TaxonomyFolder {
  if (!rawFolder) return "00_Inbox";
  const cleaned = rawFolder.trim();
  if (isTaxonomyFolder(cleaned)) return cleaned;

  const lower = cleaned.toLowerCase();
  if (lower.includes("inbox") || lower.includes("captura") || lower.includes("rascunho")) return "00_Inbox";
  if (lower.includes("estrategia") || lower.includes("estratégia") || lower.includes("persona") || lower.includes("branding")) return "01_Estrategia";
  if (lower.includes("produto") || lower.includes("planner") || lower.includes("devocional") || lower.includes("catalogo") || lower.includes("catálogo")) return "02_Produtos";
  if (lower.includes("conteudo") || lower.includes("conteúdo") || lower.includes("copy") || lower.includes("roteiro")) return "03_Conteudos";
  if (lower.includes("campanha") || lower.includes("lancamento") || lower.includes("lançamento")) return "04_Campanhas";
  if (lower.includes("reuniao") || lower.includes("reunião") || lower.includes("ata") || lower.includes("briefing")) return "05_Reunioes";
  if (lower.includes("influenciador") || lower.includes("ugc") || lower.includes("parceria")) return "06_Influenciadores_UGC";
  if (lower.includes("pesquisa") || lower.includes("benchmark") || lower.includes("concorrente")) return "07_Pesquisas";
  if (lower.includes("aprendizado") || lower.includes("metrica") || lower.includes("métrica") || lower.includes("post-mortem")) return "08_Aprendizados";
  if (lower.includes("template") || lower.includes("modelo")) return "99_Templates";

  // Strict fallback
  return "00_Inbox";
}

/**
 * Sanitizes file and directory names to prevent directory traversal and OS filesystem corruption.
 */
export function sanitizeSafePath(folder: string, filename: string): { safeFolder: TaxonomyFolder; safeFilename: string } {
  const safeFolder = normalizeTaxonomyFolder(folder);
  let safeFilename = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_") // Remove invalid OS characters
    .replace(/\.\.+/g, "_") // Prevent directory traversal like ../
    .trim();

  if (!safeFilename) {
    safeFilename = `Nota_${Date.now()}`;
  }
  if (!safeFilename.endsWith(".md")) {
    safeFilename += ".md";
  }

  return { safeFolder, safeFilename };
}
