import { AppStateSchemas } from "../domain/appStateSchemas";
import {
  parseWorkspaceBackupText,
  serializeWorkspaceBackup,
  type WorkspaceRestorePlan,
} from "../domain/workspaceProtection";
import type { EditorialItem, ObsidianApiConfig } from "../types";
import { APP_VERSION, localDateKey } from "../utils/reliability";
import { APP_STATE_KEYS, StorageManager } from "./storage/StorageManager";

const storage = StorageManager.getInstance();

export interface WorkspaceBackupSummary {
  filename: string;
  jsonString: string;
  editorialItems: number;
}

export interface WorkspaceRestoreResult {
  plan: WorkspaceRestorePlan;
  restoredApiConfig?: ObsidianApiConfig;
  editorialItemsMerged: number;
}

function loadArrayState<T>(key: string, schema: { safeParse: (input: unknown) => { success: boolean; data?: unknown } }): T[] {
  return storage.loadAppState<T[]>(key, [], schema);
}

async function readEditorialItemsForBackup(): Promise<EditorialItem[]> {
  if (typeof window === "undefined" || !window.electronAPI?.editorialList) return [];

  try {
    return await window.electronAPI.editorialList();
  } catch (error) {
    console.warn("Could not read editorial items for protected backup:", error);
    throw new Error("Não foi possível incluir o Calendário Editorial no backup. O arquivo não foi gerado para evitar uma cópia incompleta.");
  }
}

export async function prepareWorkspaceBackup(config: ObsidianApiConfig): Promise<WorkspaceBackupSummary> {
  const editorialItems = await readEditorialItemsForBackup();
  const validatedEditorialItems = AppStateSchemas.editorialItems.parse(editorialItems);
  const jsonString = serializeWorkspaceBackup({
    version: APP_VERSION,
    notes: loadArrayState(APP_STATE_KEYS.NOTES, AppStateSchemas.notes),
    campaigns: loadArrayState(APP_STATE_KEYS.CAMPAIGNS, AppStateSchemas.campaigns),
    tasks: loadArrayState(APP_STATE_KEYS.TASKS, AppStateSchemas.tasks),
    automationRules: loadArrayState(APP_STATE_KEYS.AUTOMATION_RULES, AppStateSchemas.automationRules),
    ideas: loadArrayState(APP_STATE_KEYS.IDEAS, AppStateSchemas.ideas),
    scripts: loadArrayState(APP_STATE_KEYS.SCRIPTS, AppStateSchemas.scripts),
    visuals: loadArrayState(APP_STATE_KEYS.VISUALS, AppStateSchemas.visuals),
    emotionalDrivers: loadArrayState(APP_STATE_KEYS.EMOTIONAL_DRIVERS, AppStateSchemas.emotionalDrivers),
    niches: loadArrayState(APP_STATE_KEYS.NICHES, AppStateSchemas.niches),
    postHistory: loadArrayState(APP_STATE_KEYS.POST_HISTORY, AppStateSchemas.postHistory),
    learnings: loadArrayState(APP_STATE_KEYS.LEARNINGS, AppStateSchemas.learnings),
    weeklyRoutine: loadArrayState(APP_STATE_KEYS.WEEKLY_ROUTINE, AppStateSchemas.weeklyRoutine),
    engineMode: storage.loadTextState(APP_STATE_KEYS.ENGINE_MODE, "local", AppStateSchemas.engineMode),
    editorialItems: validatedEditorialItems,
    apiConfig: config,
  });

  return {
    jsonString,
    filename: `nisti-marketing-workspace-v${APP_VERSION}-${localDateKey()}.json`,
    editorialItems: editorialItems.length,
  };
}

export async function downloadWorkspaceBackup(config: ObsidianApiConfig): Promise<WorkspaceBackupSummary> {
  const backup = await prepareWorkspaceBackup(config);
  if (typeof document === "undefined" || typeof URL === "undefined") return backup;

  const blob = new Blob([backup.jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = backup.filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }

  return backup;
}

async function mergeEditorialItems(items: EditorialItem[] | undefined): Promise<number> {
  if (items === undefined || items.length === 0) return 0;
  if (typeof window === "undefined" || !window.electronAPI?.editorialUpsert) {
    throw new Error("Este backup contém Calendário Editorial, mas o runtime atual não permite restaurá-lo com segurança.");
  }

  let merged = 0;
  for (const item of items) {
    const result = await window.electronAPI.editorialUpsert(item);
    if (!result?.success) {
      throw new Error(`Falha ao restaurar o item editorial \"${item.title}\". A importação foi interrompida.`);
    }
    merged += 1;
  }
  return merged;
}

function persistIfPresent<T>(
  key: string,
  value: T | undefined,
): void {
  if (value !== undefined) storage.saveAppState(key, value);
}

export async function restoreWorkspaceBackupText(
  jsonText: string,
  currentConfig: ObsidianApiConfig,
): Promise<WorkspaceRestoreResult> {
  const plan = parseWorkspaceBackupText(jsonText);

  // Calendar data is restored first and only by non-destructive upsert during Phase 0.
  // No existing editorial row is deleted here.
  const editorialItemsMerged = await mergeEditorialItems(plan.editorialItems as EditorialItem[] | undefined);

  storage.saveAppState(APP_STATE_KEYS.NOTES, plan.notes);
  storage.saveAppState(APP_STATE_KEYS.CAMPAIGNS, plan.campaigns);
  storage.saveAppState(APP_STATE_KEYS.TASKS, plan.tasks);
  persistIfPresent(APP_STATE_KEYS.AUTOMATION_RULES, plan.automationRules);
  persistIfPresent(APP_STATE_KEYS.IDEAS, plan.ideas);
  persistIfPresent(APP_STATE_KEYS.SCRIPTS, plan.scripts);
  persistIfPresent(APP_STATE_KEYS.VISUALS, plan.visuals);
  persistIfPresent(APP_STATE_KEYS.EMOTIONAL_DRIVERS, plan.emotionalDrivers);
  persistIfPresent(APP_STATE_KEYS.NICHES, plan.niches);
  persistIfPresent(APP_STATE_KEYS.POST_HISTORY, plan.postHistory);
  persistIfPresent(APP_STATE_KEYS.LEARNINGS, plan.learnings);
  persistIfPresent(APP_STATE_KEYS.WEEKLY_ROUTINE, plan.weeklyRoutine);

  if (plan.engineMode !== undefined) {
    storage.saveTextState(APP_STATE_KEYS.ENGINE_MODE, plan.engineMode);
  }

  let restoredApiConfig: ObsidianApiConfig | undefined;
  if (plan.apiConfig) {
    restoredApiConfig = {
      ...currentConfig,
      ...plan.apiConfig,
      apiKey: currentConfig.apiKey || "",
      geminiApiKey: currentConfig.geminiApiKey || "",
      openaiApiKey: currentConfig.openaiApiKey || "",
      connectionStatus: "disconnected",
      errorMessage: undefined,
    };
    await storage.saveApiConfig(restoredApiConfig);
  }

  return { plan, restoredApiConfig, editorialItemsMerged };
}
