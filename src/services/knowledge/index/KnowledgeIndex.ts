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

  close() {
    this.db.close();
  }
}
