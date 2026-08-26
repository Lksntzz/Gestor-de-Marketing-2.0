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
import { ObsidianApiConfig } from "../../types";

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

const APP_VERSION = "0.1.5";

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
      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (vaultPath) {
          const files = await window.electronAPI!.readNotes();
          return files.map((f: any) => ({
            id: f.frontmatter?.id || `note_${generateFastHash("n", f.title)}`,
            path: `${f.folder}/${f.title}.md`,
            title: f.title,
            folder: normalizeTaxonomyFolder(f.folder),
            content: f.content,
            tags: f.frontmatter?.tags || [],
            wikilinks: [],
            frontmatter: {
              id: f.frontmatter?.id || `note_${generateFastHash("n", f.title)}`,
              tipo: f.frontmatter?.tipo || "Documento PKM",
              status: f.frontmatter?.status || "OFICIAL",
              owner: f.frontmatter?.owner || "Gestor de Marketing Nisti Print",
              created_at: f.frontmatter?.created_at || new Date().toISOString(),
              updated_at: f.frontmatter?.updated_at || new Date().toISOString(),
              confidencialidade: f.frontmatter?.confidencialidade || "Interno",
              produto: f.frontmatter?.produto || "Linha Nisti Print",
              nicho: f.frontmatter?.nicho || "Papelaria Criativa & B2B",
              canal: f.frontmatter?.canal || "Omnichannel",
              projeto: f.frontmatter?.projeto || "Geral",
              tags: f.frontmatter?.tags || [],
              origem: f.frontmatter?.origem || "Obsidian Local Vault",
              approved_by: f.frontmatter?.approved_by || "",
              hash: f.frontmatter?.hash || generateFastHash("h", f.title),
            },
            lastModified: new Date(f.mtime || Date.now()).toISOString().substring(0, 16),
            syncedWithApi: true,
            isDemoData: false,
          }));
        }
      } catch (err) {
        console.warn("Desktop filesystem read failed, falling back to local sandbox:", err);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
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
      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (vaultPath) {
          await window.electronAPI!.writeNote(
            safeFolder,
            cleanTitle,
            sanitizedNote.content,
            sanitizedNote.frontmatter
          );
        }
      } catch (err: any) {
        console.error("Desktop note write error:", err);
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
      try {
        const vaultPath = await window.electronAPI!.getVaultPath();
        if (vaultPath) {
          await window.electronAPI!.deleteNote(safeFolder, cleanTitle);
        }
      } catch (err) {
        console.warn("Desktop delete error:", err);
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
    const d = dateStr || new Date().toISOString().split("T")[0];
    return `00_Inbox/Daily-${d}.md`;
  }

  // ==========================================
  // SECURE API CONFIG
  // ==========================================
  public async saveApiConfig(config: ObsidianApiConfig): Promise<void> {
    // Migration cleanup only: v0.1.5+ never intentionally writes this legacy key.
    localStorage.removeItem("obsidian_api_config");

    try {
      const { apiKey, ...nonSecretConfig } = config;

      if (this.isDesktopRuntime() && window.electronAPI?.setSecret) {
        await window.electronAPI.setSecret("obsidianApiKey", apiKey || "");
        localStorage.setItem(
          STORAGE_KEYS.API_CONFIG_SECURE,
          JSON.stringify({ ...nonSecretConfig, apiKey: "" })
        );
        return;
      }

      const encryptedKey = await encryptSecret(apiKey || "");
      localStorage.setItem(
        STORAGE_KEYS.API_CONFIG_SECURE,
        JSON.stringify({ ...nonSecretConfig, apiKey: encryptedKey })
      );
    } catch (e) {
      const { apiKey: _apiKey, ...nonSecretConfig } = config;
      localStorage.setItem(
        STORAGE_KEYS.API_CONFIG_SECURE,
        JSON.stringify({ ...nonSecretConfig, apiKey: "" })
      );
      console.warn("Could not persist API credential securely; secret kept only in memory for this session.", e);
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
          const secureKey = await window.electronAPI.getSecret("obsidianApiKey");
          return {
            ...defaultConfig,
            ...parsed,
            apiKey: secureKey || "",
          };
        }

        const decryptedKey = await decryptSecret(parsed.apiKey || "");
        return {
          ...defaultConfig,
          ...parsed,
          apiKey: decryptedKey,
        };
      }

      const legacyRaw = localStorage.getItem("obsidian_api_config");
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        localStorage.removeItem("obsidian_api_config");
        await this.saveApiConfig(legacyParsed);
        return legacyParsed;
      }
    } catch (e) {
      console.warn("Could not load API config securely, using defaults without persisted secret:", e);
    }

    return { ...defaultConfig, apiKey: "" };
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
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `Nisti_Marketing_Vault_Backup_${dateStr}.json`;

    return { jsonString, filename };
  }
}
