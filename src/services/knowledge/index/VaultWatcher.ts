import * as fs from "node:fs";
import type { SyncMetrics, VaultIndexer } from "./VaultIndexer";

const IGNORED_DIRS = new Set([".obsidian", ".git", "node_modules", "dist", ".Trash"]);

export class VaultWatcher {
  private watcher: fs.FSWatcher | null = null;
  private syncTimeout: NodeJS.Timeout | null = null;
  private periodicInterval: NodeJS.Timeout | null = null;
  private syncChain: Promise<void> = Promise.resolve();

  constructor(private indexer: VaultIndexer, private vaultPath: string) {}

  start() {
    this.stop();
    this.triggerSync();

    try {
      this.watcher = fs.watch(this.vaultPath, { recursive: true }, (_eventType, filename) => {
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

  /**
   * Queues an explicit full index synchronization after any sync already in
   * progress. This avoids the previous "Sync already in progress" race and is
   * used by write flows that need the KnowledgeIndex to be current before they
   * report completion.
   */
  async syncNow(): Promise<SyncMetrics> {
    const run = this.syncChain
      .catch(() => undefined)
      .then(() => this.indexer.sync());
    this.syncChain = run.then(() => undefined, () => undefined);
    return await run;
  }

  private debouncedSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.triggerSync();
    }, 2000);
  }

  private triggerSync() {
    void this.syncNow().catch(e => console.error("Vault sync failed:", e));
  }
}
