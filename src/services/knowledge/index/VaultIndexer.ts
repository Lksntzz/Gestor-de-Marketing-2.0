import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { KnowledgeIndex } from "./KnowledgeIndex";

export interface SyncMetrics {
  scanned: number;
  indexed: number;
  updated: number;
  deleted: number;
  unchanged: number;
  failed: number;
  durationMs: number;
}

const IGNORED_DIRS = new Set([".obsidian", ".git", "node_modules", "dist", ".Trash"]);
const MAX_MD_SIZE = 5 * 1024 * 1024; // 5MB limit for text files
const SUPPORTED_EXTS = new Set([".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

export class VaultIndexer {
  private isSyncing = false;

  constructor(
    private db: KnowledgeIndex,
    private vaultPath: string,
    private vaultId: string,
    private assetProcessor?: (fullPath: string, relativePath: string, ext: string) => Promise<any>
  ) {}

  async sync(): Promise<SyncMetrics> {
    if (this.isSyncing) throw new Error("Sync already in progress");
    this.isSyncing = true;
    const startTime = Date.now();
    const metrics: SyncMetrics = { scanned: 0, indexed: 0, updated: 0, deleted: 0, unchanged: 0, failed: 0, durationMs: 0 };

    try {
      const existingDocs = this.db.getDocumentPathsAndStats(this.vaultId);
      const currentDiskPaths = new Set<string>();

      await this.scanDir(this.vaultPath, "", existingDocs, currentDiskPaths, metrics);

      for (const relPath of Object.keys(existingDocs)) {
        if (!currentDiskPaths.has(relPath)) {
          this.db.deleteDocument(this.vaultId, relPath);
          metrics.deleted++;
        }
      }
    } finally {
      this.isSyncing = false;
      metrics.durationMs = Date.now() - startTime;
    }
    return metrics;
  }

  private async scanDir(
    currentDir: string,
    relativeDir: string,
    existingDocs: Record<string, { modified_at: number; size: number; content_hash: string }>,
    currentDiskPaths: Set<string>,
    metrics: SyncMetrics
  ) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const normalizedPath = relativePath.replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !IGNORED_DIRS.has(entry.name)) {
          await this.scanDir(fullPath, relativePath, existingDocs, currentDiskPaths, metrics);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTS.has(ext)) continue;

      currentDiskPaths.add(normalizedPath);
      metrics.scanned++;

      try {
        const stats = await fs.stat(fullPath);
        const existing = existingDocs[normalizedPath];

        if (ext === ".md" || ext === ".txt") {
          if (stats.size > MAX_MD_SIZE) {
            console.warn(`File ${normalizedPath} exceeds text limit, skipped.`);
            metrics.failed++;
            continue;
          }

          if (existing && existing.modified_at === stats.mtimeMs && existing.size === stats.size) {
            metrics.unchanged++;
            continue;
          }

          const content = await fs.readFile(fullPath, "utf8");
          const hash = crypto.createHash("sha256").update(content).digest("hex");

          if (existing && existing.content_hash === hash) {
            // Update the record with the new mtime if content hash is same but mtime changed (e.g. touch)
            if (existing.modified_at !== stats.mtimeMs) {
              this.db.updateDocumentMtime(this.vaultId, normalizedPath, stats.mtimeMs);
            }
            metrics.unchanged++;
            continue;
          }

          const parsed = ext === ".md" ? this.parseMarkdown(content) : { frontmatter: {}, body: content };
          const docId = crypto.createHash("sha256").update(`${this.vaultId}:${normalizedPath}`).digest("hex");

          this.db.upsertDocument({
            id: docId,
            vault_id: this.vaultId,
            relative_path: normalizedPath,
            title: entry.name.replace(/\.md$|\.txt$/i, ""),
            file_type: ext === ".md" ? "md" : "txt",
            content_hash: hash,
            modified_at: stats.mtimeMs,
            size: stats.size,
            content: parsed.body,
            summary: "",
            category: parsed.frontmatter.category || "",
            epistemic_status: parsed.frontmatter.epistemic_status || parsed.frontmatter.status || "",
            metadata_json: JSON.stringify(parsed.frontmatter),
            indexed_at: Date.now()
          });

          if (existing) metrics.updated++;
          else metrics.indexed++;

        } else {
          // Asset processing (PDF, Images)
          if (existing && existing.modified_at === stats.mtimeMs && existing.size === stats.size) {
            metrics.unchanged++;
            continue;
          }

          if (!this.assetProcessor) {
             metrics.unchanged++;
             continue;
          }

          const analysis = await this.assetProcessor(fullPath, normalizedPath, ext);
          const hash = crypto.createHash("sha256").update(`${stats.mtimeMs}:${stats.size}`).digest("hex");
          
          if (existing && existing.content_hash === hash) {
            if (existing.modified_at !== stats.mtimeMs) {
              this.db.updateDocumentMtime(this.vaultId, normalizedPath, stats.mtimeMs);
            }
            metrics.unchanged++;
            continue;
          }

          const docId = crypto.createHash("sha256").update(`${this.vaultId}:${normalizedPath}`).digest("hex");
          
          this.db.upsertDocument({
            id: docId,
            vault_id: this.vaultId,
            relative_path: normalizedPath,
            title: entry.name,
            file_type: ext.substring(1),
            content_hash: hash,
            modified_at: stats.mtimeMs,
            size: stats.size,
            content: analysis.visibleText || "",
            summary: analysis.summary || "",
            category: analysis.category || "",
            epistemic_status: analysis.epistemicStatus || "PENDENTE",
            metadata_json: JSON.stringify(analysis),
            indexed_at: Date.now()
          });

          if (existing) metrics.updated++;
          else metrics.indexed++;
        }
      } catch (err) {
        console.error(`Failed to index ${normalizedPath}:`, err);
        metrics.failed++;
      }
    }
  }

  private parseMarkdown(content: string) {
    let frontmatter: Record<string, any> = {};
    let body = content;
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (fmMatch) {
      body = content.slice(fmMatch[0].length).trim();
      const fmLines = fmMatch[1].split("\n");
      for (const line of fmLines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > -1) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, "");
          frontmatter[key] = value;
        }
      }
    }
    return { frontmatter, body };
  }
}
