import { ObsidianApiConfig } from "../types";

export interface GenerateCampaignPayload {
  campaignName: string;
  objective: string;
  channels: string[];
  audience: string;
  tone: string;
  contextNotes: string;
  customInstructions?: string;
}

export interface ExtractTasksPayload {
  noteContent: string;
  noteTitle: string;
}

export const api = {
  // Check backend & Gemini health
  async checkHealth() {
    try {
      const res = await fetch("/api/health");
      return await res.json();
    } catch {
      return { status: "offline", hasApiKey: false };
    }
  },

  // Generate complete marketing campaign with Gemini AI
  async generateCampaign(payload: GenerateCampaignPayload) {
    const res = await fetch("/api/gemini/generate-campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  // Extract actionable tasks and reminders from an Obsidian note
  async extractTasks(payload: ExtractTasksPayload) {
    const res = await fetch("/api/gemini/extract-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  // Audit Obsidian marketing vault & find knowledge gaps
  async analyzeVault(vaultNotesOverview: any) {
    const res = await fetch("/api/gemini/analyze-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultNotesOverview }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${res.status}`);
    }
    return await res.json();
  },

  // Test connection to Obsidian Local REST API
  async testObsidianConnection(config: { endpoint: string; apiKey: string }) {
    try {
      const res = await fetch("/api/obsidian/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // Send or update note in Obsidian Vault via REST API proxy (or direct write if in Electron)
  async pushNoteToObsidian(config: ObsidianApiConfig, filePath: string, markdownContent: string) {
    // If running in Electron, bypass the network proxy and write directly to the local folder!
    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          // Extract the folder and the title from the filePath (e.g. "00_Inbox/Minha Nota.md")
          const cleanPath = filePath.replace(/^\//, "").replace(/^vault\//, "");
          const pathParts = cleanPath.split("/");
          
          let folder = "00_Inbox";
          let title = cleanPath.replace(/\.md$/, "");
          
          if (pathParts.length > 1) {
            folder = pathParts[0];
            title = pathParts.slice(1).join("/").replace(/\.md$/, "");
          }
          
          const writeRes = await window.electronAPI.writeNote(vaultPath, folder, title, markdownContent);
          if (writeRes.success) {
            return { success: true, message: "Nota gravada diretamente via Electron" };
          } else {
            throw new Error(writeRes.error || "Erro desconhecido ao gravar nota");
          }
        }
      } catch (err: any) {
        console.warn("Direct Electron write failed, falling back to proxy:", err);
      }
    }

    const cleanPath = filePath.startsWith("/") ? filePath : `/vault/${filePath}`;
    const res = await fetch("/api/obsidian/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // Append task line or reminder to Obsidian Daily Note via API (or direct write if in Electron)
  async appendToDailyNote(config: ObsidianApiConfig, contentToAppend: string) {
    if (window.electronAPI) {
      try {
        const vaultPath = await window.electronAPI.getVaultPath();
        if (vaultPath) {
          // In Electron local context, append task line straight to the daily note in 05_Reunioes or 00_Inbox
          const today = new Date().toISOString().split("T")[0];
          const writeRes = await window.electronAPI.writeNote(
            vaultPath, 
            "00_Inbox", 
            `Daily-${today}`, 
            `\n${contentToAppend}`
          );
          if (writeRes.success) {
            return { success: true, message: "Task inserida no Daily Note via Electron" };
          }
        }
      } catch (err) {
        console.warn("Direct Electron task write failed, falling back to proxy:", err);
      }
    }

    const res = await fetch("/api/obsidian/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        method: "POST",
        path: "/periodic/daily/",
        body: `\n${contentToAppend}`,
        headers: {
          "Heading": "📋 Tarefas Sincronizadas (Obsidian Tasks Plugin)",
        },
      }),
    });
    return await res.json();
  },
};
