import { PERSISTENT_STATE_EVENT } from "../hooks/usePersistentState";
import { StorageManager } from "./storage/StorageManager";

const storage = StorageManager.getInstance();

/**
 * Replaces one persisted app-state collection from a service/component that is
 * outside the hook which owns that collection. The event uses a unique source
 * id so mounted usePersistentState hooks treat it as an external update and
 * revalidate it with their schema before accepting it.
 */
export function replacePersistentAppState<T>(key: string, value: T): void {
  storage.saveAppState(key, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PERSISTENT_STATE_EVENT, {
      detail: {
        key,
        value,
        sourceId: `external-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      },
    })
  );
}
