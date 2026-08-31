import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OFFICIAL_TAXONOMY_FOLDERS } from "../../domain/taxonomy";

export interface VaultNoteSummary {
  title: string;
  folder: string;
  relativePath: string;
  content: string;
  frontmatter: Record<string, unknown>;
  mtime: number;
  size: number;
}

export function parseMarkdownFrontmatter(fileContent: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: fileContent };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentArrayKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Array item e.g. "  - value" or "- value"
    if (trimmed.startsWith("-") && currentArrayKey) {
      const itemVal = trimmed.replace(/^-+\s*/, "").replace(/^['"]|['"]$/g, "");
      const existing = (frontmatter[currentArrayKey] as string[]) || [];
      existing.push(itemVal);
      frontmatter[currentArrayKey] = existing;
      continue;
    }

    // Key-value pair e.g. "key: value" or "key:"
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (!rawVal) {
        // Start of a list or empty object
        currentArrayKey = key;
        frontmatter[key] = [];
      } else {
        currentArrayKey = null;
        const cleanVal = rawVal.replace(/^['"]|['"]$/g, "");
        if (cleanVal === "true") frontmatter[key] = true;
        else if (cleanVal === "false") frontmatter[key] = false;
        else if (!isNaN(Number(cleanVal)) && cleanVal !== "") frontmatter[key] = Number(cleanVal);
        else frontmatter[key] = cleanVal;
      }
    }
  }

  return { frontmatter, body };
}

export class VaultReaderService {
  /**
   * Reads all markdown notes from the 10 official folders of the given vault.
   */
  public static async readAllNotes(vaultPath: string): Promise<VaultNoteSummary[]> {
    const resolvedVault = path.resolve(vaultPath);
    if (!existsSync(resolvedVault)) {
      throw new Error(`Vault inexistente no caminho: ${vaultPath}`);
    }

    const notes: VaultNoteSummary[] = [];

    for (const folder of OFFICIAL_TAXONOMY_FOLDERS) {
      const folderPath = path.join(resolvedVault, folder);
      if (!existsSync(folderPath)) continue;

      try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

          const absoluteFilePath = path.join(folderPath, entry.name);
          const stats = await fs.stat(absoluteFilePath);
          const rawContent = await fs.readFile(absoluteFilePath, "utf8");
          const { frontmatter, body } = parseMarkdownFrontmatter(rawContent);

          const title = entry.name.replace(/\.md$/i, "");
          const relativePath = `${folder}/${entry.name}`;

          notes.push({
            title,
            folder,
            relativePath,
            content: body,
            frontmatter,
            mtime: stats.mtimeMs,
            size: stats.size,
          });
        }
      } catch (err) {
        console.warn(`[VaultReader] Erro ao ler pasta ${folder}:`, err);
      }
    }

    return notes;
  }

  /**
   * Lists the official taxonomy folders found in the vault.
   */
  public static async listVaultFolders(vaultPath: string): Promise<string[]> {
    const resolvedVault = path.resolve(vaultPath);
    if (!existsSync(resolvedVault)) return [];

    const found: string[] = [];
    for (const folder of OFFICIAL_TAXONOMY_FOLDERS) {
      const folderPath = path.join(resolvedVault, folder);
      if (existsSync(folderPath)) {
        found.push(folder);
      }
    }
    return found;
  }
}
