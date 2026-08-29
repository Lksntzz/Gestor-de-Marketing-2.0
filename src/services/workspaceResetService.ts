import { StorageManager } from "./storage/StorageManager";

const storage = StorageManager.getInstance();

export interface WorkspaceResetResult {
  editorialItemsRemoved: number;
}

async function clearEditorialCalendar(): Promise<number> {
  if (typeof window === "undefined" || !window.electronAPI?.editorialList) return 0;
  if (!window.electronAPI.editorialDelete) {
    throw new Error("O runtime atual não permite limpar o Calendário Editorial com segurança.");
  }

  const items = await window.electronAPI.editorialList();
  let removed = 0;

  for (const item of items) {
    const result = await window.electronAPI.editorialDelete(item.id);
    if (!result?.success) {
      throw new Error(`Falha ao limpar o item editorial \"${item.title}\". O reset foi interrompido antes de apagar o restante do estado local.`);
    }
    removed += 1;
  }

  return removed;
}

/**
 * Clears only Nisti Marketing application state.
 * Physical files inside the selected Obsidian Vault are never deleted here.
 */
export async function resetLocalWorkspace(): Promise<WorkspaceResetResult> {
  // SQLite-backed user data is cleared before localStorage. If the runtime cannot
  // reconcile the calendar, we fail before clearing the rest of the workspace.
  const editorialItemsRemoved = await clearEditorialCalendar();
  await storage.factoryResetAll();
  return { editorialItemsRemoved };
}
