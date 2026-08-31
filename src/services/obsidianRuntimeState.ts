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

function mergeSnapshotWithPersistedNotes(notes: ObsidianNote[]): ObsidianNote[] {
  if (typeof window === "undefined") return notes;

  let persisted: ObsidianNote[] = [];
  try {
    const raw = window.localStorage?.getItem(OBSIDIAN_NOTES_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) persisted = parsed as ObsidianNote[];
  } catch {
    persisted = [];
  }

  const byPath = new Map<string, ObsidianNote>();
  for (const note of persisted) {
    if (note && typeof note.path === "string" && note.path.trim()) {
      byPath.set(note.path.replace(/\\/g, "/"), note);
    }
  }
  for (const note of notes) {
    if (!note || typeof note.path !== "string" || !note.path.trim()) continue;
    const normalizedPath = note.path.replace(/\\/g, "/");
    byPath.set(normalizedPath, { ...note, path: normalizedPath });
  }

  return Array.from(byPath.values());
}

function publishNotesIntoPersistentAppState(notes: ObsidianNote[]): void {
  if (typeof window === "undefined") return;

  const mergedNotes = mergeSnapshotWithPersistedNotes(notes);
  window.dispatchEvent(
    new CustomEvent(PERSISTENT_STATE_EVENT, {
      detail: {
        key: OBSIDIAN_NOTES_STATE_KEY,
        value: mergedNotes,
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
      path: note.path.replace(/\\/g, "/"),
      folder: String(note.folder || "00_Inbox").replace(/\\/g, "/"),
      content: typeof note.content === "string" ? note.content : "",
      syncedWithApi: true,
    }));

  publishNotesIntoPersistentAppState(normalizedNotes);

  window.dispatchEvent(
    new CustomEvent(OBSIDIAN_SNAPSHOT_EVENT, {
      detail: {
        notes: normalizedNotes,
        folders: Array.from(new Set(folders.map((folder) => folder.replace(/\\/g, "/")))).sort(),
      },
    })
  );
}
