import type { ObsidianNote } from "../types";

export const NISTI_VAULT_ROOT = "Nisti Marketing";
export const NISTI_RELATIVE_FOLDERS = [
  "00_Inbox",
  "00_Base",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates",
] as const;

export type NistiKnowledgeFolder = (typeof NISTI_RELATIVE_FOLDERS)[number];
export const NISTI_KNOWLEDGE_FOLDERS = NISTI_RELATIVE_FOLDERS.map(
  (folder) => `${NISTI_VAULT_ROOT}/${folder}`,
);
export const NISTI_INBOX_FOLDER = `${NISTI_VAULT_ROOT}/00_Inbox`;
export const AUTO_TRIAGE_CONFIDENCE = 0.82;

const FOLDER_SET = new Set<string>(NISTI_RELATIVE_FOLDERS);

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export function encodeVaultRelativePath(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function stripNistiKnowledgeRoot(value: string): string {
  const clean = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  const prefix = `${NISTI_VAULT_ROOT}/`;
  return clean.toLowerCase().startsWith(prefix.toLowerCase()) ? clean.slice(prefix.length) : clean;
}

export function qualifyNistiKnowledgeFolder(value: string | undefined | null): string {
  const relative = stripNistiKnowledgeRoot(String(value || "00_Inbox")).split("/")[0] || "00_Inbox";
  const safeFolder = FOLDER_SET.has(relative) ? relative : "00_Inbox";
  return `${NISTI_VAULT_ROOT}/${safeFolder}`;
}

export function qualifyNistiKnowledgePath(value: string): string {
  const clean = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^vault\//i, "")
    .trim();
  if (!clean) return `${NISTI_INBOX_FOLDER}/Nova Nota.md`;
  if (clean.toLowerCase().startsWith(`${NISTI_VAULT_ROOT.toLowerCase()}/`)) return clean;

  const parts = clean.split("/").filter(Boolean);
  if (parts.length > 1 && FOLDER_SET.has(parts[0])) return `${NISTI_VAULT_ROOT}/${clean}`;
  if (parts.length === 1) return `${NISTI_INBOX_FOLDER}/${parts[0]}`;
  return `${NISTI_INBOX_FOLDER}/${parts[parts.length - 1]}`;
}

interface ClassificationRule {
  folder: NistiKnowledgeFolder;
  label: string;
  keywords: string[];
}

const RULES: ClassificationRule[] = [
  {
    folder: "08_Aprendizados",
    label: "Métricas, resultados e aprendizados",
    keywords: [
      "metrica", "metricas", "insight", "insights", "alcance", "impressoes", "impressao", "engajamento",
      "curtidas", "likes", "comentarios", "compartilhamentos", "salvamentos", "retencao", "watch time",
      "ctr", "cpc", "cpm", "roas", "conversao", "resultado", "resultados", "analytics", "instagram insights",
      "tiktok analytics", "desempenho", "performance", "aprendizado", "post-mortem",
    ],
  },
  {
    folder: "03_Conteudos",
    label: "Conteúdo, roteiro e copy",
    keywords: [
      "roteiro", "script", "reels", "video", "youtube", "tiktok", "carrossel", "copy", "copywriting", "headline",
      "gancho", "hook", "cta", "legenda", "post", "story", "stories", "conteudo", "criativo",
    ],
  },
  {
    folder: "01_Estrategia",
    label: "Estratégia e posicionamento",
    keywords: [
      "estrategia", "posicionamento", "branding", "marca", "brand voice", "tom de voz", "persona", "publico-alvo",
      "proposta de valor", "objetivo estrategico", "missao", "visao", "diretriz",
    ],
  },
  {
    folder: "02_Produtos",
    label: "Produtos e oferta",
    keywords: [
      "produto", "produtos", "catalogo", "sku", "preco", "pricing", "acabamento", "especificacao", "material",
      "planner", "devocional", "caderno", "agenda", "brinde", "encadernacao",
    ],
  },
  {
    folder: "04_Campanhas",
    label: "Campanhas e lançamentos",
    keywords: ["campanha", "lancamento", "cronograma", "midia paga", "meta ads", "trafego pago", "oferta sazonal", "black friday"],
  },
  {
    folder: "05_Reunioes",
    label: "Reuniões e briefings",
    keywords: ["reuniao", "ata", "briefing", "alinhamento", "participantes", "pauta", "decisao da reuniao"],
  },
  {
    folder: "06_Influenciadores_UGC",
    label: "Influenciadores, parceiros e UGC",
    keywords: ["influenciador", "influenciadores", "ugc", "creator", "criador", "parceria", "afiliado", "cupom", "unboxing"],
  },
  {
    folder: "07_Pesquisas",
    label: "Pesquisa, mercado e benchmark",
    keywords: ["pesquisa", "benchmark", "concorrente", "concorrencia", "mercado", "tendencia", "estudo", "referencia", "referencias"],
  },
];

export interface KnowledgeTriageClassification {
  folder: string;
  relativeFolder: NistiKnowledgeFolder;
  label: string;
  confidence: number;
  score: number;
  reason: string;
}

export function classifyKnowledgeForVault(note: Pick<ObsidianNote, "title" | "content" | "frontmatter" | "tags">): KnowledgeTriageClassification {
  const title = normalize(note.title);
  const content = normalize(note.content);
  const frontmatter = note.frontmatter || {};
  const metadata = normalize([
    frontmatter.tipo,
    frontmatter.type,
    frontmatter.category,
    frontmatter.categoria,
    frontmatter.canal,
    frontmatter.platform,
    frontmatter.formato,
    frontmatter.format,
    frontmatter.origem,
  ].filter(Boolean).join(" "));
  const tags = normalize([...strings(note.tags), ...strings(frontmatter.tags), ...strings(frontmatter.keywords)].join(" "));

  const ranked = RULES.map((rule) => {
    let score = 0;
    const hits: string[] = [];
    for (const keyword of rule.keywords) {
      const token = normalize(keyword);
      let keywordScore = 0;
      if (title.includes(token)) keywordScore += 4;
      if (metadata.includes(token)) keywordScore += 5;
      if (tags.includes(token)) keywordScore += 4;
      if (content.includes(token)) keywordScore += 1;
      if (keywordScore > 0) {
        score += keywordScore;
        hits.push(keyword);
      }
    }
    return { rule, score, hits };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score === 0) {
    return {
      folder: NISTI_INBOX_FOLDER,
      relativeFolder: "00_Inbox",
      label: "Triagem pendente",
      confidence: 0.35,
      score: 0,
      reason: "Nenhum sinal forte de classificação foi encontrado.",
    };
  }

  const margin = Math.max(0, best.score - (second?.score || 0));
  const confidence = Math.min(0.99, 0.52 + Math.min(best.score, 12) * 0.03 + Math.min(margin, 8) * 0.02);
  return {
    folder: qualifyNistiKnowledgeFolder(best.rule.folder),
    relativeFolder: best.rule.folder,
    label: best.rule.label,
    confidence: Number(confidence.toFixed(2)),
    score: best.score,
    reason: best.hits.length ? `Sinais detectados: ${best.hits.slice(0, 5).join(", ")}` : "Classificação por contexto.",
  };
}
