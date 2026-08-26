import { ObsidianApiConfig } from "../types";

let cachedSessionToken: string | null = null;

async function getSessionHeaders(): Promise<Record<string, string>> {
  if (!cachedSessionToken) {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.token) cachedSessionToken = data.token;
      }
    } catch {
      // Ignored; protected calls will fail closed if no local session is available.
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
  async checkHealth() {
    try {
      const res = await fetch("/api/health");
      return await res.json();
    } catch {
      return { status: "offline", hasApiKey: false };
    }
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

  async testObsidianConnection(config: { endpoint: string; apiKey: string }) {
    try {
      const headers = await getSessionHeaders();
      const res = await fetch("/api/obsidian/test-connection", {
        method: "POST",
        headers,
        body: JSON.stringify(config),
      });
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Erro de conexão ao testar endpoint",
      };
    }
  },

  async pushNoteToObsidian(config: ObsidianApiConfig, filePath: string, markdownContent: string) {
    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const cleanPath = filePath.replace(/^\//, "").replace(/^vault\//, "");
          const pathParts = cleanPath.split("/");

          let folder = "00_Inbox";
          let title = cleanPath.replace(/\.md$/, "");

          if (pathParts.length > 1) {
            folder = pathParts[0];
            title = pathParts.slice(1).join("/").replace(/\.md$/, "");
          }

          const writeRes = await window.electronAPI.writeNote(folder, title, markdownContent);
          if (writeRes.success) {
            return { success: true, message: "Nota gravada diretamente via Electron" };
          }
          throw new Error(writeRes.error || "Erro desconhecido ao gravar nota");
        }
      } catch (err: any) {
        console.warn("Direct Electron write failed, falling back to proxy:", err);
      }
    }

    const cleanPath = filePath.startsWith("/") ? filePath : `/vault/${filePath}`;
    const headers = await getSessionHeaders();
    const res = await fetch("/api/obsidian/proxy", {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        method: "PUT",
        path: cleanPath,
        body: markdownContent,
      }),
    });
    return await res.json();
  },

  async appendToDailyNote(config: ObsidianApiConfig, contentToAppend: string) {
    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          const today = new Date().toISOString().split("T")[0];
          const appendRes = await window.electronAPI.appendNote(
            "00_Inbox",
            `Daily-${today}`,
            `\n${contentToAppend}`
          );
          if (appendRes && appendRes.success) {
            return { success: true, message: "Task inserida no Daily Note via Electron" };
          }
        }
      } catch (err) {
        console.warn("Direct Electron task append failed, falling back to proxy:", err);
      }
    }

    const headers = await getSessionHeaders();
    const res = await fetch("/api/obsidian/proxy", {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        method: "POST",
        path: "/periodic/daily/",
        body: `\n${contentToAppend}`,
        headers: {
          Heading: "📋 Tarefas Sincronizadas (Obsidian Tasks Plugin)",
        },
      }),
    });
    return await res.json();
  },
};
