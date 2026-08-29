import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface CanonicalKnowledgeWriteInput {
  vaultPath: string;
  folder: string;
  title: string;
  content: string;
  frontmatter?: Record<string, unknown>;
}

export interface CanonicalKnowledgeWriteResult {
  noteTitle: string;
  noteRelativePath: string;
  absolutePath: string;
}

function normalizeFolder(folder: string): string {
  const normalized = String(folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) throw new Error("Pasta canônica não informada.");

  const segments = normalized.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === ".." || segment.startsWith(".") || /[<>:"|?*\x00-\x1F]/.test(segment))
  ) {
    throw new Error("Pasta inválida dentro do Vault do Obsidian.");
  }
  return segments.join(path.sep);
}

function normalizeTitle(title: string): string {
  const clean = String(title || "").trim();
  if (!clean) throw new Error("Título canônico não informado.");
  if (clean === "." || clean === ".." || /[<>:"/\\|?*\x00-\x1F]/.test(clean)) {
    throw new Error("Título canônico inválido.");
  }
  return clean.replace(/\.md$/i, "");
}

export function serializeCanonicalFrontmatter(frontmatter?: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return "";
  let output = "---\n";
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      output += `${key}:\n`;
      for (const item of value) output += `  - "${String(item).replace(/"/g, "'")}"\n`;
    } else {
      output += `${key}: "${String(value).replace(/"/g, "'")}"\n`;
    }
  }
  return `${output}---\n\n`;
}

export async function writeCanonicalKnowledgeNote(
  input: CanonicalKnowledgeWriteInput,
): Promise<CanonicalKnowledgeWriteResult> {
  const vaultPath = path.resolve(String(input.vaultPath || ""));
  if (!input.vaultPath || !existsSync(vaultPath)) {
    throw new Error("Vault configurado não existe mais ou não está acessível.");
  }

  const folder = normalizeFolder(input.folder);
  const folderPath = path.resolve(vaultPath, folder);
  const vaultPrefix = vaultPath.endsWith(path.sep) ? vaultPath : `${vaultPath}${path.sep}`;
  if (!folderPath.startsWith(vaultPrefix) || !existsSync(folderPath)) {
    throw new Error("A pasta canônica não existe no Vault atual.");
  }
  const folderStats = await fs.stat(folderPath);
  if (!folderStats.isDirectory()) throw new Error("O destino canônico não é uma pasta válida do Vault.");

  const title = normalizeTitle(input.title);
  const content = String(input.content || "").trim();
  if (!content) throw new Error("Conteúdo canônico vazio. A gravação foi bloqueada.");

  const absolutePath = path.resolve(folderPath, `${title}.md`);
  if (!absolutePath.startsWith(vaultPrefix)) {
    throw new Error("Violação de segurança: tentativa de gravação fora do Vault Obsidian.");
  }

  try {
    await fs.writeFile(
      absolutePath,
      `${serializeCanonicalFrontmatter(input.frontmatter)}${content}`,
      { encoding: "utf8", flag: "wx" },
    );
  } catch (error: any) {
    if (error?.code === "EEXIST") {
      const relativePath = path.relative(vaultPath, absolutePath).replace(/\\/g, "/");
      throw new Error(`O documento canônico ${relativePath} já existe. A gravação foi bloqueada para evitar duplicação.`);
    }
    throw error;
  }

  return {
    noteTitle: title,
    noteRelativePath: path.relative(vaultPath, absolutePath).replace(/\\/g, "/"),
    absolutePath,
  };
}
