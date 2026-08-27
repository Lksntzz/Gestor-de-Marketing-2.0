import type { ObsidianNote } from "../types";

export const OBSIDIAN_CONNECTED_EVENT = "nisti:obsidian-connected";
export const OBSIDIAN_DISCONNECTED_EVENT = "nisti:obsidian-disconnected";
export const OBSIDIAN_SNAPSHOT_EVENT = "nisti:obsidian-snapshot";

let connected = false;

export function isObsidianRuntimeConnected(): boolean {
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

export function publishObsidianSnapshot(notes: ObsidianNote[], folders: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OBSIDIAN_SNAPSHOT_EVENT, {
      detail: {
        notes,
        folders: Array.from(new Set(folders.map((folder) => folder.replace(/\\/g, "/")))).sort(),
      },
    })
  );
}
