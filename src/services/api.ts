import { ObsidianApiConfig } from "../types";
import { localDateKey, upsertManagedSection } from "../utils/reliability";
import { StorageManager } from "./storage/StorageManager";

let cachedSessionToken: string | null = null;
let obsidianSessionVerified = false;
const storage = StorageManager.getInstance();

const DEFAULT_API_CONFIG: ObsidianApiConfig = {
  endpoint: "http://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  vaultName: "MarketingVault",
  useHttps: false,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

export interface ObsidianConnectionResult {
  success: boolean;
  message: string;
  localVaultPath?: string;
  localNotesFound?: number;
  localFoldersFound?: number;
  localFolders?: string[];
}

async function getSessionHeaders(geminiApiKeyOverride?: string): Promise<Record<string, string>> {
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

  try {
    const configuredKey = geminiApiKeyOverride?.trim()
      ? geminiApiKeyOverride.trim()
      : (await storage.loadApiConfig(DEFAULT_API_CONFIG)).geminiApiKey?.trim();
    if (configuredKey) {
      headers["x-gemini-api-key"] = configuredKey;
    }
  } catch (e) {
    console.warn("Could not load Gemini credential from secure storage.", e);
  }

  return headers;
}

async function requestObsidianConnectionTest(config: { endpoint: string; apiKey: string }) {
  const headers = await getSessionHeaders();
  const res = await fetch("/api/obsidian/test-connection", {
    method: "POST",
    headers,
    body: JSON.stringify(config),
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
      message: "A REST API respondeu, mas falta selecionar a pasta física do Vault usada pelo Obsidian.",
    };
  }

  const notes = await window.electronAPI.readNotes();
  const folders = window.electronAPI.listVaultFolders
    ? await window.electronAPI.listVaultFolders()
    : Array.from(
        new Set(
          (Array.isArray(notes) ? notes : [])
            .map((note: any) => String(note?.folder || "00_Inbox").replace(/\\/g, "/"))
            .filter(Boolean)
        )
      );

  return {
    success: true,
    localVaultPath: vaultPath,
    localNotesFound: Array.isArray(notes) ? notes.length : 0,
    localFoldersFound: Array.isArray(folders) ? folders.length : 0,
    localFolders: Array.isArray(folders) ? folders : [],
    message: `Vault local confirmado: ${vaultPath}. ${Array.isArray(notes) ? notes.length : 0} notas Markdown em ${Array.isArray(folders) ? folders.length : 0} pastas.`,
  };
}

async function verifyObsidianConnection(
  config: { endpoint: string; apiKey: string },
  selectVault: boolean
): Promise<ObsidianConnectionResult> {
  obsidianSessionVerified = false;

  if (!config.endpoint.trim() || !config.apiKey.trim()) {
    return {
      success: false,
      message: "Informe o endpoint e o token do Obsidian Local REST API.",
    };
  }

  try {
    const { res, data } = await requestObsidianConnectionTest(config);
    if (!res.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || data?.error || `Obsidian retornou HTTP ${res.status}.`,
      };
    }

    const desktop = await inspectDesktopVault(selectVault);
    if (!desktop.success) return desktop;

    obsidianSessionVerified = true;
    return {
      ...desktop,
      success: true,
      message: `${data.message || "REST API do Obsidian conectada."} ${desktop.message}`.trim(),
    };
  } catch (err: any) {
    obsidianSessionVerified = false;
    return {
      success: false,
      message: err.message || "Não foi possível confirmar a conexão com o Obsidian.",
    };
  }
}

async function requireVerifiedObsidian(config: ObsidianApiConfig): Promise<ObsidianConnectionResult> {
  const result = await verifyObsidianConnection(
    { endpoint: config.endpoint, apiKey: config.apiKey },
    false
  );
  if (!result.success) {
    obsidianSessionVerified = false;
  }
  return result;
}

async function obsidianProxyRequest(
  config: ObsidianApiConfig,
  method: string,
  path: string,
  body?: unknown,
  customHeaders?: Record<string, string>
): Promise<{ response: Response; data: any }> {
  if (!obsidianSessionVerified) {
    throw new Error("Obsidian não está conectado. Valide a conexão antes de acessar o Vault.");
  }

  const headers = await getSessionHeaders();
  const response = await fetch("/api/obsidian/proxy", {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      method,
      path,
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
  contextNotes: string;
  customInstructions?: string;
  engineMode?: string;
}

export interface ExtractTasksPayload {
  noteContent: string;
  noteTitle: string;
  engineMode?: string;
}

export const api = {
  disconnectObsidianSession() {
    obsidianSessionVerified = false;
  },

  isObsidianSessionVerified() {
    return obsidianSessionVerified;
  },

  async checkHealth() {
    try {
      const [headers, config] = await Promise.all([
        getSessionHeaders(),
        storage.loadApiConfig(DEFAULT_API_CONFIG),
      ]);
      const res = await fetch("/api/health", { cache: "no-store", headers });
      const health = await res.json();
      return {
        ...health,
        hasApiKey: Boolean(health?.hasApiKey || config.geminiApiKey?.trim()),
      };
    } catch {
      return { status: "offline", hasApiKey: false };
    }
  },

  async testGeminiConnection(geminiApiKey: string): Promise<{ success: boolean; message: string; model?: string }> {
    const cleanKey = geminiApiKey.trim();
    if (!cleanKey) {
      return { success: false, message: "Informe a chave API do Gemini antes de testar a conexão." };
    }

    try {
      const headers = await getSessionHeaders(cleanKey);
      const res = await fetch("/api/gemini/analyze-vault", {
        method: "POST",
        headers,
        body: JSON.stringify({ vaultNotesOverview: [], engineMode: "ai" }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { success: false, message: data.error || `Gemini retornou HTTP ${res.status}.` };
      }

      if (data?.success && data?.wasFallback === false) {
        return {
          success: true,
          message: `Conexão com Gemini confirmada${data.usedModel ? ` usando ${data.usedModel}` : ""}.`,
          model: data.usedModel,
        };
      }

      return {
        success: false,
        message: "A chave não foi validada pela IA. Verifique a API key, a cota e os modelos habilitados no Google AI Studio.",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Não foi possível conectar ao Gemini.",
      };
    }
  },

  async processKnowledge(type: string, payload: unknown, engineMode: string) {
    const headers = await getSessionHeaders();
    const res = await fetch("/api/gemini/process-knowledge", {
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
    const headers = await getSessionHeaders();
    const res = await fetch("/api/gemini/generate-campaign", {
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

  async extractTasks(payload: ExtractTasksPayload) {
    const headers = await getSessionHeaders();
    const res = await fetch("/api/gemini/extract-tasks", {
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
    const headers = await getSessionHeaders();
    const res = await fetch("/api/gemini/analyze-vault", {
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
            return { success: true, message: "Nota gravada diretamente no Vault do Obsidian" };
          }
          throw new Error(writeRes.error || "Erro desconhecido ao gravar nota");
        }
      } catch (err: any) {
        console.warn("Direct Electron write failed, falling back to proxy:", err);
      }
    }

    const cleanPath = filePath.startsWith("/") ? filePath : `/vault/${filePath}`;
    const { data } = await obsidianProxyRequest(config, "PUT", cleanPath, markdownContent);
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
    return data;
  },
};