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
import { generateFastHash, generateUUID } from "../../utils/crypto";
import { APP_VERSION, localDateKey } from "../../utils/reliability";
import { ObsidianApiConfig, ObsidianNote } from "../../types";
import { normalizeFrontmatterTags } from "../../utils/markdownFrontmatter";
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
  private volatileSecrets = { obsidianApiKey: "", geminiApiKey: "", openaiApiKey: "" };

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
        return files.map((f: any) => {
          const sourcePath = `${f.folder || "00_Inbox"}/${f.title}.md`;
          const fallbackId = `note_${generateFastHash("n", sourcePath)}`;
          return {
            id: f.frontmatter?.id || fallbackId,
            path: sourcePath,
            title: f.title,
            folder: normalizeTaxonomyFolder(f.folder),
            content: f.content,
            tags: normalizeFrontmatterTags(f.frontmatter?.tags),
            wikilinks: [],
            frontmatter: {
              id: f.frontmatter?.id || fallbackId,
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
              tags: normalizeFrontmatterTags(f.frontmatter?.tags),
              origem: f.frontmatter?.origem || "Obsidian Local Vault",
              approved_by: f.frontmatter?.approved_by || "",
              hash: f.frontmatter?.hash || generateFastHash("h", sourcePath),
            },
            lastModified: new Date(f.mtime || Date.now()).toISOString().substring(0, 16),
            syncedWithApi: true,
            isDemoData: false,
          };
        });
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
      const tags = normalizeFrontmatterTags(f.frontmatter?.tags);
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
        console.warn("Desktop note write failed closed:", err.message || err);
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
    const { apiKey, geminiApiKey, openaiApiKey, ...nonSecretConfig } = config;
    const persistedConfig = {
      ...nonSecretConfig,
      aiProvider: config.aiProvider || "gemini",
      aiModel: config.aiModel || "",
      connectionStatus: "disconnected" as const,
      errorMessage: undefined,
    };

    const isSentinel = (val?: string) => 
      !val ||
      val === "saved-in-secure-storage" || 
      val === "********" || 
      val.includes("...");

    if (!isSentinel(apiKey)) {
      this.volatileSecrets.obsidianApiKey = apiKey || "";
    }
    if (!isSentinel(geminiApiKey)) {
      this.volatileSecrets.geminiApiKey = geminiApiKey || "";
    }
    if (!isSentinel(openaiApiKey)) {
      this.volatileSecrets.openaiApiKey = openaiApiKey || "";
    }

    if (this.isDesktopRuntime() && window.electronAPI?.setSecret) {
      const promises: Promise<any>[] = [];
      if (!isSentinel(apiKey)) {
        promises.push(window.electronAPI.setSecret("obsidianApiKey", apiKey || ""));
      }
      if (!isSentinel(geminiApiKey)) {
        promises.push(window.electronAPI.setSecret("geminiApiKey", geminiApiKey || ""));
      }
      if (!isSentinel(openaiApiKey)) {
        promises.push(window.electronAPI.setSecret("openaiApiKey", openaiApiKey || ""));
      }
      promises.push(
        window.electronAPI.setAIConfig?.({
          provider: persistedConfig.aiProvider,
          model: persistedConfig.aiModel,
        })
      );
      await Promise.all(promises);
    }

    // Only non-secret settings are persisted. Browser sessions keep credentials in memory.
    localStorage.setItem(STORAGE_KEYS.API_CONFIG_SECURE, JSON.stringify(persistedConfig));
    localStorage.removeItem("obsidian_api_config");
  }

  public async loadApiConfig(defaultConfig: ObsidianApiConfig): Promise<ObsidianApiConfig> {
    try {
      const legacyRaw = localStorage.getItem("obsidian_api_config");
      if (legacyRaw) {
        try {
          const legacyConfig = JSON.parse(legacyRaw) as ObsidianApiConfig;
          await this.saveApiConfig({ ...defaultConfig, ...legacyConfig });
          return {
            ...defaultConfig,
            ...this.sanitizeApiConfig(legacyConfig),
            apiKey: legacyConfig.apiKey || "",
            geminiApiKey: legacyConfig.geminiApiKey || "",
            openaiApiKey: legacyConfig.openaiApiKey || "",
            aiProvider: legacyConfig.aiProvider || "gemini",
            connectionStatus: "disconnected",
            errorMessage: undefined,
          };
        } finally {
          localStorage.removeItem("obsidian_api_config");
        }
      }

      const rawSecure = localStorage.getItem(STORAGE_KEYS.API_CONFIG_SECURE);
      if (rawSecure) {
        const parsedConfig = JSON.parse(rawSecure) as Partial<ObsidianApiConfig>;
        const sanitizedConfig = this.sanitizeApiConfig(parsedConfig);
        if (JSON.stringify(sanitizedConfig) !== JSON.stringify(parsedConfig)) {
          localStorage.setItem(STORAGE_KEYS.API_CONFIG_SECURE, JSON.stringify(sanitizedConfig));
        }

        if (this.isDesktopRuntime() && window.electronAPI?.getSecret) {
          const [obsidianKey, geminiKey, openaiKey] = await Promise.all([
            window.electronAPI.getSecret("obsidianApiKey"),
            window.electronAPI.getSecret("geminiApiKey"),
            window.electronAPI.getSecret("openaiApiKey"),
          ]);
          return {
            ...defaultConfig,
            ...sanitizedConfig,
            apiKey: obsidianKey || "",
            geminiApiKey: geminiKey || "",
            openaiApiKey: openaiKey || "",
            aiProvider: sanitizedConfig.aiProvider || "gemini",
            connectionStatus: "disconnected",
            errorMessage: undefined,
          };
        }
        return {
          ...defaultConfig,
          ...sanitizedConfig,
          apiKey: this.volatileSecrets.obsidianApiKey,
          geminiApiKey: this.volatileSecrets.geminiApiKey,
          openaiApiKey: this.volatileSecrets.openaiApiKey,
          aiProvider: sanitizedConfig.aiProvider || "gemini",
          connectionStatus: "disconnected",
          errorMessage: undefined,
        };
      }
    } catch (e) {
      localStorage.removeItem("obsidian_api_config");
      console.warn("Could not load API config securely, using safe storage or in-memory defaults:", e);
    }

    if (this.isDesktopRuntime() && window.electronAPI?.getSecret) {
      const [obsidianKey, geminiKey, openaiKey] = await Promise.all([
        window.electronAPI.getSecret("obsidianApiKey"),
        window.electronAPI.getSecret("geminiApiKey"),
        window.electronAPI.getSecret("openaiApiKey"),
      ]);
      return {
        ...defaultConfig,
        apiKey: obsidianKey || "",
        geminiApiKey: geminiKey || "",
        openaiApiKey: openaiKey || "",
        aiProvider: defaultConfig.aiProvider || "gemini",
        connectionStatus: "disconnected",
        errorMessage: undefined,
      };
    }

    return {
      ...defaultConfig,
      apiKey: this.volatileSecrets.obsidianApiKey,
      geminiApiKey: this.volatileSecrets.geminiApiKey,
      openaiApiKey: this.volatileSecrets.openaiApiKey,
      aiProvider: defaultConfig.aiProvider || "gemini",
      connectionStatus: "disconnected",
      errorMessage: undefined,
    };
  }

  public async loadAIRequestConfig(
    defaultConfig: ObsidianApiConfig
  ): Promise<{ provider: "gemini" | "openai"; model: string; apiKey: string }> {
    if (this.isDesktopRuntime() && window.electronAPI?.getAIConnectionState) {
      try {
        const runtime = await window.electronAPI.getAIConnectionState();
        if (runtime?.state) {
          const state = runtime.state;
          const provider = (state.provider || state.providerCandidate || defaultConfig.aiProvider || "gemini") as "gemini" | "openai";
          const model = String(state.model || state.modelCandidate || defaultConfig.aiModel || "").trim();
          return { provider, model, apiKey: "" };
        }
      } catch (err) {
        console.warn("Could not query AI connection state from trusted runtime:", err);
      }
    }

    if (localStorage.getItem("obsidian_api_config")) {
      const migratedConfig = await this.loadApiConfig(defaultConfig);
      const provider = migratedConfig.aiProvider === "openai" ? "openai" : "gemini";
      return {
        provider,
        model: String(migratedConfig.aiModel || "").trim(),
        apiKey: provider === "openai" ? migratedConfig.openaiApiKey || "" : migratedConfig.geminiApiKey || "",
      };
    }

    let storedConfig: Partial<ObsidianApiConfig> = {};
    try {
      const rawSecure = localStorage.getItem(STORAGE_KEYS.API_CONFIG_SECURE);
      if (rawSecure) {
        const parsedConfig = JSON.parse(rawSecure) as Partial<ObsidianApiConfig>;
        storedConfig = this.sanitizeApiConfig(parsedConfig);
        if (JSON.stringify(storedConfig) !== JSON.stringify(parsedConfig)) {
          localStorage.setItem(STORAGE_KEYS.API_CONFIG_SECURE, JSON.stringify(storedConfig));
        }
      }
    } catch (error) {
      console.warn("Could not load non-secret AI configuration:", error);
    }

    const provider = storedConfig.aiProvider === "openai" ? "openai" : "gemini";
    const model = String(storedConfig.aiModel || defaultConfig.aiModel || "").trim();
    const secretName = provider === "openai" ? "openaiApiKey" : "geminiApiKey";
    const apiKey = this.isDesktopRuntime() && window.electronAPI?.getSecret
      ? await window.electronAPI.getSecret(secretName)
      : this.volatileSecrets[secretName];

    return { provider, model, apiKey: apiKey || "" };
  }

  private sanitizeApiConfig(config: Partial<ObsidianApiConfig>): Partial<ObsidianApiConfig> {
    const sanitizedConfig = { ...config };
    delete sanitizedConfig.apiKey;
    delete sanitizedConfig.geminiApiKey;
    delete sanitizedConfig.openaiApiKey;
    return sanitizedConfig;
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
  // FACTORY RESET (LOCAL APP DATA ONLY)
  // ==========================================
  public async factoryResetAll(): Promise<void> {
    try {
      if (this.isDesktopRuntime() && window.electronAPI) {
        // Editorial items live in SQLite rather than localStorage. Clear them first
        // so a failed bridge operation cannot leave the UI reset while calendar data survives.
        if (window.electronAPI.editorialList && window.electronAPI.editorialDelete) {
          const editorialItems = await window.electronAPI.editorialList();
          for (const item of editorialItems) {
            const result = await window.electronAPI.editorialDelete(item.id);
            if (!result?.success) {
              throw new Error(`Não foi possível remover o item editorial \"${item.title}\" durante o reset.`);
            }
          }
        }

        // Revoke the renderer's filesystem authorization. The physical Vault and
        // its files are deliberately preserved; factory reset only clears app state.
        if (window.electronAPI.setObsidianConnectionState) {
          const connectionResult = await window.electronAPI.setObsidianConnectionState(false);
          if (!connectionResult?.success || connectionResult.connected !== false) {
            throw new Error("Não foi possível revogar a autorização local do Obsidian durante o reset.");
          }
        }

        const aiConnectionBridge = window.electronAPI as typeof window.electronAPI & {
          clearAIConnectionCredential?: () => Promise<{ success: boolean }>;
        };
        if (!aiConnectionBridge.clearAIConnectionCredential) {
          throw new Error("A ponte segura da credencial canônica de IA não está disponível para o reset.");
        }
        const aiCredentialResult = await aiConnectionBridge.clearAIConnectionCredential();
        if (!aiCredentialResult?.success) {
          throw new Error("Não foi possível remover a credencial canônica de IA durante o reset.");
        }

        if (window.electronAPI.deleteSecret) {
          const secretResults = await Promise.all([
            window.electronAPI.deleteSecret("obsidianApiKey"),
            window.electronAPI.deleteSecret("geminiApiKey"),
            window.electronAPI.deleteSecret("openaiApiKey"),
          ]);
          if (secretResults.some((result) => !result?.success)) {
            throw new Error("Não foi possível remover todas as credenciais protegidas durante o reset.");
          }
        } else if (window.electronAPI.setSecret) {
          const secretResults = await Promise.all([
            window.electronAPI.setSecret("obsidianApiKey", ""),
            window.electronAPI.setSecret("geminiApiKey", ""),
            window.electronAPI.setSecret("openaiApiKey", ""),
          ]);
          if (secretResults.some((result) => !result?.success)) {
            throw new Error("Não foi possível limpar todas as credenciais protegidas durante o reset.");
          }
        }
      }

      this.volatileSecrets = { obsidianApiKey: "", geminiApiKey: "", openaiApiKey: "" };
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
    } catch (e) {
      console.warn("Error during factory reset:", e);
      throw e;
    }
  }
}
