import type { ObsidianNote } from "../types";

export const OBSIDIAN_CONNECTED_EVENT = "nisti:obsidian-connected";
export const OBSIDIAN_DISCONNECTED_EVENT = "nisti:obsidian-disconnected";
export const OBSIDIAN_SNAPSHOT_EVENT = "nisti:obsidian-snapshot";

const PERSISTENT_STATE_EVENT = "nisti:persistent-state-updated";
const APP_STATE_CHANGED_EVENT = "nisti:app-state-changed";
const OBSIDIAN_NOTES_STATE_KEY = "obsidian_marketing_notes";
const SNAPSHOT_SOURCE_ID = "obsidian-runtime-snapshot";

let connected = false;

export function isObsidianRuntimeConnected(): boolean {
  if (typeof window !== "undefined" && !window.electronAPI) {
    return true;
  }
  return connected;
}

export function markObsidianRuntimeConnected(): void {
  connected = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OBSIDIAN_CONNECTED_EVENT));
  }
}

export function markObsidianRuntimeDisconnected(reason?: string): void {
  connected = false;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OBSIDIAN_DISCONNECTED_EVENT, {
        detail: { reason: reason || "Obsidian desconectado." },
      })
    );
  }
}

function normalizedPath(value: unknown): string {
  return String(value || "").replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/+/, "");
}

/**
 * The physical Vault is the canonical document source. A fresh snapshot
 * replaces previously synchronized documents so deleted/renamed Markdown does
 * not remain available to search or AI context. Only explicitly unsynchronized
 * local drafts are preserved until they are written or discarded.
 */
function reconcileSnapshotWithLocalDrafts(notes: ObsidianNote[]): ObsidianNote[] {
  const byPath = new Map<string, ObsidianNote>();

  for (const note of notes) {
    const path = normalizedPath(note.path);
    if (!path) continue;
    byPath.set(path, { ...note, path, syncedWithApi: true });
  }

  if (typeof window === "undefined") return Array.from(byPath.values());

  try {
    const raw = window.localStorage?.getItem(OBSIDIAN_NOTES_STATE_KEY);
    const persisted = raw ? JSON.parse(raw) : [];
    if (Array.isArray(persisted)) {
      for (const candidate of persisted as ObsidianNote[]) {
        const path = normalizedPath(candidate?.path);
        if (!path || candidate?.syncedWithApi !== false || byPath.has(path)) continue;
        byPath.set(path, { ...candidate, path, syncedWithApi: false });
      }
    }
  } catch {
    // Invalid legacy state is ignored; the physical snapshot remains authoritative.
  }

  return Array.from(byPath.values());
}

function publishNotesIntoPersistentAppState(notes: ObsidianNote[]): void {
  if (typeof window === "undefined") return;

  const reconciledNotes = reconcileSnapshotWithLocalDrafts(notes);
  window.dispatchEvent(
    new CustomEvent(PERSISTENT_STATE_EVENT, {
      detail: {
        key: OBSIDIAN_NOTES_STATE_KEY,
        value: reconciledNotes,
        sourceId: SNAPSHOT_SOURCE_ID,
      },
    })
  );
  window.dispatchEvent(
    new CustomEvent(APP_STATE_CHANGED_EVENT, {
      detail: { key: OBSIDIAN_NOTES_STATE_KEY },
    })
  );
}

export function publishObsidianSnapshot(notes: ObsidianNote[], folders: string[]): void {
  if (typeof window === "undefined") return;

  const normalizedNotes = notes
    .filter((note) => note && typeof note.path === "string" && note.path.trim())
    .map((note) => ({
      ...note,
      path: normalizedPath(note.path),
      folder: normalizedPath(note.folder || "00_Inbox") || "00_Inbox",
      content: typeof note.content === "string" ? note.content : "",
      syncedWithApi: true,
    }));

  publishNotesIntoPersistentAppState(normalizedNotes);

  window.dispatchEvent(
    new CustomEvent(OBSIDIAN_SNAPSHOT_EVENT, {
      detail: {
        notes: normalizedNotes,
        folders: Array.from(new Set(folders.map(normalizedPath).filter(Boolean))).sort(),
      },
    })
  );
}
