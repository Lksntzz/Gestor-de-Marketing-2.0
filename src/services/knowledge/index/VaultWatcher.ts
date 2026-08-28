import * as fs from "node:fs";
import type { VaultIndexer } from "./VaultIndexer";

const IGNORED_DIRS = new Set([".obsidian", ".git", "node_modules", "dist", ".Trash"]);

export class VaultWatcher {
  private watcher: fs.FSWatcher | null = null;
  private syncTimeout: NodeJS.Timeout | null = null;
  private periodicInterval: NodeJS.Timeout | null = null;

  constructor(private indexer: VaultIndexer, private vaultPath: string) {}

  start() {
    this.stop();
    this.triggerSync();

    try {
      this.watcher = fs.watch(this.vaultPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          const parts = filename.split(/[/\\]/);
          if (parts.some(p => p.startsWith(".") || IGNORED_DIRS.has(p))) {
            return;
          }
        }
        this.debouncedSync();
      });
    } catch (e) {
      console.warn("Recursive watch not supported, using periodic sync.");
    }

    this.periodicInterval = setInterval(() => {
      this.triggerSync();
    }, 120_000); // 2 minutes
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
  }

  private debouncedSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.triggerSync();
    }, 2000);
  }

  private triggerSync() {
    this.indexer.sync().catch(e => console.error("Vault sync failed:", e));
  }
}
