import { IStorageService } from "./IStorageService";
import {
  KnowledgeNote,
  Project,
  Task,
  Content,
  AuditEntry,
  AutomationRule,
} from "../../domain/schemas";
import { TaxonomyFolder, normalizeTaxonomyFolder, sanitizeSafePath } from "../../domain/taxonomy";
import { generateFastHash, generateUUID, encryptSecret, decryptSecret } from "../../utils/crypto";
import { APP_VERSION, localDateKey } from "../../utils/reliability";
import { ObsidianApiConfig, ObsidianNote } from "../../types";
import { isObsidianRuntimeConnected } from "../obsidianRuntimeState";

const STORAGE_KEYS = {
  NOTES: "nisti_pkm_notes_v2",
  PROJECTS: "nisti_pkm_projects_v2",
  TASKS: "nisti_pkm_tasks_v2",
  CONTENTS: "nisti_pkm_contents_v2",
  AUTOMATIONS: "nisti_pkm_automations_v2",
  AUDIT: "nisti_pkm_audit_logs_v2",
  API_CONFIG_SECURE: "nisti_pkm_api_config_secure_v2",
  IS_DEMO_MODE: "nisti_is_demo_mode_v2",
};

export const APP_STATE_KEYS = {
  NOTES: "obsidian_marketing_notes",
  CAMPAIGNS: "obsidian_marketing_campaigns",
  TASKS: "obsidian_marketing_tasks",
  AUTOMATION_RULES: "obsidian_marketing_rules",
  IDEAS: "obsidian_marketing_ideas",
  SCRIPTS: "obsidian_marketing_scripts",
  VISUALS: "obsidian_marketing_visuals",
  EMOTIONAL_DRIVERS: "obsidian_emotional_drivers",
  NICHES: "obsidian_niches",
  POST_HISTORY: "obsidian_post_history",
  LEARNINGS: "obsidian_learnings",
  WEEKLY_ROUTINE: "obsidian_weekly_routine",
  ENGINE_MODE: "obsidian_engine_mode",
  FIRED_REMINDERS: "nisti_fired_reminders_v1",
} as const;

type SafeParseSchema = {
  safeParse: (input: unknown) => { success: boolean; data?: unknown };
};

export class StorageManager implements IStorageService {
  private static instance: StorageManager;

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public isDesktopRuntime(): boolean {
    return typeof window !== "undefined" && !!window.electronAPI;
  }

  public getRuntimeName(): "electron" | "web_sandbox" {
    return this.isDesktopRuntime() ? "electron" : "web_sandbox";
  }

  // ==========================================
  // CENTRALIZED APP STATE PERSISTENCE
  // ==========================================
  public loadAppState<T>(key: string, fallback: T, schema?: SafeParseSchema): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw) as unknown;
      if (!schema) return parsed as T;

      const result = schema.safeParse(parsed);
      if (!result.success) {
        console.warn(`Invalid persisted state ignored for key: ${key}`);
        return fallback;
      }
      return result.data as T;
    } catch (err) {
      console.warn(`Could not load persisted state for key: ${key}`, err);
      return fallback;
    }
  }

  public saveAppState<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`Could not persist app state for key: ${key}`, err);
    }
  }

  public loadTextState<T extends string>(key: string, fallback: T, schema?: SafeParseSchema): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      if (!schema) return raw as T;
      const result = schema.safeParse(raw);
      return result.success ? (result.data as T) : fallback;
    } catch {
      return fallback;
    }
  }

  public saveTextState(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`Could not persist text state for key: ${key}`, err);
    }
  }

  // ==========================================
  // AUDIT LOGGING
  // ==========================================
  public async logAudit(entry: Omit<AuditEntry, "id" | "timestamp" | "actor"> & { actor?: string }): Promise<AuditEntry> {
    const fullEntry: AuditEntry = {
      actor: entry.actor || "Gestor Nisti",
      ...entry,
      id: `audit_${generateUUID()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    try {
      const logs = await this.getAuditLogs();
      const updated = [fullEntry, ...logs].slice(0, 500);
      localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not persist audit log to localStorage", e);
    }

    return fullEntry;
  }

  public async getAuditLogs(): Promise<AuditEntry[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUDIT);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ==========================================
  // NOTES OPERATIONS
  // ==========================================
  public async readAllNotes(): Promise<KnowledgeNote[]> {
    if (this.isDesktopRuntime()) {
      if (!isObsidianRuntimeConnected()) {
        return [];
      }

      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (!vaultPath) {
          return [];
        }

        const files = await window.electronAPI!.readNotes();
        return files.map((f: any) => ({
          id: f.frontmatter?.id || `note_${generateFastHash("n", f.title)}`,
          path: `${f.folder}/${f.title}.md`,
          title: f.title,
          folder: normalizeTaxonomyFolder(f.folder),
          content: f.content,
          tags: Array.isArray(f.frontmatter?.tags) ? f.frontmatter.tags : [],
          wikilinks: [],
          frontmatter: {
            id: f.frontmatter?.id || `note_${generateFastHash("n", f.title)}`,
            tipo: f.frontmatter?.tipo || "Documento PKM",
            status: f.frontmatter?.status || "PENDENTE",
            owner: f.frontmatter?.owner || "Gestor de Marketing Nisti Print",
            created_at: f.frontmatter?.created_at || new Date().toISOString(),
            updated_at: f.frontmatter?.updated_at || new Date().toISOString(),
            confidencialidade: f.frontmatter?.confidencialidade || "Interno",
            produto: f.frontmatter?.produto || "Não classificado",
            nicho: f.frontmatter?.nicho || "Não classificado",
            canal: f.frontmatter?.canal || "Não classificado",
            projeto: f.frontmatter?.projeto || "Geral",
            tags: Array.isArray(f.frontmatter?.tags) ? f.frontmatter.tags : [],
            origem: f.frontmatter?.origem || "Obsidian Local Vault",
            approved_by: f.frontmatter?.approved_by || "",
            hash: f.frontmatter?.hash || generateFastHash("h", f.title),
          },
          lastModified: new Date(f.mtime || Date.now()).toISOString().substring(0, 16),
          syncedWithApi: true,
          isDemoData: false,
        }));
      } catch (err) {
        console.warn("Desktop Vault read failed closed:", err);
        return [];
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async readDesktopNotesForApp(): Promise<ObsidianNote[] | null> {
    if (!this.isDesktopRuntime() || !window.electronAPI) return null;
    if (!isObsidianRuntimeConnected()) return null;

    const vaultPath = await window.electronAPI.getVaultPath();
    if (!vaultPath) return null;

    const files = await window.electronAPI.readNotes();
    return files.map((f: any) => {
      const tags = Array.isArray(f.frontmatter?.tags) ? f.frontmatter.tags : [];
      return {
        id: f.frontmatter?.id || `desktop-${generateFastHash("n", `${f.folder}/${f.title}`)}`,
        path: `${f.folder || "00_Inbox"}/${f.title}.md`,
        title: f.title,
        folder: f.folder || "00_Inbox",
        content: f.content || "",
        frontmatter: f.frontmatter || {},
        tags,
        wikilinks: [],
        lastModified: new Date(f.mtime || Date.now()).toISOString().replace("T", " ").slice(0, 16),
        sizeBytes: typeof f.size === "number" ? f.size : undefined,
        syncedWithApi: true,
      } satisfies ObsidianNote;
    });
  }

  public async writeNote(note: KnowledgeNote): Promise<{ success: boolean; error?: string }> {
    const { safeFolder, safeFilename } = sanitizeSafePath(note.folder, note.title);
    const cleanTitle = safeFilename.replace(/\.md$/, "");

    const sanitizedNote: KnowledgeNote = {
      ...note,
      folder: safeFolder,
      title: cleanTitle,
      path: `${safeFolder}/${safeFilename}`,
      lastModified: new Date().toISOString().replace("T", " ").substring(0, 16),
    };

    if (this.isDesktopRuntime()) {
      if (!isObsidianRuntimeConnected()) {
        return { success: false, error: "Obsidian não está conectado. A gravação foi bloqueada." };
      }

      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (!vaultPath) {
          return { success: false, error: "Vault físico do Obsidian não selecionado." };
        }

        const writeResult = await window.electronAPI!.writeNote(
          safeFolder,
          cleanTitle,
          sanitizedNote.content,
          sanitizedNote.frontmatter
        );
        if (!writeResult?.success) {
          return { success: false, error: writeResult?.error || "O Obsidian não confirmou a gravação." };
        }

        await this.logAudit({
          action: "NOTE_CREATED",
          entityId: sanitizedNote.id,
          entityType: "KnowledgeNote",
          details: `Nota confirmada no Vault em ${sanitizedNote.path} (Status: ${sanitizedNote.frontmatter.status})`,
          actor: sanitizedNote.frontmatter.owner || "Gestor Nisti",
          newStateHash: sanitizedNote.frontmatter.hash,
        });
        return { success: true };
      } catch (err: any) {
        console.error("Desktop note write failed closed:", err);
        return { success: false, error: err?.message || "Falha ao gravar no Vault do Obsidian." };
      }
    }

    try {
      const existing = await this.readAllNotes();
      const filtered = existing.filter((n) => n.path !== sanitizedNote.path && n.id !== sanitizedNote.id);
      const updated = [sanitizedNote, ...filtered];
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));

      await this.logAudit({
        action: "NOTE_CREATED",
        entityId: sanitizedNote.id,
        entityType: "KnowledgeNote",
        details: `Nota gravada em ${sanitizedNote.path} (Status: ${sanitizedNote.frontmatter.status})`,
        actor: sanitizedNote.frontmatter.owner || "Gestor Nisti",
        newStateHash: sanitizedNote.frontmatter.hash,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public async deleteNote(folder: TaxonomyFolder, title: string): Promise<{ success: boolean; error?: string }> {
    const { safeFolder, safeFilename } = sanitizeSafePath(folder, title);
    const cleanTitle = safeFilename.replace(/\.md$/, "");

    if (this.isDesktopRuntime()) {
      if (!isObsidianRuntimeConnected()) {
        return { success: false, error: "Obsidian não está conectado. A exclusão foi bloqueada." };
      }

      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (!vaultPath) {
          return { success: false, error: "Vault físico do Obsidian não selecionado." };
        }

        const deleteResult = await window.electronAPI!.deleteNote(safeFolder, cleanTitle);
        if (!deleteResult?.success) {
          return { success: false, error: deleteResult?.error || "O Obsidian não confirmou a exclusão." };
        }

        await this.logAudit({
          action: "NOTE_DELETED",
          entityId: `${safeFolder}/${cleanTitle}`,
          entityType: "KnowledgeNote",
          details: `Nota excluída do Vault: ${safeFolder}/${safeFilename}`,
          actor: "Gestor Nisti",
        });
        return { success: true };
      } catch (err: any) {
        console.warn("Desktop delete failed closed:", err);
        return { success: false, error: err?.message || "Falha ao excluir do Vault do Obsidian." };
      }
    }

    try {
      const existing = await this.readAllNotes();
      const targetPath = `${safeFolder}/${safeFilename}`;
      const target = existing.find((n) => n.path === targetPath || (n.folder === safeFolder && n.title === cleanTitle));
      const updated = existing.filter((n) => n.path !== targetPath && !(n.folder === safeFolder && n.title === cleanTitle));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));

      if (target) {
        await this.logAudit({
          action: "NOTE_DELETED",
          entityId: target.id,
          entityType: "KnowledgeNote",
          details: `Nota excluída: ${target.path}`,
          actor: "Gestor Nisti",
        });
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // PROJECTS, TASKS, CONTENTS, AUTOMATIONS
  // ==========================================
  public async loadProjects(): Promise<Project[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async saveProjects(projects: Project[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }

  public async loadTasks(): Promise<Task[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async saveTasks(tasks: Task[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  public async loadContents(): Promise<Content[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CONTENTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async saveContents(contents: Content[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.CONTENTS, JSON.stringify(contents));
  }

  public async loadAutomations(): Promise<AutomationRule[]> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTOMATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async saveAutomations(rules: AutomationRule[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.AUTOMATIONS, JSON.stringify(rules));
  }

  // ==========================================
  // UNIFIED DAILY NOTE PATH
  // ==========================================
  public getDailyNotePath(dateStr?: string): string {
    const d = dateStr || localDateKey();
    return `00_Inbox/Daily-${d}.md`;
  }

  // ==========================================
  // SECURE API CONFIG
  // ==========================================
  public async saveApiConfig(config: ObsidianApiConfig): Promise<void> {
    localStorage.removeItem("obsidian_api_config");

    try {
      const { apiKey, geminiApiKey, ...nonSecretConfig } = config;
      const persistedConfig = {
        ...nonSecretConfig,
        connectionStatus: "disconnected" as const,
        errorMessage: undefined,
      };

      if (this.isDesktopRuntime() && window.electronAPI?.setSecret) {
        await Promise.all([
          window.electronAPI.setSecret("obsidianApiKey", apiKey || ""),
          window.electronAPI.setSecret("geminiApiKey", geminiApiKey || ""),
        ]);
        localStorage.setItem(
          STORAGE_KEYS.API_CONFIG_SECURE,
          JSON.stringify({ ...persistedConfig, apiKey: "", geminiApiKey: "" })
        );
        return;
      }

      const [encryptedObsidianKey, encryptedGeminiKey] = await Promise.all([
        encryptSecret(apiKey || ""),
        encryptSecret(geminiApiKey || ""),
      ]);
      localStorage.setItem(
        STORAGE_KEYS.API_CONFIG_SECURE,
        JSON.stringify({
          ...persistedConfig,
          apiKey: encryptedObsidianKey,
          geminiApiKey: encryptedGeminiKey,
        })
      );
    } catch (e) {
      const { apiKey: _apiKey, geminiApiKey: _geminiApiKey, ...nonSecretConfig } = config;
      localStorage.setItem(
        STORAGE_KEYS.API_CONFIG_SECURE,
        JSON.stringify({
          ...nonSecretConfig,
          connectionStatus: "disconnected",
          errorMessage: undefined,
          apiKey: "",
          geminiApiKey: "",
        })
      );
      console.warn("Could not persist API credentials securely; secrets kept only in memory for this session.", e);
    } finally {
      localStorage.removeItem("obsidian_api_config");
    }
  }

  public async loadApiConfig(defaultConfig: ObsidianApiConfig): Promise<ObsidianApiConfig> {
    try {
      const rawSecure = localStorage.getItem(STORAGE_KEYS.API_CONFIG_SECURE);
      if (rawSecure) {
        const parsed = JSON.parse(rawSecure);

        if (this.isDesktopRuntime() && window.electronAPI?.getSecret) {
          const [obsidianKey, geminiKey] = await Promise.all([
            window.electronAPI.getSecret("obsidianApiKey"),
            window.electronAPI.getSecret("geminiApiKey"),
          ]);
          return {
            ...defaultConfig,
            ...parsed,
            apiKey: obsidianKey || "",
            geminiApiKey: geminiKey || "",
            connectionStatus: "disconnected",
            errorMessage: undefined,
          };
        }

        const [decryptedObsidianKey, decryptedGeminiKey] = await Promise.all([
          decryptSecret(parsed.apiKey || ""),
          decryptSecret(parsed.geminiApiKey || ""),
        ]);
        return {
          ...defaultConfig,
          ...parsed,
          apiKey: decryptedObsidianKey,
          geminiApiKey: decryptedGeminiKey,
          connectionStatus: "disconnected",
          errorMessage: undefined,
        };
      }

      const legacyRaw = localStorage.getItem("obsidian_api_config");
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw) as ObsidianApiConfig;
        localStorage.removeItem("obsidian_api_config");
        await this.saveApiConfig(legacyParsed);
        return {
          ...defaultConfig,
          ...legacyParsed,
          apiKey: legacyParsed.apiKey || "",
          geminiApiKey: legacyParsed.geminiApiKey || "",
          connectionStatus: "disconnected",
          errorMessage: undefined,
        };
      }
    } catch (e) {
      console.warn("Could not load API config securely, using defaults without persisted secrets:", e);
    }

    return {
      ...defaultConfig,
      apiKey: "",
      geminiApiKey: "",
      connectionStatus: "disconnected",
      errorMessage: undefined,
    };
  }

  // ==========================================
  // SAFE WORKSPACE EXPORT (NO SENSITIVE TOKENS)
  // ==========================================
  public async exportSafeWorkspace(): Promise<{ jsonString: string; filename: string }> {
    const notes = await this.readAllNotes();
    const projects = await this.loadProjects();
    const tasks = await this.loadTasks();
    const contents = await this.loadContents();
    const automations = await this.loadAutomations();
    const auditLogs = await this.getAuditLogs();

    const exportPayload = {
      version: APP_VERSION,
      system: "Nisti Print PKM Marketing Hub",
      runtime: this.getRuntimeName(),
      exportedAt: new Date().toISOString(),
      taxonomy: [
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
      ],
      data: {
        notes,
        projects,
        tasks,
        contents,
        automations,
        auditLogs,
      },
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const dateStr = localDateKey();
    const filename = `Nisti_Marketing_Vault_Backup_${dateStr}.json`;

    return { jsonString, filename };
  }

  // ==========================================
  // FACTORY RESET (ZERAR DE FÁBRICA)
  // ==========================================
  public async factoryResetAll(): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }

      if (this.isDesktopRuntime() && window.electronAPI) {
        if (window.electronAPI.deleteSecret) {
          await Promise.all([
            window.electronAPI.deleteSecret("obsidianApiKey"),
            window.electronAPI.deleteSecret("geminiApiKey"),
          ]);
        } else if (window.electronAPI.setSecret) {
          await Promise.all([
            window.electronAPI.setSecret("obsidianApiKey", ""),
            window.electronAPI.setSecret("geminiApiKey", ""),
          ]);
        }
      }
    } catch (e) {
      console.error("Error during factory reset:", e);
    }
  }
}
