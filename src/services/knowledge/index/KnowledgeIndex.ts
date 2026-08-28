import { DatabaseSync } from "node:sqlite";

export interface KnowledgeDocument {
  id: string;
  vault_id: string;
  relative_path: string;
  title: string;
  file_type: string;
  content_hash: string;
  modified_at: number;
  size: number;
  content: string;
  summary: string;
  category: string;
  epistemic_status: string;
  metadata_json: string;
  indexed_at: number;
}

export class KnowledgeIndex {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
      );
    `);
    
    let version = 0;
    try {
      const row = this.db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as any;
      if (row && row.v) version = row.v;
    } catch {}

    if (version < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id TEXT PRIMARY KEY,
          vault_id TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          title TEXT,
          file_type TEXT,
          content_hash TEXT,
          modified_at INTEGER,
          size INTEGER,
          content TEXT,
          summary TEXT,
          category TEXT,
          epistemic_status TEXT,
          metadata_json TEXT,
          indexed_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_vault_path ON knowledge_documents(vault_id, relative_path);
        INSERT OR IGNORE INTO schema_migrations (version) VALUES (1);
      `);
    }

    if (version < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS editorial_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content_type TEXT,
          platform TEXT,
          objective TEXT,
          scheduled_date TEXT,
          scheduled_time TEXT,
          status TEXT,
          priority TEXT,
          idea_id TEXT,
          script_id TEXT,
          campaign_id TEXT,
          obsidian_path TEXT,
          notes TEXT,
          created_at INTEGER,
          updated_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_editorial_date ON editorial_items(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_editorial_status ON editorial_items(status);
        CREATE INDEX IF NOT EXISTS idx_editorial_platform ON editorial_items(platform);
        INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
      `);
    }
  }

  getDocumentsByVault(vaultId: string): KnowledgeDocument[] {
    return this.db.prepare('SELECT * FROM knowledge_documents WHERE vault_id = ?').all(vaultId) as unknown as KnowledgeDocument[];
  }

  getDocumentPathsAndStats(vaultId: string): Record<string, { modified_at: number; size: number; content_hash: string }> {
    const rows = this.db.prepare('SELECT relative_path, modified_at, size, content_hash FROM knowledge_documents WHERE vault_id = ?').all(vaultId) as any[];
    const result: Record<string, any> = {};
    for (const row of rows) result[row.relative_path] = row;
    return result;
  }

  upsertDocument(doc: KnowledgeDocument) {
    const stmt = this.db.prepare(`
      INSERT INTO knowledge_documents (
        id, vault_id, relative_path, title, file_type, content_hash, modified_at, size, content, summary, category, epistemic_status, metadata_json, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        relative_path = excluded.relative_path,
        title = excluded.title,
        content_hash = excluded.content_hash,
        modified_at = excluded.modified_at,
        size = excluded.size,
        content = excluded.content,
        summary = excluded.summary,
        category = excluded.category,
        epistemic_status = excluded.epistemic_status,
        metadata_json = excluded.metadata_json,
        indexed_at = excluded.indexed_at
    `);
    stmt.run(
      doc.id, doc.vault_id, doc.relative_path, doc.title, doc.file_type, doc.content_hash, 
      doc.modified_at, doc.size, doc.content, doc.summary, doc.category, doc.epistemic_status, 
      doc.metadata_json, doc.indexed_at
    );
  }

  deleteDocument(vaultId: string, relativePath: string) {
    this.db.prepare('DELETE FROM knowledge_documents WHERE vault_id = ? AND relative_path = ?').run(vaultId, relativePath);
  }

  updateDocumentMtime(vaultId: string, relativePath: string, modifiedAt: number) {
    this.db.prepare('UPDATE knowledge_documents SET modified_at = ? WHERE vault_id = ? AND relative_path = ?').run(modifiedAt, vaultId, relativePath);
  }

  getEditorialItems(): any[] {
    return this.db.prepare('SELECT * FROM editorial_items ORDER BY scheduled_date ASC').all() as any[];
  }

  upsertEditorialItem(item: any) {
    const stmt = this.db.prepare(`
      INSERT INTO editorial_items (
        id, title, content_type, platform, objective, scheduled_date, scheduled_time, status, priority, idea_id, script_id, campaign_id, obsidian_path, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content_type = excluded.content_type,
        platform = excluded.platform,
        objective = excluded.objective,
        scheduled_date = excluded.scheduled_date,
        scheduled_time = excluded.scheduled_time,
        status = excluded.status,
        priority = excluded.priority,
        idea_id = excluded.idea_id,
        script_id = excluded.script_id,
        campaign_id = excluded.campaign_id,
        obsidian_path = excluded.obsidian_path,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      item.id, item.title, item.content_type || item.contentType, item.platform, item.objective,
      item.scheduled_date || item.scheduledDate, item.scheduled_time || item.scheduledTime, item.status, item.priority,
      item.idea_id || item.ideaId, item.script_id || item.scriptId, item.campaign_id || item.campaignId,
      item.obsidian_path || item.obsidianPath, item.notes, item.created_at || item.createdAt, item.updated_at || item.updatedAt
    );
  }

  deleteEditorialItem(id: string) {
    this.db.prepare('DELETE FROM editorial_items WHERE id = ?').run(id);
  }

  close() {
    this.db.close();
  }
}
