import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Anchor not found: ${label}`);
  return source.replace(search, replacement);
}

function replaceRegex(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`Pattern not found: ${label}`);
  return source.replace(regex, replacement);
}

const automationService = `import type { ObsidianNote } from "../types";

export const NISTI_VAULT_ROOT = "Nisti Marketing";
export const NISTI_RELATIVE_FOLDERS = [
  "00_Inbox",
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
  (folder) => \\`${NISTI_VAULT_ROOT}/\\${folder}\\`,
);
export const NISTI_INBOX_FOLDER = \\`${NISTI_VAULT_ROOT}/00_Inbox\\`;
export const AUTO_TRIAGE_CONFIDENCE = 0.82;

const FOLDER_SET = new Set<string>(NISTI_RELATIVE_FOLDERS);

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase();
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\\n]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export function encodeVaultRelativePath(value: string): string {
  return value
    .replace(/\\\\/g, "/")
    .replace(/^\\/+|\\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function stripNistiKnowledgeRoot(value: string): string {
  const clean = String(value || "").replace(/\\\\/g, "/").replace(/^\\/+|\\/+$/g, "").trim();
  const prefix = \\`${NISTI_VAULT_ROOT}/\\`;
  return clean.toLowerCase().startsWith(prefix.toLowerCase()) ? clean.slice(prefix.length) : clean;
}

export function qualifyNistiKnowledgeFolder(value: string | undefined | null): string {
  const relative = stripNistiKnowledgeRoot(String(value || "00_Inbox")).split("/")[0] || "00_Inbox";
  const safeFolder = FOLDER_SET.has(relative) ? relative : "00_Inbox";
  return \\`${NISTI_VAULT_ROOT}/\\${safeFolder}\\`;
}

export function qualifyNistiKnowledgePath(value: string): string {
  let clean = String(value || "")
    .replace(/\\\\/g, "/")
    .replace(/^\\/+/, "")
    .replace(/^vault\\//i, "")
    .trim();
  if (!clean) return \\`${NISTI_INBOX_FOLDER}/Nova Nota.md\\`;
  if (clean.toLowerCase().startsWith(\\`${NISTI_VAULT_ROOT.toLowerCase()}/\\`)) return clean;

  const parts = clean.split("/").filter(Boolean);
  if (parts.length > 1 && FOLDER_SET.has(parts[0])) return \\`${NISTI_VAULT_ROOT}/\\${clean}\\`;
  if (parts.length === 1) return \\`${NISTI_INBOX_FOLDER}/\\${parts[0]}\\`;
  return \\`${NISTI_INBOX_FOLDER}/\\${parts[parts.length - 1]}\\`;
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
    reason: best.hits.length ? \\`Sinais detectados: \\${best.hits.slice(0, 5).join(", ")}\\` : "Classificação por contexto.",
  };
}
`;

fs.writeFileSync('src/services/obsidianKnowledgeAutomation.ts', automationService);

const testContent = `import { describe, expect, it } from "bun:test";
import {
  AUTO_TRIAGE_CONFIDENCE,
  NISTI_INBOX_FOLDER,
  NISTI_KNOWLEDGE_FOLDERS,
  classifyKnowledgeForVault,
  qualifyNistiKnowledgeFolder,
  qualifyNistiKnowledgePath,
} from "../src/services/obsidianKnowledgeAutomation";

function note(title: string, content: string, frontmatter: Record<string, unknown> = {}, tags: string[] = []) {
  return { title, content, frontmatter, tags };
}

describe("Obsidian smart knowledge automation", () => {
  it("uses a single Nisti Marketing root", () => {
    expect(NISTI_KNOWLEDGE_FOLDERS).toContain("Nisti Marketing/00_Inbox");
    expect(qualifyNistiKnowledgeFolder("03_Conteudos")).toBe("Nisti Marketing/03_Conteudos");
    expect(qualifyNistiKnowledgePath("03_Conteudos/Roteiro.md")).toBe("Nisti Marketing/03_Conteudos/Roteiro.md");
    expect(qualifyNistiKnowledgePath("captura.md")).toBe("Nisti Marketing/00_Inbox/captura.md");
  });

  it("classifies scripts and video references as content", () => {
    const result = classifyKnowledgeForVault(note("Roteiro Reels lançamento", "Gancho, cenas do vídeo e CTA final para Instagram Reels."));
    expect(result.folder).toBe("Nisti Marketing/03_Conteudos");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_TRIAGE_CONFIDENCE);
  });

  it("classifies Instagram and TikTok performance as learnings", () => {
    const result = classifyKnowledgeForVault(note("Instagram Insights - Reels", "Alcance 28000, salvamentos 870, compartilhamentos 430, retenção e CTR."));
    expect(result.folder).toBe("Nisti Marketing/08_Aprendizados");
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_TRIAGE_CONFIDENCE);
  });

  it("keeps ambiguous information in inbox", () => {
    const result = classifyKnowledgeForVault(note("Anotação", "Lembrar de verificar isso depois."));
    expect(result.folder).toBe(NISTI_INBOX_FOLDER);
    expect(result.confidence).toBeLessThan(AUTO_TRIAGE_CONFIDENCE);
  });
});
`;
fs.writeFileSync('tests/obsidianKnowledgeAutomation.test.ts', testContent);

let api = fs.readFileSync('src/services/api.ts', 'utf8');
api = replaceOnce(
  api,
  `import {\n  knowledgeContextService,\n  type KnowledgeContextSource,\n} from "./knowledge/KnowledgeContextService";`,
  `import {\n  knowledgeContextService,\n  type KnowledgeContextSource,\n} from "./knowledge/KnowledgeContextService";\nimport {\n  AUTO_TRIAGE_CONFIDENCE,\n  NISTI_INBOX_FOLDER,\n  NISTI_KNOWLEDGE_FOLDERS,\n  NISTI_RELATIVE_FOLDERS,\n  NISTI_VAULT_ROOT,\n  classifyKnowledgeForVault,\n  encodeVaultRelativePath,\n  qualifyNistiKnowledgePath,\n} from "./obsidianKnowledgeAutomation";`,
  'api import',
);
api = replaceOnce(api, 'let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;', 'let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;\nlet obsidianHeartbeatBusy = false;', 'heartbeat busy');
api = replaceOnce(
  api,
  `export interface ObsidianConnectionResult {`,
  `function serializeApiFrontmatter(frontmatter?: Record<string, unknown>): string {\n  if (!frontmatter || Object.keys(frontmatter).length === 0) return "";\n  const lines = ["---"];\n  for (const [key, value] of Object.entries(frontmatter)) {\n    if (value === undefined || value === null || value === "") continue;\n    if (Array.isArray(value)) {\n      if (value.length === 0) continue;\n      lines.push(\\`${key}:\\`);\n      for (const item of value) lines.push(\\`  - "\\${String(item).replace(/"/g, "'")}"\\`);\n    } else {\n      lines.push(\\`${key}: "\\${String(value).replace(/"/g, "'")}"\\`);\n    }\n  }\n  return \\`${lines.join("\\n")}\\n---\\n\\n\\`;\n}\n\nexport interface ObsidianConnectionResult {`,
  'frontmatter serializer',
);
api = replaceRegex(api, /async function inspectDesktopVault\([\s\S]*?\n}\n\nexport async function syncWebObsidianNotes/, 'export async function syncWebObsidianNotes', 'remove physical vault selection');
api = replaceOnce(api, '  await crawl("");', '  await crawl(NISTI_VAULT_ROOT);', 'crawl Nisti root');
api = replaceRegex(
  api,
  /async function publishCurrentDesktopVaultSnapshot\([\s\S]*?\n}\n\nfunction stopObsidianHeartbeat/,
  `async function publishCurrentDesktopVaultSnapshot(\n  folders?: string[],\n  configOverride?: ObsidianApiConfig,\n): Promise<{ notes: number; folders: number }> {\n  try {\n    const config = configOverride || await storage.loadApiConfig(DEFAULT_API_CONFIG);\n    if (!isObsidianRuntimeConnected() || !config.apiKey.trim()) return { notes: 0, folders: 0 };\n    const notes = await syncWebObsidianNotes(config);\n    const folderList = folders?.length ? folders : [...NISTI_KNOWLEDGE_FOLDERS];\n    publishObsidianSnapshot(notes, folderList);\n    return { notes: notes.length, folders: folderList.length };\n  } catch (error) {\n    console.warn("Could not publish REST-first Obsidian snapshot:", error);\n    return { notes: 0, folders: 0 };\n  }\n}\n\nasync function ensureNistiRemoteStructure(config: ObsidianApiConfig): Promise<{ createdFolders: string[] }> {\n  const createdFolders: string[] = [];\n  for (const relativeFolder of NISTI_RELATIVE_FOLDERS) {\n    const folder = \\`${NISTI_VAULT_ROOT}/\\${relativeFolder}\\`;\n    const encodedFolder = encodeVaultRelativePath(folder);\n    const probe = await obsidianProxyRequest(config, "GET", \\`/vault/\\${encodedFolder}/\\`);\n    if (probe.response.ok && probe.data?.success) continue;\n\n    const marker = await obsidianProxyRequest(\n      config,\n      "PUT",\n      \\`/vault/\\${encodedFolder}/.nisti-folder\\`,\n      \\`managed-by: nisti-marketing\\nfolder: \\${relativeFolder}\\n\\`,\n    );\n    if (!marker.response.ok || !marker.data?.success) {\n      throw new Error(\\`Não foi possível criar a pasta \\${folder} no Obsidian.\\`);\n    }\n    createdFolders.push(folder);\n  }\n\n  const manifestPath = encodeVaultRelativePath(\\`${NISTI_VAULT_ROOT}/.nisti/structure.json\\`);\n  const manifest = JSON.stringify({\n    managedBy: "nisti-marketing",\n    schemaVersion: "3.1-smart-inbox-v1",\n    root: NISTI_VAULT_ROOT,\n    folders: NISTI_RELATIVE_FOLDERS,\n    updatedAt: new Date().toISOString(),\n  }, null, 2);\n  const manifestResult = await obsidianProxyRequest(config, "PUT", \\`/vault/\\${manifestPath}\\`, manifest);\n  if (!manifestResult.response.ok || !manifestResult.data?.success) {\n    throw new Error("A estrutura foi criada, mas o manifesto do Nisti não pôde ser gravado.");\n  }\n\n  return { createdFolders };\n}\n\ninterface InboxTriageResult {\n  moved: Array<{ from: string; to: string; confidence: number }>;\n  pending: Array<{ path: string; confidence: number; suggestion: string; reason: string }>;\n  failed: Array<{ path: string; error: string }>;\n}\n\nasync function triageNistiInbox(config: ObsidianApiConfig): Promise<InboxTriageResult> {\n  const result: InboxTriageResult = { moved: [], pending: [], failed: [] };\n  const notes = await syncWebObsidianNotes(config);\n  const inboxPrefix = \\`${NISTI_INBOX_FOLDER}/\\`.toLowerCase();\n  const inboxNotes = notes.filter((note) => {\n    const folder = String(note.folder || "").replace(/\\\\/g, "/").toLowerCase();\n    if (!(folder === NISTI_INBOX_FOLDER.toLowerCase() || folder.startsWith(inboxPrefix))) return false;\n    const triageMode = String(note.frontmatter?.triage_mode || "").toLowerCase();\n    return triageMode !== "manual" && note.frontmatter?.nisti_keep_in_inbox !== true;\n  });\n\n  for (const note of inboxNotes) {\n    const classification = classifyKnowledgeForVault(note);\n    if (classification.folder === NISTI_INBOX_FOLDER || classification.confidence < AUTO_TRIAGE_CONFIDENCE) {\n      result.pending.push({\n        path: note.path,\n        confidence: classification.confidence,\n        suggestion: classification.folder,\n        reason: classification.reason,\n      });\n      continue;\n    }\n\n    const filename = note.path.replace(/\\\\/g, "/").split("/").pop() || \\`${note.title}.md\\`;\n    const targetPath = \\`${classification.folder}/\\${filename}\\`;\n    try {\n      const targetProbe = await obsidianProxyRequest(config, "GET", \\`/vault/\\${encodeVaultRelativePath(targetPath)}\\`);\n      if (targetProbe.response.ok && targetProbe.data?.success) {\n        result.pending.push({\n          path: note.path,\n          confidence: classification.confidence,\n          suggestion: classification.folder,\n          reason: "Já existe uma nota com o mesmo nome no destino; revisão humana necessária.",\n        });\n        continue;\n      }\n\n      const source = await obsidianProxyRequest(config, "GET", \\`/vault/\\${encodeVaultRelativePath(note.path)}\\`);\n      const rawMarkdown = typeof source.data?.data === "string" ? source.data.data : "";\n      if (!source.response.ok || !source.data?.success || !rawMarkdown) throw new Error("Não foi possível ler a nota original.");\n\n      const write = await obsidianProxyRequest(config, "PUT", \\`/vault/\\${encodeVaultRelativePath(targetPath)}\\`, rawMarkdown);\n      if (!write.response.ok || !write.data?.success) throw new Error("O Obsidian não confirmou a gravação no destino.");\n\n      const remove = await obsidianProxyRequest(config, "DELETE", \\`/vault/\\${encodeVaultRelativePath(note.path)}\\`);\n      if (!remove.response.ok || !remove.data?.success) {\n        await obsidianProxyRequest(config, "DELETE", \\`/vault/\\${encodeVaultRelativePath(targetPath)}\\`).catch(() => undefined);\n        throw new Error("A nota foi copiada, mas a remoção da Inbox falhou; a cópia foi revertida.");\n      }\n\n      result.moved.push({ from: note.path, to: targetPath, confidence: classification.confidence });\n    } catch (error: any) {\n      result.failed.push({ path: note.path, error: error?.message || String(error) });\n    }\n  }\n\n  return result;\n}\n\nfunction stopObsidianHeartbeat`,
  'REST snapshot/bootstrap/triage',
);
api = replaceRegex(
  api,
  /function startObsidianHeartbeat\([\s\S]*?\n}\n\nasync function verifyObsidianConnection/,
  `function startObsidianHeartbeat(config: { endpoint: string; apiKey: string }): void {\n  stopObsidianHeartbeat();\n  if (typeof window === "undefined") return;\n\n  const liveConfig: ObsidianApiConfig = {\n    ...DEFAULT_API_CONFIG,\n    endpoint: config.endpoint,\n    apiKey: config.apiKey,\n    connectionStatus: "connected",\n  };\n\n  obsidianHeartbeat = setInterval(async () => {\n    if (obsidianHeartbeatBusy) return;\n    obsidianHeartbeatBusy = true;\n    try {\n      const { res, data } = await requestObsidianConnectionTest(liveConfig);\n      if (!res.ok || !data?.success) {\n        stopObsidianHeartbeat();\n        await setDesktopObsidianAuthorization(false);\n        markObsidianRuntimeDisconnected(\n          data?.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",\n        );\n        return;\n      }\n\n      try {\n        await triageNistiInbox(liveConfig);\n        await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);\n      } catch (automationError) {\n        console.warn("Obsidian connected, but automatic knowledge triage failed:", automationError);\n      }\n    } catch (err: any) {\n      stopObsidianHeartbeat();\n      await setDesktopObsidianAuthorization(false);\n      markObsidianRuntimeDisconnected(\n        err.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",\n      );\n    } finally {\n      obsidianHeartbeatBusy = false;\n    }\n  }, 20_000);\n}\n\nasync function verifyObsidianConnection`,
  'REST heartbeat',
);
api = replaceRegex(
  api,
  /async function verifyObsidianConnection\([\s\S]*?\n}\n\nasync function requireVerifiedObsidian/,
  `async function verifyObsidianConnection(\n  config: { endpoint: string; apiKey: string },\n  _selectVault: boolean,\n): Promise<ObsidianConnectionResult> {\n  if (!config.endpoint.trim() || !config.apiKey.trim()) {\n    stopObsidianHeartbeat();\n    await setDesktopObsidianAuthorization(false);\n    markObsidianRuntimeDisconnected("Endpoint ou token do Obsidian não configurado.");\n    return { success: false, message: "Informe o endpoint e o token do Obsidian Local REST API." };\n  }\n\n  const liveConfig: ObsidianApiConfig = {\n    ...DEFAULT_API_CONFIG,\n    endpoint: normalizeObsidianEndpoint(config.endpoint),\n    apiKey: config.apiKey.trim(),\n    connectionStatus: "connected",\n  };\n\n  try {\n    const { res, data } = await requestObsidianConnectionTest(liveConfig);\n    if (!res.ok || !data?.success) {\n      const targetEndpoint = normalizeObsidianEndpoint(config.endpoint);\n      const errorMsg = data?.message || "Conexão rejeitada.";\n      await setDesktopObsidianAuthorization(false);\n      markObsidianRuntimeDisconnected(errorMsg);\n      return {\n        success: false,\n        message: \\`Não foi possível conectar ao Obsidian local (\\${targetEndpoint}). Verifique se o Obsidian está aberto, o Local REST API está ativo e a API Key está correta. Detalhes: \\${errorMsg}\\`,\n      };\n    }\n\n    await setDesktopObsidianAuthorization(true);\n    markObsidianRuntimeConnected();\n\n    const structure = await ensureNistiRemoteStructure(liveConfig);\n    const triage = await triageNistiInbox(liveConfig);\n    const snapshot = await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);\n    startObsidianHeartbeat(liveConfig);\n\n    const detectedVault = String(data.vault || data.name || "Vault ativo");\n    const createdText = structure.createdFolders.length\n      ? \\` \\${structure.createdFolders.length} pastas foram criadas automaticamente.\\`\n      : " Estrutura Nisti já estava pronta.";\n    const triageText = triage.moved.length ? \\` \\${triage.moved.length} nova(s) nota(s) foram classificadas.\\` : "";\n    return {\n      success: true,\n      detectedVaultName: detectedVault,\n      localNotesFound: snapshot.notes,\n      localFoldersFound: NISTI_KNOWLEDGE_FOLDERS.length,\n      localFolders: [...NISTI_KNOWLEDGE_FOLDERS],\n      message: \\`Obsidian conectado. A pasta “\\${NISTI_VAULT_ROOT}” está pronta dentro do Vault ativo.\\${createdText}\\${triageText}\\`,\n    };\n  } catch (err: any) {\n    stopObsidianHeartbeat();\n    await setDesktopObsidianAuthorization(false);\n    const message = err?.message || "Não foi possível preparar a Base de Conhecimento no Obsidian.";\n    markObsidianRuntimeDisconnected(message);\n    return { success: false, message };\n  }\n}\n\nasync function requireVerifiedObsidian`,
  'unified REST connection',
);
api = replaceOnce(
  api,
  `async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {\n  return await verifyObsidianConnection(\n    { endpoint: config.endpoint, apiKey: config.apiKey },\n    false\n  );\n}`,
  `async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {\n  if (isObsidianRuntimeConnected()) {\n    return {\n      success: true,\n      message: "Obsidian já validado nesta sessão.",\n      localFolders: [...NISTI_KNOWLEDGE_FOLDERS],\n      localFoldersFound: NISTI_KNOWLEDGE_FOLDERS.length,\n    };\n  }\n  return await verifyObsidianConnection(\n    { endpoint: config.endpoint, apiKey: config.apiKey },\n    false,\n  );\n}`,
  'verified connection fast path',
);
api = replaceOnce(
  api,
  `          const cleanPath = filePath\n            .replace(/^\\//, "")\n            .replace(/^vault\\//, "")\n            .replace(/\\\\/g, "/");`,
  `          const cleanPath = qualifyNistiKnowledgePath(filePath);`,
  'desktop qualified path',
);
api = replaceOnce(
  api,
  `    const cleanPath = filePath.startsWith("/") ? filePath : \\`/vault/\\${filePath}\\`;\n    const encodedPath = cleanPath\n      .split("/")\n      .map((segment, index) => {\n        if (segment === "" || (index === 1 && segment === "vault")) return segment;\n        return encodeURIComponent(segment);\n      })\n      .join("/");\n    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, markdownContent);`,
  `    const qualifiedPath = qualifyNistiKnowledgePath(filePath);\n    const encodedPath = \\`/vault/\\${encodeVaultRelativePath(qualifiedPath)}\\`;\n    const payloadMarkdown = markdownContent.trimStart().startsWith("---")\n      ? markdownContent\n      : \\`${serializeApiFrontmatter(frontmatter)}\\${markdownContent}\\`;\n    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, payloadMarkdown);`,
  'REST write qualified path and frontmatter',
);
api = replaceOnce(api, '            "00_Inbox",\n            `Daily-${today}`', '            NISTI_INBOX_FOLDER,\n            `Daily-${today}`', 'daily electron root');
api = replaceOnce(api, '    const targetPath = `/vault/00_Inbox/Daily-${today}.md`;', '    const targetPath = `/vault/${encodeVaultRelativePath(`${NISTI_INBOX_FOLDER}/Daily-${today}.md`)}`;', 'daily REST root');
api = replaceOnce(api, '            "00_Inbox",\n            `Daily-${today}`,\n            `\\n${contentToAppend}`', '            NISTI_INBOX_FOLDER,\n            `Daily-${today}`,\n            `\\n${contentToAppend}`', 'append daily root');
fs.writeFileSync('src/services/api.ts', api);

let add = fs.readFileSync('src/components/AddKnowledgeView.tsx', 'utf8');
add = replaceOnce(
  add,
  `import { api } from "../services/api";`,
  `import { api } from "../services/api";\nimport {\n  NISTI_INBOX_FOLDER,\n  NISTI_KNOWLEDGE_FOLDERS,\n  qualifyNistiKnowledgeFolder,\n} from "../services/obsidianKnowledgeAutomation";`,
  'add knowledge import',
);
add = replaceOnce(
  add,
  `function chooseLiveFolder(suggestedFolder: string, liveFolders: string[]): string {\n  const folders = Array.from(new Set(liveFolders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));\n  if (folders.includes(suggestedFolder)) return suggestedFolder;\n  if (folders.includes("00_Inbox")) return "00_Inbox";\n  return folders[0] || "00_Inbox";\n}`,
  `function chooseLiveFolder(suggestedFolder: string, liveFolders: string[]): string {\n  const folders = Array.from(new Set(liveFolders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));\n  const qualified = qualifyNistiKnowledgeFolder(suggestedFolder);\n  if (folders.includes(qualified)) return qualified;\n  if (folders.includes(NISTI_INBOX_FOLDER)) return NISTI_INBOX_FOLDER;\n  return folders[0] || NISTI_INBOX_FOLDER;\n}`,
  'choose Nisti folder',
);
add = replaceRegex(
  add,
  /  useEffect\(\(\) => \{[\s\S]*?  \}, \[isConnected, notes\.length\]\);/,
  `  useEffect(() => {\n    setVaultFolders(isConnected ? [...NISTI_KNOWLEDGE_FOLDERS] : []);\n  }, [isConnected]);`,
  'canonical folder effect',
);
add = add.replace('  notes,\n  onAddNote,', '  onAddNote,');
add = add.replaceAll('folder === "00_Inbox"', 'folder === NISTI_INBOX_FOLDER');
add = add.replaceAll('folder !== "00_Inbox"', 'folder !== NISTI_INBOX_FOLDER');
add = add.replaceAll('vaultFolders.includes("00_Inbox")', 'vaultFolders.includes(NISTI_INBOX_FOLDER)');
add = replaceOnce(add, '    const folder = forceInbox ? "00_Inbox" : proposal.folder;', '    const folder = forceInbox ? NISTI_INBOX_FOLDER : proposal.folder;', 'force inbox root');
add = replaceOnce(add, '    if (window.electronAPI && !vaultFolders.includes(folder)) {', '    if (!vaultFolders.includes(folder)) {', 'folder validation');
add = replaceOnce(
  add,
  `      if (window.electronAPI?.commitKnowledge) {`,
  `      const physicalVaultPath = window.electronAPI?.getVaultPath\n        ? await window.electronAPI.getVaultPath().catch(() => null)\n        : null;\n\n      if (window.electronAPI?.commitKnowledge && physicalVaultPath) {`,
  'physical commit optional',
);
add = replaceOnce(
  add,
  `      } else {\n        if (isBinarySource) {\n          throw new Error("A preservação do arquivo original exige o runtime desktop. A gravação foi bloqueada para não criar uma síntese sem a fonte física.");\n        }\n        const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, curatedContent, baseFrontmatter);`,
  `      } else {\n        if (isBinarySource) {\n          committedFrontmatter = {\n            ...committedFrontmatter,\n            source_type: "analyzed_binary_source",\n            source_preservation: "analysis_only_rest_stage1",\n          };\n        }\n        const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, curatedContent, committedFrontmatter);`,
  'REST fallback for all knowledge',
);
add = add.replace('PDF detectado. O original será preservado junto da síntese após sua aprovação.', 'PDF detectado. O Nisti analisa e classifica a fonte; a síntese será gravada no Obsidian após sua aprovação.');
add = add.replace('Imagem detectada. A análise visual e o arquivo original serão preservados após sua aprovação.', 'Imagem detectada. O Nisti analisa, classifica e grava a síntese no Obsidian após sua aprovação.');
add = add.replace('Ela será preservada somente quando você aprovar a gravação.', 'A análise será preservada no Obsidian quando você aprovar a gravação.');
add = add.replace('Salvar em 00_Inbox', 'Salvar na Inbox');
fs.writeFileSync('src/components/AddKnowledgeView.tsx', add);

const architectureDoc = `# Nisti Marketing 3.1 — Smart Knowledge Pipeline\n\n## Entrega em duas etapas\n\n### Etapa 1 — núcleo Obsidian e Inbox inteligente\n- Local REST API é o caminho principal de conexão.\n- Nenhuma seleção física de pasta é necessária para o fluxo padrão.\n- Após validar a API Key, o app cria a raiz \`Nisti Marketing/\` no Vault ativo.\n- A estrutura canônica é criada dentro dessa raiz.\n- Capturas externas devem entrar em \`Nisti Marketing/00_Inbox\`.\n- A Inbox é reavaliada automaticamente a cada heartbeat.\n- Classificações com confiança >= 0.82 são movidas automaticamente.\n- Ambiguidades e colisões permanecem na Inbox para revisão.\n- A ferramenta Adicionar fonte usa exatamente as mesmas pastas canônicas.\n\n### Etapa 2 — inteligência de planejamento e aprendizado\n- Transporte REST dos binários originais (PDF/imagem/áudio).\n- Transcrição de áudio.\n- Classificação assistida por IA quando as regras determinísticas forem inconclusivas.\n- Ingestão estruturada de métricas Instagram/TikTok.\n- Aprendizados em \`08_Aprendizados\` como evidência do planejador.\n- Planner grounded obrigatório com rastreabilidade das fontes usadas.\n\n## Regra de segurança\nA automação nunca sobrescreve uma nota existente no destino. Em caso de colisão, confiança baixa ou \`triage_mode: manual\`, a nota permanece na Inbox.\n`;
fs.writeFileSync('docs/OBSIDIAN-SMART-KNOWLEDGE-3.1.md', architectureDoc);

console.log('Stage 1 smart knowledge transformation applied.');
