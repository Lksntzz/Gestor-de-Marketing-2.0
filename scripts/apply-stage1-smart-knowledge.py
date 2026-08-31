from pathlib import Path
import re


def replace_once(source: str, search: str, replacement: str, label: str) -> str:
    if search not in source:
        raise RuntimeError(f"Anchor not found: {label}")
    return source.replace(search, replacement, 1)


def replace_regex(source: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, lambda _m: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Pattern not found or ambiguous: {label} ({count})")
    return updated


automation_service = r'''import type { ObsidianNote } from "../types";

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
'''
Path('src/services/obsidianKnowledgeAutomation.ts').write_text(automation_service, encoding='utf-8')

test_content = r'''import { describe, expect, it } from "bun:test";
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
'''
Path('tests/obsidianKnowledgeAutomation.test.ts').write_text(test_content, encoding='utf-8')

api_path = Path('src/services/api.ts')
api = api_path.read_text(encoding='utf-8')
api = replace_once(
    api,
    'import {\n  knowledgeContextService,\n  type KnowledgeContextSource,\n} from "./knowledge/KnowledgeContextService";',
    'import {\n  knowledgeContextService,\n  type KnowledgeContextSource,\n} from "./knowledge/KnowledgeContextService";\nimport {\n  AUTO_TRIAGE_CONFIDENCE,\n  NISTI_INBOX_FOLDER,\n  NISTI_KNOWLEDGE_FOLDERS,\n  NISTI_RELATIVE_FOLDERS,\n  NISTI_VAULT_ROOT,\n  classifyKnowledgeForVault,\n  encodeVaultRelativePath,\n  qualifyNistiKnowledgePath,\n} from "./obsidianKnowledgeAutomation";',
    'api import',
)
api = replace_once(api, 'let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;', 'let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;\nlet obsidianHeartbeatBusy = false;', 'heartbeat busy')
api = replace_once(
    api,
    'export interface ObsidianConnectionResult {',
    r'''function serializeApiFrontmatter(frontmatter?: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return "";
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - "${String(item).replace(/"/g, "'")}"`);
    } else {
      lines.push(`${key}: "${String(value).replace(/"/g, "'")}"`);
    }
  }
  return `${lines.join("\n")}\n---\n\n`;
}

export interface ObsidianConnectionResult {''',
    'frontmatter serializer',
)
api = replace_regex(api, r'async function inspectDesktopVault\([\s\S]*?\n}\n\nexport async function syncWebObsidianNotes', 'export async function syncWebObsidianNotes', 'remove physical vault selection')
api = replace_once(api, '  await crawl("");', '  await crawl(NISTI_VAULT_ROOT);', 'crawl Nisti root')
api = replace_regex(
    api,
    r'async function publishCurrentDesktopVaultSnapshot\([\s\S]*?\n}\n\nfunction stopObsidianHeartbeat',
    r'''async function publishCurrentDesktopVaultSnapshot(
  folders?: string[],
  configOverride?: ObsidianApiConfig,
): Promise<{ notes: number; folders: number }> {
  try {
    const config = configOverride || await storage.loadApiConfig(DEFAULT_API_CONFIG);
    if (!isObsidianRuntimeConnected() || !config.apiKey.trim()) return { notes: 0, folders: 0 };
    const notes = await syncWebObsidianNotes(config);
    const folderList = folders?.length ? folders : [...NISTI_KNOWLEDGE_FOLDERS];
    publishObsidianSnapshot(notes, folderList);
    return { notes: notes.length, folders: folderList.length };
  } catch (error) {
    console.warn("Could not publish REST-first Obsidian snapshot:", error);
    return { notes: 0, folders: 0 };
  }
}

async function ensureNistiRemoteStructure(config: ObsidianApiConfig): Promise<{ createdFolders: string[] }> {
  const createdFolders: string[] = [];
  for (const relativeFolder of NISTI_RELATIVE_FOLDERS) {
    const folder = `${NISTI_VAULT_ROOT}/${relativeFolder}`;
    const encodedFolder = encodeVaultRelativePath(folder);
    const probe = await obsidianProxyRequest(config, "GET", `/vault/${encodedFolder}/`);
    if (probe.response.ok && probe.data?.success) continue;

    const marker = await obsidianProxyRequest(
      config,
      "PUT",
      `/vault/${encodedFolder}/.nisti-folder`,
      `managed-by: nisti-marketing\nfolder: ${relativeFolder}\n`,
    );
    if (!marker.response.ok || !marker.data?.success) {
      throw new Error(`Não foi possível criar a pasta ${folder} no Obsidian.`);
    }
    createdFolders.push(folder);
  }

  const manifestPath = encodeVaultRelativePath(`${NISTI_VAULT_ROOT}/.nisti/structure.json`);
  const manifest = JSON.stringify({
    managedBy: "nisti-marketing",
    schemaVersion: "3.1-smart-inbox-v1",
    root: NISTI_VAULT_ROOT,
    folders: NISTI_RELATIVE_FOLDERS,
    updatedAt: new Date().toISOString(),
  }, null, 2);
  const manifestResult = await obsidianProxyRequest(config, "PUT", `/vault/${manifestPath}`, manifest);
  if (!manifestResult.response.ok || !manifestResult.data?.success) {
    throw new Error("A estrutura foi criada, mas o manifesto do Nisti não pôde ser gravado.");
  }

  return { createdFolders };
}

interface InboxTriageResult {
  moved: Array<{ from: string; to: string; confidence: number }>;
  pending: Array<{ path: string; confidence: number; suggestion: string; reason: string }>;
  failed: Array<{ path: string; error: string }>;
}

async function triageNistiInbox(config: ObsidianApiConfig): Promise<InboxTriageResult> {
  const result: InboxTriageResult = { moved: [], pending: [], failed: [] };
  const notes = await syncWebObsidianNotes(config);
  const inboxPrefix = `${NISTI_INBOX_FOLDER}/`.toLowerCase();
  const inboxNotes = notes.filter((note) => {
    const folder = String(note.folder || "").replace(/\\/g, "/").toLowerCase();
    if (!(folder === NISTI_INBOX_FOLDER.toLowerCase() || folder.startsWith(inboxPrefix))) return false;
    const triageMode = String(note.frontmatter?.triage_mode || "").toLowerCase();
    return triageMode !== "manual" && note.frontmatter?.nisti_keep_in_inbox !== true;
  });

  for (const note of inboxNotes) {
    const classification = classifyKnowledgeForVault(note);
    if (classification.folder === NISTI_INBOX_FOLDER || classification.confidence < AUTO_TRIAGE_CONFIDENCE) {
      result.pending.push({
        path: note.path,
        confidence: classification.confidence,
        suggestion: classification.folder,
        reason: classification.reason,
      });
      continue;
    }

    const filename = note.path.replace(/\\/g, "/").split("/").pop() || `${note.title}.md`;
    const targetPath = `${classification.folder}/${filename}`;
    try {
      const targetProbe = await obsidianProxyRequest(config, "GET", `/vault/${encodeVaultRelativePath(targetPath)}`);
      if (targetProbe.response.ok && targetProbe.data?.success) {
        result.pending.push({
          path: note.path,
          confidence: classification.confidence,
          suggestion: classification.folder,
          reason: "Já existe uma nota com o mesmo nome no destino; revisão humana necessária.",
        });
        continue;
      }

      const source = await obsidianProxyRequest(config, "GET", `/vault/${encodeVaultRelativePath(note.path)}`);
      const rawMarkdown = typeof source.data?.data === "string" ? source.data.data : "";
      if (!source.response.ok || !source.data?.success || !rawMarkdown) throw new Error("Não foi possível ler a nota original.");

      const write = await obsidianProxyRequest(config, "PUT", `/vault/${encodeVaultRelativePath(targetPath)}`, rawMarkdown);
      if (!write.response.ok || !write.data?.success) throw new Error("O Obsidian não confirmou a gravação no destino.");

      const remove = await obsidianProxyRequest(config, "DELETE", `/vault/${encodeVaultRelativePath(note.path)}`);
      if (!remove.response.ok || !remove.data?.success) {
        await obsidianProxyRequest(config, "DELETE", `/vault/${encodeVaultRelativePath(targetPath)}`).catch(() => undefined);
        throw new Error("A nota foi copiada, mas a remoção da Inbox falhou; a cópia foi revertida.");
      }

      result.moved.push({ from: note.path, to: targetPath, confidence: classification.confidence });
    } catch (error: any) {
      result.failed.push({ path: note.path, error: error?.message || String(error) });
    }
  }

  return result;
}

function stopObsidianHeartbeat''',
    'REST snapshot/bootstrap/triage',
)
api = replace_regex(
    api,
    r'function startObsidianHeartbeat\([\s\S]*?\n}\n\nasync function verifyObsidianConnection',
    r'''function startObsidianHeartbeat(config: { endpoint: string; apiKey: string }): void {
  stopObsidianHeartbeat();
  if (typeof window === "undefined") return;

  const liveConfig: ObsidianApiConfig = {
    ...DEFAULT_API_CONFIG,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    connectionStatus: "connected",
  };

  obsidianHeartbeat = setInterval(async () => {
    if (obsidianHeartbeatBusy) return;
    obsidianHeartbeatBusy = true;
    try {
      const { res, data } = await requestObsidianConnectionTest(liveConfig);
      if (!res.ok || !data?.success) {
        stopObsidianHeartbeat();
        await setDesktopObsidianAuthorization(false);
        markObsidianRuntimeDisconnected(
          data?.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",
        );
        return;
      }

      try {
        await triageNistiInbox(liveConfig);
        await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);
      } catch (automationError) {
        console.warn("Obsidian connected, but automatic knowledge triage failed:", automationError);
      }
    } catch (err: any) {
      stopObsidianHeartbeat();
      await setDesktopObsidianAuthorization(false);
      markObsidianRuntimeDisconnected(
        err.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento.",
      );
    } finally {
      obsidianHeartbeatBusy = false;
    }
  }, 20_000);
}

async function verifyObsidianConnection''',
    'REST heartbeat',
)
api = replace_regex(
    api,
    r'async function verifyObsidianConnection\([\s\S]*?\n}\n\nasync function requireVerifiedObsidian',
    r'''async function verifyObsidianConnection(
  config: { endpoint: string; apiKey: string },
  _selectVault: boolean,
): Promise<ObsidianConnectionResult> {
  if (!config.endpoint.trim() || !config.apiKey.trim()) {
    stopObsidianHeartbeat();
    await setDesktopObsidianAuthorization(false);
    markObsidianRuntimeDisconnected("Endpoint ou token do Obsidian não configurado.");
    return { success: false, message: "Informe o endpoint e o token do Obsidian Local REST API." };
  }

  const liveConfig: ObsidianApiConfig = {
    ...DEFAULT_API_CONFIG,
    endpoint: normalizeObsidianEndpoint(config.endpoint),
    apiKey: config.apiKey.trim(),
    connectionStatus: "connected",
  };

  try {
    const { res, data } = await requestObsidianConnectionTest(liveConfig);
    if (!res.ok || !data?.success) {
      const targetEndpoint = normalizeObsidianEndpoint(config.endpoint);
      const errorMsg = data?.message || "Conexão rejeitada.";
      await setDesktopObsidianAuthorization(false);
      markObsidianRuntimeDisconnected(errorMsg);
      return {
        success: false,
        message: `Não foi possível conectar ao Obsidian local (${targetEndpoint}). Verifique se o Obsidian está aberto, o Local REST API está ativo e a API Key está correta. Detalhes: ${errorMsg}`,
      };
    }

    await setDesktopObsidianAuthorization(true);
    markObsidianRuntimeConnected();

    const structure = await ensureNistiRemoteStructure(liveConfig);
    const triage = await triageNistiInbox(liveConfig);
    const snapshot = await publishCurrentDesktopVaultSnapshot([...NISTI_KNOWLEDGE_FOLDERS], liveConfig);
    startObsidianHeartbeat(liveConfig);

    const detectedVault = String(data.vault || data.name || "Vault ativo");
    const createdText = structure.createdFolders.length
      ? ` ${structure.createdFolders.length} pastas foram criadas automaticamente.`
      : " Estrutura Nisti já estava pronta.";
    const triageText = triage.moved.length ? ` ${triage.moved.length} nova(s) nota(s) foram classificadas.` : "";
    return {
      success: true,
      detectedVaultName: detectedVault,
      localNotesFound: snapshot.notes,
      localFoldersFound: NISTI_KNOWLEDGE_FOLDERS.length,
      localFolders: [...NISTI_KNOWLEDGE_FOLDERS],
      message: `Obsidian conectado. A pasta “${NISTI_VAULT_ROOT}” está pronta dentro do Vault ativo.${createdText}${triageText}`,
    };
  } catch (err: any) {
    stopObsidianHeartbeat();
    await setDesktopObsidianAuthorization(false);
    const message = err?.message || "Não foi possível preparar a Base de Conhecimento no Obsidian.";
    markObsidianRuntimeDisconnected(message);
    return { success: false, message };
  }
}

async function requireVerifiedObsidian''',
    'unified REST connection',
)
api = replace_once(
    api,
    '''async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {
  return await verifyObsidianConnection(
    { endpoint: config.endpoint, apiKey: config.apiKey },
    false
  );
}''',
    '''async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {
  if (isObsidianRuntimeConnected()) {
    return {
      success: true,
      message: "Obsidian já validado nesta sessão.",
      localFolders: [...NISTI_KNOWLEDGE_FOLDERS],
      localFoldersFound: NISTI_KNOWLEDGE_FOLDERS.length,
    };
  }
  return await verifyObsidianConnection(
    { endpoint: config.endpoint, apiKey: config.apiKey },
    false,
  );
}''',
    'verified connection fast path',
)
api = replace_once(
    api,
    '''          const cleanPath = filePath
            .replace(/^\//, "")
            .replace(/^vault\//, "")
            .replace(/\\/g, "/");''',
    '          const cleanPath = qualifyNistiKnowledgePath(filePath);',
    'desktop qualified path',
)
api = replace_once(
    api,
    '''    const cleanPath = filePath.startsWith("/") ? filePath : `/vault/${filePath}`;
    const encodedPath = cleanPath
      .split("/")
      .map((segment, index) => {
        if (segment === "" || (index === 1 && segment === "vault")) return segment;
        return encodeURIComponent(segment);
      })
      .join("/");
    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, markdownContent);''',
    '''    const qualifiedPath = qualifyNistiKnowledgePath(filePath);
    const encodedPath = `/vault/${encodeVaultRelativePath(qualifiedPath)}`;
    const payloadMarkdown = markdownContent.trimStart().startsWith("---")
      ? markdownContent
      : `${serializeApiFrontmatter(frontmatter)}${markdownContent}`;
    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, payloadMarkdown);''',
    'REST write qualified path and frontmatter',
)
api = replace_once(api, '            "00_Inbox",\n            `Daily-${today}`', '            NISTI_INBOX_FOLDER,\n            `Daily-${today}`', 'daily electron root')
api = replace_once(api, '    const targetPath = `/vault/00_Inbox/Daily-${today}.md`;', '    const targetPath = `/vault/${encodeVaultRelativePath(`${NISTI_INBOX_FOLDER}/Daily-${today}.md`)}`;', 'daily REST root')
api = replace_once(api, '            "00_Inbox",\n            `Daily-${today}`,\n            `\\n${contentToAppend}`', '            NISTI_INBOX_FOLDER,\n            `Daily-${today}`,\n            `\\n${contentToAppend}`', 'append daily root')
api_path.write_text(api, encoding='utf-8')

add_path = Path('src/components/AddKnowledgeView.tsx')
add = add_path.read_text(encoding='utf-8')
add = replace_once(
    add,
    'import { api } from "../services/api";',
    'import { api } from "../services/api";\nimport {\n  NISTI_INBOX_FOLDER,\n  NISTI_KNOWLEDGE_FOLDERS,\n  qualifyNistiKnowledgeFolder,\n} from "../services/obsidianKnowledgeAutomation";',
    'add knowledge import',
)
add = replace_once(
    add,
    '''function chooseLiveFolder(suggestedFolder: string, liveFolders: string[]): string {
  const folders = Array.from(new Set(liveFolders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (folders.includes(suggestedFolder)) return suggestedFolder;
  if (folders.includes("00_Inbox")) return "00_Inbox";
  return folders[0] || "00_Inbox";
}''',
    '''function chooseLiveFolder(suggestedFolder: string, liveFolders: string[]): string {
  const folders = Array.from(new Set(liveFolders.filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const qualified = qualifyNistiKnowledgeFolder(suggestedFolder);
  if (folders.includes(qualified)) return qualified;
  if (folders.includes(NISTI_INBOX_FOLDER)) return NISTI_INBOX_FOLDER;
  return folders[0] || NISTI_INBOX_FOLDER;
}''',
    'choose Nisti folder',
)
add = replace_regex(
    add,
    r'  useEffect\(\(\) => \{[\s\S]*?  \}, \[isConnected, notes\.length\]\);',
    '''  useEffect(() => {
    setVaultFolders(isConnected ? [...NISTI_KNOWLEDGE_FOLDERS] : []);
  }, [isConnected]);''',
    'canonical folder effect',
)
add = add.replace('  notes,\n  onAddNote,', '  onAddNote,', 1)
add = add.replace('folder === "00_Inbox"', 'folder === NISTI_INBOX_FOLDER')
add = add.replace('folder !== "00_Inbox"', 'folder !== NISTI_INBOX_FOLDER')
add = add.replace('vaultFolders.includes("00_Inbox")', 'vaultFolders.includes(NISTI_INBOX_FOLDER)')
add = replace_once(add, '    const folder = forceInbox ? "00_Inbox" : proposal.folder;', '    const folder = forceInbox ? NISTI_INBOX_FOLDER : proposal.folder;', 'force inbox root')
add = replace_once(add, '    if (window.electronAPI && !vaultFolders.includes(folder)) {', '    if (!vaultFolders.includes(folder)) {', 'folder validation')
add = replace_once(
    add,
    '      if (window.electronAPI?.commitKnowledge) {',
    '''      const physicalVaultPath = window.electronAPI?.getVaultPath
        ? await window.electronAPI.getVaultPath().catch(() => null)
        : null;

      if (window.electronAPI?.commitKnowledge && physicalVaultPath) {''',
    'physical commit optional',
)
add = replace_once(
    add,
    '''      } else {
        if (isBinarySource) {
          throw new Error("A preservação do arquivo original exige o runtime desktop. A gravação foi bloqueada para não criar uma síntese sem a fonte física.");
        }
        const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, curatedContent, baseFrontmatter);''',
    '''      } else {
        if (isBinarySource) {
          committedFrontmatter = {
            ...committedFrontmatter,
            source_type: "analyzed_binary_source",
            source_preservation: "analysis_only_rest_stage1",
          };
        }
        const writeResult = await api.pushNoteToObsidian(apiConfig, notePath, curatedContent, committedFrontmatter);''',
    'REST fallback for all knowledge',
)
add = add.replace('PDF detectado. O original será preservado junto da síntese após sua aprovação.', 'PDF detectado. O Nisti analisa e classifica a fonte; a síntese será gravada no Obsidian após sua aprovação.')
add = add.replace('Imagem detectada. A análise visual e o arquivo original serão preservados após sua aprovação.', 'Imagem detectada. O Nisti analisa, classifica e grava a síntese no Obsidian após sua aprovação.')
add = add.replace('Ela será preservada somente quando você aprovar a gravação.', 'A análise será preservada no Obsidian quando você aprovar a gravação.')
add = add.replace('Salvar em 00_Inbox', 'Salvar na Inbox')
add_path.write_text(add, encoding='utf-8')

architecture_doc = '''# Nisti Marketing 3.1 — Smart Knowledge Pipeline

## Entrega em duas etapas

### Etapa 1 — núcleo Obsidian e Inbox inteligente
- Local REST API é o caminho principal de conexão.
- Nenhuma seleção física de pasta é necessária para o fluxo padrão.
- Após validar a API Key, o app cria a raiz `Nisti Marketing/` no Vault ativo.
- A estrutura canônica é criada dentro dessa raiz.
- Capturas externas devem entrar em `Nisti Marketing/00_Inbox`.
- A Inbox é reavaliada automaticamente a cada heartbeat.
- Classificações com confiança >= 0.82 são movidas automaticamente.
- Ambiguidades e colisões permanecem na Inbox para revisão.
- A ferramenta Adicionar fonte usa exatamente as mesmas pastas canônicas.

### Etapa 2 — inteligência de planejamento e aprendizado
- Transporte REST dos binários originais (PDF/imagem/áudio).
- Transcrição de áudio.
- Classificação assistida por IA quando as regras determinísticas forem inconclusivas.
- Ingestão estruturada de métricas Instagram/TikTok.
- Aprendizados em `08_Aprendizados` como evidência do planejador.
- Planner grounded obrigatório com rastreabilidade das fontes usadas.

## Regra de segurança
A automação nunca sobrescreve uma nota existente no destino. Em caso de colisão, confiança baixa ou `triage_mode: manual`, a nota permanece na Inbox.
'''
Path('docs/OBSIDIAN-SMART-KNOWLEDGE-3.1.md').write_text(architecture_doc, encoding='utf-8')

print('Stage 1 smart knowledge transformation applied.')
