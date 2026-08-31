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

let cachedSessionToken: string | null = null;
let obsidianHeartbeat: ReturnType<typeof setInterval> | null = null;
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

async function inspectDesktopVault(selectVault: boolean): Promise<ObsidianConnectionResult> {
  if (!window.electronAPI) {
    return {
      success: true,
      message: "REST API do Obsidian conectada.",
    };
  }

  let vaultPath = await window.electronAPI.getVaultPath();

  if (selectVault || !vaultPath) {
    const selection = await window.electronAPI.selectVault();
    if (selection?.vaultPath) {
      vaultPath = selection.vaultPath;
    }
  }

  if (!vaultPath) {
    return {
      success: false,
      message: "Falta selecionar a pasta física do Vault do Obsidian.",
    };
  }

  const notes = await window.electronAPI.readNotes();
  const folders = await window.electronAPI.listVaultFolders();

  // Extract vault name from vaultPath
  const pathSegments = vaultPath.replace(/\\/g, '/').split('/');
  const detectedVaultName = pathSegments.filter(Boolean).pop() || "MarketingVault";

  return {
    success: true,
    localVaultPath: vaultPath,
    detectedVaultName,
    localNotesFound: Array.isArray(notes) ? notes.length : 0,
    localFoldersFound: Array.isArray(folders) ? folders.length : 0,
    localFolders: Array.isArray(folders) ? folders : [],
    message: `Vault local confirmado: ${vaultPath}. ${Array.isArray(notes) ? notes.length : 0} itens indexados em ${Array.isArray(folders) ? folders.length : 0} pastas.`,
  };
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

  await crawl("");
  const resultNotes = Array.from(notesMap.values());
  console.log(`[Obsidian Crawl] Sincronização concluída. Total de notas encontradas: ${resultNotes.length}`);
  return resultNotes;
}

async function publishCurrentDesktopVaultSnapshot(folders?: string[]): Promise<{ notes: number; folders: number }> {
  if (!window.electronAPI) {
    try {
      const config = await storage.loadApiConfig(DEFAULT_API_CONFIG);
      if (config.connectionStatus === "connected") {
        const webNotes = await syncWebObsidianNotes(config);
        const folderList = folders || Array.from(new Set(webNotes.map((n) => n.folder)));
        if (folderList.length === 0) folderList.push("00_Inbox");
        publishObsidianSnapshot(webNotes, folderList);
        return { notes: webNotes.length, folders: folderList.length };
      }
    } catch (e) {
      console.warn("Could not publish web vault snapshot:", e);
    }
    return { notes: 0, folders: 0 };
  }

  const [desktopNotes, liveFolders] = await Promise.all([
    storage.readDesktopNotesForApp(),
    folders ? Promise.resolve(folders) : window.electronAPI.listVaultFolders(),
  ]);
  const notes = desktopNotes || [];
  const normalizedFolders = Array.isArray(liveFolders) ? liveFolders : [];
  publishObsidianSnapshot(notes, normalizedFolders);
  return { notes: notes.length, folders: normalizedFolders.length };
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
  if (!window.electronAPI) {
    console.log("Web mode detected: skipping physical local REST API heartbeat.");
    return;
  }

  const liveConfig = {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
  };

  obsidianHeartbeat = setInterval(async () => {
    try {
      const { res, data } = await requestObsidianConnectionTest(liveConfig);
      const vaultPath = window.electronAPI ? await window.electronAPI.getVaultPath() : "web";
      if (!res.ok || !data?.success || !vaultPath) {
        stopObsidianHeartbeat();
        await setDesktopObsidianAuthorization(false);
        markObsidianRuntimeDisconnected(
          data?.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento."
        );
      }
    } catch (err: any) {
      stopObsidianHeartbeat();
      await setDesktopObsidianAuthorization(false);
      markObsidianRuntimeDisconnected(
        err.message || "A conexão com o Obsidian foi perdida. Reconecte para acessar o banco de conhecimento."
      );
    }
  }, 15_000);
}

async function verifyObsidianConnection(
  config: { endpoint: string; apiKey: string },
  selectVault: boolean
): Promise<ObsidianConnectionResult> {
  if (window.electronAPI) {
    stopObsidianHeartbeat(); // Heartbeat not needed for direct filesystem
    await setDesktopObsidianAuthorization(true);
    
    try {
      const desktop = await inspectDesktopVault(selectVault);
      if (!desktop.success) {
        await setDesktopObsidianAuthorization(false);
        markObsidianRuntimeDisconnected(desktop.message);
        return desktop;
      }
      
      markObsidianRuntimeConnected();
      const snapshot = await publishCurrentDesktopVaultSnapshot(desktop.localFolders);
      
      return {
        ...desktop,
        success: true,
        localNotesFound: snapshot.notes || desktop.localNotesFound,
        localFoldersFound: snapshot.folders || desktop.localFoldersFound,
        message: `${desktop.message} Base sincronizada automaticamente.`.trim(),
      };
    } catch (err: any) {
      await setDesktopObsidianAuthorization(false);
      const message = err.message || "Não foi possível confirmar o acesso ao Vault.";
      markObsidianRuntimeDisconnected(message);
      return { success: false, message };
    }
  }

  // Web flow (uses Local REST API)
  if (!config.endpoint.trim() || !config.apiKey.trim()) {
    stopObsidianHeartbeat();
    await setDesktopObsidianAuthorization(false);
    markObsidianRuntimeDisconnected("Endpoint ou token do Obsidian não configurado.");
    return {
      success: false,
      message: "Informe o endpoint e o token do Obsidian Local REST API.",
    };
  }

  try {
    const { res, data } = await requestObsidianConnectionTest(config);
    if (res.ok && data?.success) {
      useDirectClientSideFetch = true;
      await setDesktopObsidianAuthorization(true);
      markObsidianRuntimeConnected();

      const detectedVault = data.vault || "MarketingVault";
      let folders: string[] = ["00_Inbox"];
      try {
        const listRes = await obsidianProxyRequest(config as any, "GET", "/vault/");
        if (listRes.response.ok && listRes.data?.success) {
          const filesList = listRes.data?.data?.files || listRes.data?.files || [];
          if (Array.isArray(filesList)) {
            const detectedFolders = filesList
              .map((item: any) => {
                const relativePath = typeof item === "string" ? item : (item?.path || "");
                return relativePath.replace(/^\//, "");
              })
              .filter((p: string) => p.endsWith("/"))
              .map((p: string) => p.replace(/\/$/, ""));
            if (detectedFolders.length > 0) {
              folders = detectedFolders;
            }
          }
        }
      } catch (e) {
        console.warn("Could not list folders during web verification:", e);
      }

      return {
        success: true,
        detectedVaultName: detectedVault,
        localFoldersFound: folders.length,
        localFolders: folders,
        message: `Conectado com sucesso ao Obsidian físico local (${detectedVault}) diretamente pelo seu navegador!`,
      };
    } else {
      const errorMsg = data?.message || "Conexão rejeitada.";
      const targetEndpoint = normalizeObsidianEndpoint(config.endpoint);
      return {
        success: false,
        message: errorMsg.includes("Avançado")
          ? errorMsg
          : `Não foi possível conectar ao Obsidian local (${targetEndpoint}).\n\n👉 Para liberar o acesso no navegador, abra o link: ${targetEndpoint}/\nClique em "Avançado" -> "Prosseguir para 127.0.0.1 (não seguro)". Depois, retorne e clique em Testar Conexão novamente.\n\nDetalhes: ${errorMsg}`,
      };
    }
  } catch (err: any) {
    const targetEndpoint = normalizeObsidianEndpoint(config.endpoint);
    return {
      success: false,
      message: `Não foi possível conectar ao Obsidian local (${targetEndpoint}).\n\n👉 Abra este link no navegador para autorizar o certificado: ${targetEndpoint}/\nSelecione "Avançado" -> "Prosseguir para 127.0.0.1".\n\nDetalhes do erro: ${err.message || err}`,
    };
  }
}

async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {
  return await verifyObsidianConnection(
    { endpoint: config.endpoint, apiKey: config.apiKey },
    false
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
      if (body && typeof body === "string") forwardHeaders["Content-Type"] = "text/markdown; charset=utf-8";
      else if (body && typeof body === "object") forwardHeaders["Content-Type"] = "application/json";

      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: forwardHeaders,
      };
      if (body !== undefined && !["GET", "HEAD"].includes(method.toUpperCase())) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
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

    const cleanPath = filePath.startsWith("/") ? filePath : `/vault/${filePath}`;
    const encodedPath = cleanPath
      .split("/")
      .map((segment, index) => {
        if (segment === "" || (index === 1 && segment === "vault")) return segment;
        return encodeURIComponent(segment);
      })
      .join("/");
    const { data } = await obsidianProxyRequest(config, "PUT", encodedPath, markdownContent);
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
            "00_Inbox",
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

    const targetPath = `/vault/00_Inbox/Daily-${today}.md`;
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
            "00_Inbox",
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
