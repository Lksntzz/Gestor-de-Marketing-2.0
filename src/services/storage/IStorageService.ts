import { KnowledgeNote, Project, Task, Content, AuditEntry, AutomationRule, Metric } from "../../domain/schemas";
import { TaxonomyFolder, sanitizeSafePath } from "../../domain/taxonomy";

export interface IStorageService {
  isDesktopRuntime(): boolean;
  getRuntimeName(): "electron" | "web_sandbox";
  
  // Notes Operations
  readAllNotes(): Promise<KnowledgeNote[]>;
  writeNote(note: KnowledgeNote): Promise<{ success: boolean; error?: string }>;
  deleteNote(folder: TaxonomyFolder, title: string): Promise<{ success: boolean; error?: string }>;
  
  // Projects Operations
  loadProjects(): Promise<Project[]>;
  saveProjects(projects: Project[]): Promise<void>;
  
  // Tasks Operations
  loadTasks(): Promise<Task[]>;
  saveTasks(tasks: Task[]): Promise<void>;

  // Content Operations
  loadContents(): Promise<Content[]>;
  saveContents(contents: Content[]): Promise<void>;

  // Automations Operations
  loadAutomations(): Promise<AutomationRule[]>;
  saveAutomations(rules: AutomationRule[]): Promise<void>;

  // Audit Operations
  logAudit(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<AuditEntry>;
  getAuditLogs(): Promise<AuditEntry[]>;

  // Workspace Export & Safe Sync
  exportSafeWorkspace(): Promise<{ jsonString: string; filename: string }>;
}
