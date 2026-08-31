import { ObsidianApiConfig, ObsidianNote } from "../types";
import { generateFastHash } from "../utils/crypto";
import { localDateKey, upsertManagedSection } from "../utils/reliability";
import { normalizeFrontmatterTags, parseMarkdownDocument } from "../utils/markdownFrontmatter";
import {
  isObsidianRuntimeConnected,
  markObsidianRuntimeConnected,
  markObsidianRuntimeDisconnected,
  publishObsidianSnapshot,
} from "./obsidianRuntimeState";
import { StorageManager } from "./storage/StorageManager";
import {
  knowledgeContextService,
  type KnowledgeContextSource,
} from "./knowledge/KnowledgeContextService";
import {
  AUTO_TRIAGE_CONFIDENCE,
  NISTI_INBOX_FOLDER,
  NISTI_KNOWLEDGE_FOLDERS,
  NISTI_RELATIVE_FOLDERS,
  NISTI_VAULT_ROOT,
  classifyKnowledgeForVault,
  encodeVaultRelativePath,
  qualifyNistiKnowledgePath,
} from "./obsidianKnowledgeAutomation";
import { normalizeAiTriageCandidate } from "../domain/smartKnowledgeStage2";

let cachedSessionToken: string | null = null;
let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;
let obsidianHeartbeatBusy = false;
const aiTriageAttemptCache = new Map<string, string>();
let useDirectClientSideFetch = true;
const storage = StorageManager.getInstance();

export function normalizeObsidianEndpoint(endpoint?: string): string {
  let clean = (endpoint || "").trim();
  if (!clean) return "https://127.0.0.1:27124";

  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    if (clean.includes("27123")) {
      clean = `http://${clean}`;
    } else {
      clean = `https://${clean}`;
    }
  }

  // If the web application is running over HTTPS (e.g. AI Studio, Cloud Run),
  // browsers strictly forbid mixed content HTTP requests to 127.0.0.1:27124.
  // Port 27124 is Obsidian Local REST API's default HTTPS port.
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    if (clean.startsWith("http://127.0.0.1:27124") || clean.startsWith("http://localhost:27124")) {
      clean = clean.replace(/^http:/, "https:");
    }
  }

  return clean.replace(/\/+$/, "");
}

const DEFAULT_API_CONFIG: ObsidianApiConfig = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  openaiApiKey: "",
  aiProvider: "gemini",
  aiModel: "",
  vaultName: "MarketingVault",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

function serializeApiFrontmatter(frontmatter?: Record<string, unknown>): string {
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

export interface ObsidianConnectionResult {
  success: boolean;
  message: string;
  localVaultPath?: string;
  detectedVaultName?: string;
  localNotesFound?: number;
  localFoldersFound?: number;
  localFolders?: string[];
}

async function setDesktopObsidianAuthorization(connected: boolean): Promise<void> {
  if (!window.electronAPI) return;
  try {
    await window.electronAPI.setObsidianConnectionState(connected);
  } catch (err) {
    console.warn("Could not update Electron Obsidian connection gate:", err);
  }
}

async function getSessionHeaders(): Promise<Record<string, string>> {
  if (!cachedSessionToken) {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.token) cachedSessionToken = data.token;
      }
    } catch {
      // Protected calls fail closed if the local session cannot be acquired.
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cachedSessionToken) {
    headers["x-app-session-token"] = cachedSessionToken;
  }
  return headers;
}

async function getAIRequestHeaders(aiOverride?: {
  provider?: "gemini" | "openai";
  apiKey?: string;
  model?: string;
}): Promise<Record<string, string>> {
  const headers = await getSessionHeaders();

  try {
    const stored = aiOverride?.provider && aiOverride.apiKey !== undefined
      ? null
      : await storage.loadAIRequestConfig(DEFAULT_API_CONFIG);
    const provider = aiOverride?.provider || stored?.provider || "gemini";
    const configuredKey = aiOverride?.apiKey?.trim() || stored?.apiKey.trim();
    headers["x-ai-provider"] = provider;
    const model = aiOverride?.model?.trim() || stored?.model.trim();
    if (model) headers["x-ai-model"] = model;
    if (configuredKey) {
      headers["x-ai-api-key"] = configuredKey;
    }
  } catch (e) {
    console.warn("Could not load AI provider credentials from secure storage.", e);
  }

  return headers;
}

async function requestObsidianConnectionTest(config: { endpoint: string; apiKey: string }) {
  const normalizedEndpoint = normalizeObsidianEndpoint(config.endpoint);

  // 1. Try direct browser fetch first!
  try {
    const parsedUrl = new URL(normalizedEndpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const directRes = await fetch(`${parsedUrl.protocol}//${parsedUrl.host}/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (directRes.ok) {
      console.log("Direct browser-to-Obsidian connection succeeded!");
      const data = await directRes.json().catch(() => ({}));
      useDirectClientSideFetch = true;
      return {
        res: { ok: true, status: 200 } as Response,
        data: { success: true, message: "Conectado diretamente pelo navegador.", ...data },
      };
    } else {
      useDirectClientSideFetch = true;
      const data = await directRes.json().catch(() => ({}));
      return {
        res: directRes,
        data: { success: false, message: `Obsidian respondeu com status HTTP ${directRes.status}. Verifique o token/chave de autenticação.`, ...data },
      };
    }
  } catch (err) {
    console.warn("Direct browser-to-Obsidian connection failed.", err);
  }

  // 2. In Web mode with loopback (127.0.0.1 / localhost), Cloud backend cannot reach local PC
  const isLoopback = normalizedEndpoint.includes("127.0.0.1") || normalizedEndpoint.includes("localhost");
  if (!window.electronAPI && isLoopback) {
    useDirectClientSideFetch = true;
    return {
      res: { ok: false, status: 0 } as Response,
      data: {
        success: false,
        message: `Não foi possível conectar diretamente ao Obsidian (${normalizedEndpoint}).\n\n1. Certifique-se de que o Obsidian está aberto com o plugin Local REST API ativado.\n2. No navegador, como o Obsidian utiliza certificado SSL auto-assinado, abra este link em uma nova aba uma vez: ${normalizedEndpoint}/ e selecione "Avançado" -> "Prosseguir para 127.0.0.1 (não seguro)".\n3. Retorne aqui e clique em Testar Conexão novamente.`,
      },
    };
  }

  // 3. Fallback to backend proxy (for Electron desktop environment)
  useDirectClientSideFetch = false;
  const headers = await getSessionHeaders();
  const res = await fetch("/api/obsidian/test-connection", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...config, endpoint: normalizedEndpoint }),
  });
  const data = await res.json().catch(() => ({
    success: false,
    message: `Obsidian retornou HTTP ${res.status}.`,
  }));
  return { res, data };
}

export async function syncWebObsidianNotes(config: ObsidianApiConfig): Promise<ObsidianNote[]> {
  const notesMap = new Map<string, ObsidianNote>();
  const visited = new Set<string>();

  async function crawl(vaultRelativeDirPath: string) {
    // Normalize any backslashes to forward slashes
    const normalizedDirPath = vaultRelativeDirPath.replace(/\\/g, "/");
    const cleanRelativeDir = normalizedDirPath 
      ? (normalizedDirPath.endsWith("/") ? normalizedDirPath : `${normalizedDirPath}/`) 
      : "";
    
    // URL-encode directory segments for the API call
    const encodedDir = cleanRelativeDir
      ? cleanRelativeDir.split("/").map(encodeURIComponent).join("/")
      : "";
    
    const apiPath = `/vault/${encodedDir}`;
    
    if (visited.has(apiPath)) return;
    visited.add(apiPath);

    try {
      console.log(`[Obsidian Crawl] Iniciando varredura no diretório: "${cleanRelativeDir}" através da rota: "${apiPath}"`);
      let responseRes = await obsidianProxyRequest(config, "GET", apiPath);
      
      // Se falhar ou retornar vazio e terminar com barra, tenta sem a barra final
      if ((!responseRes.response.ok || !responseRes.data?.success) && apiPath.endsWith("/")) {
        const fallbackPath = apiPath.slice(0, -1);
        console.log(`[Obsidian Crawl] Rota com barra falhou. Tentando fallback sem barra: "${fallbackPath}"`);
        const fallbackRes = await obsidianProxyRequest(config, "GET", fallbackPath);
        if (fallbackRes.response.ok && fallbackRes.data?.success) {
          responseRes = fallbackRes;
        }
      }

      if (responseRes.response.ok && responseRes.data?.success) {
        // Encontra o array de arquivos com máxima resiliência (suporta múltiplos formatos de resposta)
        let rawFiles: any = null;
        const potentialLocations = [
          responseRes.data?.data?.files,
          responseRes.data?.files,
          responseRes.data?.data,
          responseRes.data
        ];

        for (const loc of potentialLocations) {
          if (Array.isArray(loc)) {
            rawFiles = loc;
            break;
          }
        }

        const files = Array.isArray(rawFiles) ? rawFiles : [];
        console.log(`[Obsidian Crawl] Diretório "${cleanRelativeDir}" retornou ${files.length} itens.`);

        for (const item of files) {
          // Extrai o caminho e normaliza barras invertidas para barras normais
          const relativePath = (typeof item === "string" ? item : (item?.path || item?.name || ""))
            .replace(/\\/g, "/");
          
          const cleanRelativePath = relativePath.replace(/^\//, "");
          if (!cleanRelativePath) continue;

          // Determina o caminho correto e completo relativo ao cofre principal
          let itemRelativePath = cleanRelativePath;
          if (cleanRelativeDir && !itemRelativePath.startsWith(cleanRelativeDir)) {
            itemRelativePath = `${cleanRelativeDir}${itemRelativePath}`;
          }

          // Normalização adicional de redundância de barras (ex: "folder//file.md" -> "folder/file.md")
          itemRelativePath = itemRelativePath.replace(/\/+/g, "/");

          const isMarkdown = itemRelativePath.toLowerCase().endsWith(".md");
          let isFolder = itemRelativePath.endsWith("/") ||
                         item?.type === "directory" ||
                         item?.type === "folder" ||
                         (typeof item === "object" && item?.isFolder === true);

          // Some Local REST API versions return directory entries as bare strings
          // without a trailing slash. Probe ambiguous non-Markdown paths instead of
          // guessing from the presence of a dot (valid folder names may contain one).
          if (!isFolder && typeof item === "string" && !isMarkdown) {
            const probeRelativePath = itemRelativePath.replace(/\/$/, "");
            const probeEncodedPath = probeRelativePath.split("/").map(encodeURIComponent).join("/");
            try {
              const probe = await obsidianProxyRequest(config, "GET", `/vault/${probeEncodedPath}/`);
              isFolder = Boolean(probe.response.ok && probe.data?.success);
            } catch {
              isFolder = false;
            }
          }

          if (isFolder) {
            // Remove a barra final antes de passar para crawl se necessário, o crawl tratará
            const subDirPath = itemRelativePath.endsWith("/") ? itemRelativePath.slice(0, -1) : itemRelativePath;
            await crawl(subDirPath);
          } else if (itemRelativePath.toLowerCase().endsWith(".md")) {
            try {
              // Codifica corretamente cada parte do caminho do arquivo
              const encodedFilePath = itemRelativePath.split("/").map(encodeURIComponent).join("/");
              const noteRes = await obsidianProxyRequest(config, "GET", `/vault/${encodedFilePath}`);
              
              if (noteRes.response.ok && noteRes.data?.success) {
                const content = typeof noteRes.data.data === "string" ? noteRes.data.data : "";
                const pathParts = itemRelativePath.split("/");
                const filename = pathParts.pop() || "Sem Título.md";
                const title = filename.replace(/\.md$/i, "");
                const folder = pathParts.join("/") || "00_Inbox";

                const parsed = parseMarkdownDocument(content);
                const frontmatter = parsed.frontmatter;
                const body = parsed.body;
                const tags = normalizeFrontmatterTags(frontmatter.tags);

                notesMap.set(itemRelativePath, {
                  id: `web-${generateFastHash("n", `${folder}/${title}`)}`,
                  path: itemRelativePath,
                  title,
                  folder,
                  content: body,
                  frontmatter,
                  tags,
                  wikilinks: [],
                  lastModified: new Date().toISOString().replace("T", " ").slice(0, 16),
                  syncedWithApi: true,
                } as ObsidianNote);
              }
            } catch (fileErr: any) {
              console.warn(`[Obsidian Crawl] Falha ao sincronizar arquivo individual: ${itemRelativePath}`, fileErr.message || fileErr);
            }
          }
        }
      } else {
        const errorDetail = responseRes.data?.error || responseRes.data?.message || `HTTP ${responseRes.response.status}`;
        console.warn(`[Obsidian Crawl] Falha ao listar pasta do Obsidian "${apiPath}": ${errorDetail}`);
        if (vaultRelativeDirPath === "") {
          throw new Error(`Falha ao listar o diretório raiz do Obsidian: ${errorDetail}`);
        }
      }
    } catch (e: any) {
      console.warn(`[Obsidian Crawl] Falha ao ler diretório do Obsidian: ${apiPath}`, e.message || e);
      if (vaultRelativeDirPath === "") {
        throw e;
      }
    }
  }

  await crawl(NISTI_VAULT_ROOT);
  const resultNotes = Array.from(notesMap.values());
  console.log(`[Obsidian Crawl] Sincronização concluída. Total de notas encontradas: ${resultNotes.length}`);
  return resultNotes;
}

async function publishCurrentDesktopVaultSnapshot(
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

async function classifyAmbiguousKnowledgeWithAI(
  note: ObsidianNote,
  deterministic: ReturnType<typeof classifyKnowledgeForVault>,
): Promise<{ folder: string; confidence: number; reason: string } | null> {
  const signature = generateFastHash(
    "triage",
    JSON.stringify({
      title: note.title,
      content: note.content,
      frontmatter: note.frontmatter,
      tags: note.tags,
    }),
  );
  if (aiTriageAttemptCache.get(note.path) === signature) return null;

  const headers = await getAIRequestHeaders();
  if (!headers["x-ai-api-key"]) return null;
  aiTriageAttemptCache.set(note.path, signature);

  try {
    const response = await fetch("/api/ai/classify-knowledge", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: note.title,
        content: note.content.slice(0, 12_000),
        tags: note.tags || [],
        deterministic: {
          folder: deterministic.folder,
          confidence: deterministic.confidence,
          reason: deterministic.reason,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) return null;
    return normalizeAiTriageCandidate(payload.data, deterministic);
  } catch (error) {
    console.warn("AI-assisted Inbox triage failed closed:", error);
    return null;
  }
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
    const deterministic = classifyKnowledgeForVault(note);
    let destinationFolder = deterministic.folder;
    let confidence = deterministic.confidence;
    let reason = deterministic.reason;

    if (destinationFolder === NISTI_INBOX_FOLDER || confidence < AUTO_TRIAGE_CONFIDENCE) {
      const aiCandidate = await classifyAmbiguousKnowledgeWithAI(note, deterministic);
      if (aiCandidate) {
        destinationFolder = aiCandidate.folder;
        confidence = aiCandidate.confidence;
        reason = `Classificação assistida por IA: ${aiCandidate.reason}`;
      }
    }

    if (destinationFolder === NISTI_INBOX_FOLDER || confidence < AUTO_TRIAGE_CONFIDENCE) {
      result.pending.push({
        path: note.path,
        confidence,
        suggestion: destinationFolder,
        reason,
      });
      continue;
    }

    const filename = note.path.replace(/\\/g, "/").split("/").pop() || `${note.title}.md`;
    const targetPath = `${destinationFolder}/${filename}`;
    try {
      const targetProbe = await obsidianProxyRequest(config, "GET", `/vault/${encodeVaultRelativePath(targetPath)}`);
      if (targetProbe.response.ok && targetProbe.data?.success) {
        result.pending.push({
          path: note.path,
          confidence,
          suggestion: destinationFolder,
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

      result.moved.push({ from: note.path, to: targetPath, confidence });
    } catch (error: any) {
      result.failed.push({ path: note.path, error: error?.message || String(error) });
    }
  }

  return result;
}

function stopObsidianHeartbeat(): void {
  if (obsidianHeartbeat) {
    clearInterval(obsidianHeartbeat);
    obsidianHeartbeat = null;
  }
}

function startObsidianHeartbeat(config: { endpoint: string; apiKey: string }): void {
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

async function verifyObsidianConnection(
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

async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {
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
}

async function obsidianProxyRequest(
  config: ObsidianApiConfig,
  method: string,
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<{ response: Response; data: any }> {
  if (!isObsidianRuntimeConnected()) {
    throw new Error("Obsidian não está conectado. Valide a conexão antes de acessar o Vault.");
  }

  const normalizedEndpoint = normalizeObsidianEndpoint(config.endpoint);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // 1. In Web mode or when direct client-side fetch is active, try directly from the browser!
  if (!window.electronAPI || useDirectClientSideFetch) {
    try {
      const parsedUrl = new URL(normalizedEndpoint);
      const fullUrl = `${parsedUrl.protocol}//${parsedUrl.host}${normalizedPath}`;
      const forwardHeaders: Record<string, string> = {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json, text/plain, */*",
        ...(customHeaders || {}),
      };
      const binaryPayload = body && typeof body === "object" && !Array.isArray(body)
        && typeof (body as any).__nistiBinaryBase64 === "string"
        && typeof (body as any).mimeType === "string"
        ? body as { __nistiBinaryBase64: string; mimeType: string }
        : null;
      if (binaryPayload) forwardHeaders["Content-Type"] = binaryPayload.mimeType;
      else if (body && typeof body === "string") forwardHeaders["Content-Type"] = "text/markdown; charset=utf-8";
      else if (body && typeof body === "object") forwardHeaders["Content-Type"] = "application/json";

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: forwardHeaders,
      };
      if (body !== undefined && !["GET", "HEAD"].includes(method.toUpperCase())) {
        fetchOptions.body = binaryPayload
          ? new Blob([Uint8Array.from(atob(binaryPayload.__nistiBinaryBase64), (char) => char.charCodeAt(0))], { type: binaryPayload.mimeType })
          : typeof body === "string" ? body : JSON.stringify(body);
      }

      const directRes = await fetch(fullUrl, fetchOptions);
      const contentType = directRes.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await directRes.json().catch(() => ({}))
        : await directRes.text().catch(() => "");

      if (directRes.ok) {
        return {
          response: { ok: true, status: directRes.status } as Response,
          data: { success: true, status: directRes.status, data },
        };
      } else {
        return {
          response: { ok: false, status: directRes.status } as Response,
          data: { success: false, status: directRes.status, message: `Obsidian retornou HTTP ${directRes.status}`, data },
        };
      }
    } catch (err: any) {
      console.warn("Direct proxy request failed:", err);
      const isLoopback = normalizedEndpoint.includes("127.0.0.1") || normalizedEndpoint.includes("localhost");
      if (!window.electronAPI && isLoopback) {
        throw new Error(`Falha ao conectar ao Obsidian (${normalizedEndpoint}): Verifique se o Obsidian está aberto e autorize o certificado de segurança abrindo ${normalizedEndpoint}/ em uma nova aba.`);
      }
    }
  }

  // 2. Fallback to backend proxy (for Electron desktop environment)
  const headers = await getSessionHeaders();
  const response = await fetch("/api/obsidian/proxy", {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: normalizedEndpoint,
      apiKey: config.apiKey,
      method,
      path: normalizedPath,
      body,
      headers: customHeaders || {},
    }),
  });
  const data = await response.json().catch(() => ({ success: false, status: response.status }));
  return { response, data };
}

export interface GenerateCampaignPayload {
  campaignName: string;
  objective: string;
  channels: string[];
  audience: string;
  tone: string;
  knowledgeNotes?: ObsidianNote[];
  preferredSourcePaths?: string[];
  customInstructions?: string;
  engineMode?: string;
}

export interface GenerateGuidelinesPayload {
  campaignName: string;
  objective: string;
  engineMode: string;
  knowledgeNotes?: ObsidianNote[];
  preferredSourcePaths?: string[];
}

async function selectMarketingKnowledge(
  notes: ObsidianNote[] | undefined,
  query: string,
  preferredSourcePaths?: string[]
): Promise<{ knowledgeSources: KnowledgeContextSource[]; knowledgeWarning?: string }> {
  if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.queryKnowledge) {
    try {
      const res = await window.electronAPI.queryKnowledge(query, preferredSourcePaths);
      return { knowledgeSources: res.sources, knowledgeWarning: res.warning };
    } catch (e) {
      console.warn("Failed to query knowledge index via IPC, falling back to in-memory:", e);
    }
  }

  const selection = knowledgeContextService.select({
    query,
    notes: notes || [],
    preferredSourcePaths,
  });
  return { knowledgeSources: selection.sources, knowledgeWarning: selection.warning };
}

export interface ExtractTasksPayload {
  noteContent: string;
  noteTitle: string;
  engineMode?: string;
}

export const api = {
  disconnectObsidianSession(reason?: string) {
    stopObsidianHeartbeat();
    void setDesktopObsidianAuthorization(false);
    markObsidianRuntimeDisconnected(reason || "Obsidian desconectado.");
  },

  isObsidianSessionVerified() {
    return isObsidianRuntimeConnected();
  },

  markSessionAsConnectedManually() {
    markObsidianRuntimeConnected();
    void setDesktopObsidianAuthorization(true);
  },

  async syncWebObsidianNotes(config: ObsidianApiConfig): Promise<ObsidianNote[]> {
    return await syncWebObsidianNotes(config);
  },

  async pushBinaryAssetToObsidian(config: ObsidianApiConfig, filePath: string, dataUrl: string) {
    const verified = await requireVerifiedObsidian(config);
    if (!verified.success) throw new Error(verified.message);
    const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("O arquivo binário não está em um Data URL válido.");
    const allowedMime = /^(application\/pdf|image\/(png|jpeg|webp)|audio\/(mpeg|mp3|wav|x-wav|mp4|aac|ogg|webm))$/i;
    if (!allowedMime.test(match[1])) throw new Error("Tipo binário não autorizado para persistência no Vault.");
    const cleanPath = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath.startsWith(`${NISTI_VAULT_ROOT}/`)) throw new Error("Asset fora da raiz gerenciada pelo Nisti.");
    const targetPath = `/vault/${encodeVaultRelativePath(cleanPath)}`;
    const existing = await obsidianProxyRequest(config, "GET", targetPath);
    if (existing.response.ok && existing.data?.success) throw new Error("Já existe um asset com o mesmo caminho no Obsidian.");
    const write = await obsidianProxyRequest(config, "PUT", targetPath, {
      __nistiBinaryBase64: match[2],
      mimeType: match[1],
    });
    if (!write.response.ok || !write.data?.success) throw new Error("O Obsidian não confirmou a gravação do arquivo original.");
    return { success: true, path: cleanPath };
  },

  async deleteObsidianPath(config: ObsidianApiConfig, filePath: string) {
    const cleanPath = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!cleanPath.startsWith(`${NISTI_VAULT_ROOT}/`)) throw new Error("Caminho fora da raiz gerenciada pelo Nisti.");
    const remove = await obsidianProxyRequest(config, "DELETE", `/vault/${encodeVaultRelativePath(cleanPath)}`);
    return Boolean(remove.response.ok && remove.data?.success);
  },

  async syncObsidianSnapshot() {
    if (!isObsidianRuntimeConnected()) {
      throw new Error("Obsidian não está conectado.");
    }
    return await publishCurrentDesktopVaultSnapshot();
  },

  async checkHealth() {
    try {
      const [headers, config] = await Promise.all([
        getSessionHeaders(),
        storage.loadAIRequestConfig(DEFAULT_API_CONFIG),
      ]);
      const res = await fetch("/api/health", { cache: "no-store", headers });
      const health = await res.json();
      return {
        ...health,
        hasApiKey: Boolean(health?.hasApiKey || config.apiKey.trim()),
      };
    } catch {
      return { status: "offline", hasApiKey: false };
    }
  },

  async testAIConnection(config: {
    provider: "gemini" | "openai";
    apiKey: string;
    model?: string;
  }): Promise<{ success: boolean; message: string; model?: string; provider?: string }> {
    const cleanKey = config.apiKey.trim();
    if (!cleanKey) {
      return { success: false, message: `Informe a chave API do provedor ${config.provider} antes de testar a conexão.` };
    }

    try {
      const headers = await getAIRequestHeaders({ ...config, apiKey: cleanKey });
      const res = await fetch("/api/ai/test-connection", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data.error || `O provedor retornou HTTP ${res.status}.` };
      }

      if (data?.success) {
        return {
          success: true,
          message: `Conexão com ${data.provider || config.provider} confirmada${data.model ? ` usando ${data.model}` : ""}.`,
          model: data.model,
          provider: data.provider || config.provider,
        };
      }

      return {
        success: false,
        message: "A configuração não foi validada pelo provedor. Verifique a API key, a cota e o modelo configurado.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || `Não foi possível conectar ao provedor ${config.provider}.`,
      };
    }
  },

  async testGeminiConnection(geminiApiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
    return await this.testAIConnection({ provider: "gemini", apiKey: geminiApiKey });
  },

  async generateGuidelines(payload: GenerateGuidelinesPayload) {
    const headers = await getAIRequestHeaders();
    const { knowledgeNotes, preferredSourcePaths, ...requestPayload } = payload;
    const knowledge = await selectMarketingKnowledge(
      knowledgeNotes,
      `${payload.campaignName} ${payload.objective} diretrizes estratégia campanha`,
      preferredSourcePaths
    );
    const res = await fetch("/api/ai/generate-guidelines", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...requestPayload, ...knowledge }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  async processKnowledge(type: string, payload: unknown, engineMode: string) {
    const headers = await getAIRequestHeaders();
    const res = await fetch("/api/ai/process-knowledge", {
      method: "POST",
      headers,
      body: JSON.stringify({ type, payload, engineMode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  async generateCampaign(payload: GenerateCampaignPayload) {
    const headers = await getAIRequestHeaders();
    const { knowledgeNotes, preferredSourcePaths, ...requestPayload } = payload;
    const knowledge = await selectMarketingKnowledge(
      knowledgeNotes,
      [
        payload.campaignName,
        payload.objective,
        payload.channels.join(" "),
        payload.audience,
        payload.tone,
        payload.customInstructions || "",
      ].join(" "),
      preferredSourcePaths
    );
    const res = await fetch("/api/ai/generate-campaign", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...requestPayload, ...knowledge }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  async extractTasks(payload: ExtractTasksPayload) {
    const headers = await getAIRequestHeaders();
    const res = await fetch("/api/ai/extract-tasks", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  async analyzeVault(vaultNotesOverview: any) {
    const headers = await getAIRequestHeaders();
    const res = await fetch("/api/ai/analyze-vault", {
      method: "POST",
      headers,
      body: JSON.stringify({ vaultNotesOverview }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  async probeObsidianConnection(config: { endpoint: string; apiKey: string }) {
    return await verifyObsidianConnection(config, false);
  },

  async testObsidianConnection(config: { endpoint: string; apiKey: string }) {
    return await verifyObsidianConnection(config, true);
  },

  async pushNoteToObsidian(
    config: ObsidianApiConfig,
    filePath: string,
    markdownContent: string,
    frontmatter?: Record<string, unknown>
  ) {
    const verified = await requireVerifiedObsidian(config);
    if (!verified.success) {
      return { success: false, message: verified.message };
    }

    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const cleanPath = filePath
            .replace(/^\//, "")
            .replace(/^vault\//, "")
            .replace(/\\/g, "/");
          const pathParts = cleanPath.split("/").filter(Boolean);
          const filename = pathParts.pop() || "Nova Nota.md";
          const folder = pathParts.join("/") || "00_Inbox";
          const title = filename.replace(/\.md$/i, "");
          const contentHasFrontmatter = markdownContent.trimStart().startsWith("---");

          const writeRes = await window.electronAPI.writeNote(
            folder,
            title,
            markdownContent,
            contentHasFrontmatter ? undefined : frontmatter
          );
          if (writeRes.success) {
            await publishCurrentDesktopVaultSnapshot();
            return { success: true, message: "Nota gravada diretamente no Vault do Obsidian" };
          }
          throw new Error(writeRes.error || "Erro desconhecido ao gravar nota");
        }
      } catch (err: any) {
        console.warn("Direct Electron write failed, falling back to proxy:", err);
      }
    }

    const qualifiedPath = qualifyNistiKnowledgePath(filePath);
    const encodedPath = `/vault/${encodeVaultRelativePath(qualifiedPath)}`;
    const payloadMarkdown = markdownContent.trimStart().startsWith("---")
      ? markdownContent
      : `${serializeApiFrontmatter(frontmatter)}${markdownContent}`;
    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, payloadMarkdown);
    if (data?.success) await publishCurrentDesktopVaultSnapshot();
    return data;
  },

  async upsertDailyNoteSection(
    config: ObsidianApiConfig,
    sectionId: string,
    heading: string,
    sectionContent: string
  ) {
    const verified = await requireVerifiedObsidian(config);
    if (!verified.success) {
      return { success: false, message: verified.message };
    }

    const today = localDateKey();

    if (window.electronAPI?.upsertNoteSection) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const result = await window.electronAPI.upsertNoteSection(
            NISTI_INBOX_FOLDER,
            `Daily-${today}`,
            sectionId,
            heading,
            sectionContent
          );
          if (result.success) {
            await publishCurrentDesktopVaultSnapshot();
            return { success: true, message: "Daily Note atualizada de forma idempotente via Electron" };
          }
          throw new Error(result.error || "Falha ao atualizar seção da Daily Note");
        }
      } catch (err) {
        console.warn("Electron Daily Note upsert failed, trying REST proxy:", err);
      }
    }

    const targetPath = `/vault/${encodeVaultRelativePath(`${NISTI_INBOX_FOLDER}/Daily-${today}.md`)}`;
    const getResult = await obsidianProxyRequest(config, "GET", targetPath);

    let existingContent = "";
    if (getResult.response.ok && getResult.data?.success) {
      existingContent = typeof getResult.data.data === "string" ? getResult.data.data : "";
    } else if (getResult.response.status === 404 || getResult.data?.status === 404) {
      existingContent = `# 📅 Daily Note: ${today}`;
    } else {
      return {
        success: false,
        message: "Não foi possível ler a Daily Note; atualização cancelada para evitar sobrescrita acidental.",
        status: getResult.response.status,
      };
    }

    const updatedContent = upsertManagedSection(existingContent, sectionId, heading, sectionContent);
    const putResult = await obsidianProxyRequest(config, "PUT", targetPath, updatedContent);
    if (putResult.data?.success) await publishCurrentDesktopVaultSnapshot();
    return putResult.data;
  },

  async appendToDailyNote(config: ObsidianApiConfig, contentToAppend: string) {
    const verified = await requireVerifiedObsidian(config);
    if (!verified.success) {
      return { success: false, message: verified.message };
    }

    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const today = localDateKey();
          const appendRes = await window.electronAPI.appendNote(
            NISTI_INBOX_FOLDER,
            `Daily-${today}`,
            `\n${contentToAppend}`
          );
          if (appendRes && appendRes.success) {
            await publishCurrentDesktopVaultSnapshot();
            return { success: true, message: "Conteúdo inserido no Daily Note via Electron" };
          }
        }
      } catch (err) {
        console.warn("Direct Electron task append failed, falling back to proxy:", err);
      }
    }

    const { data } = await obsidianProxyRequest(
      config,
      "POST",
      "/periodic/daily/",
      `\n${contentToAppend}`,
      { Heading: "📋 Tarefas Sincronizadas (Obsidian Tasks Plugin)" }
    );
    if (data?.success) await publishCurrentDesktopVaultSnapshot();
    return data;
  },
};
