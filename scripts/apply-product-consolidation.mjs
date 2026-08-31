import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceOnce(content, from, to, label) {
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`Pattern not found: ${label}`);
  if (content.indexOf(from, first + from.length) >= 0) throw new Error(`Pattern duplicated: ${label}`);
  return content.slice(0, first) + to + content.slice(first + from.length);
}

function replaceBetween(content, start, end, replacement, label) {
  const startIndex = content.indexOf(start);
  if (startIndex < 0) throw new Error(`Start pattern not found: ${label}`);
  const endIndex = content.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`End pattern not found: ${label}`);
  return content.slice(0, startIndex) + replacement + content.slice(endIndex);
}

// API: shared Markdown parser + resilient folder detection.
{
  const path = "src/services/api.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { localDateKey, upsertManagedSection } from "../utils/reliability";\n',
    'import { localDateKey, upsertManagedSection } from "../utils/reliability";\nimport { normalizeFrontmatterTags, parseMarkdownDocument } from "../utils/markdownFrontmatter";\n',
    "api parser import",
  );

  const oldFolderDetection = `          const isFolder = itemRelativePath.endsWith("/") || \n                           item?.type === "directory" || \n                           item?.type === "folder" ||\n                           (typeof item === "object" && item?.isFolder === true) ||\n                           (typeof item === "string" && !item.toLowerCase().endsWith(".md") && !item.includes("."));\n\n          if (isFolder) {`;
  const newFolderDetection = `          const isMarkdown = itemRelativePath.toLowerCase().endsWith(".md");\n          let isFolder = itemRelativePath.endsWith("/") ||\n                         item?.type === "directory" ||\n                         item?.type === "folder" ||\n                         (typeof item === "object" && item?.isFolder === true);\n\n          // Some Local REST API versions return directory entries as bare strings\n          // without a trailing slash. Probe ambiguous non-Markdown paths instead of\n          // guessing from the presence of a dot (valid folder names may contain one).\n          if (!isFolder && typeof item === "string" && !isMarkdown) {\n            const probeRelativePath = itemRelativePath.replace(/\\/$/, "");\n            const probeEncodedPath = probeRelativePath.split("/").map(encodeURIComponent).join("/");\n            try {\n              const probe = await obsidianProxyRequest(config, "GET", \`/vault/\${probeEncodedPath}/\`);\n              isFolder = Boolean(probe.response.ok && probe.data?.success);\n            } catch {\n              isFolder = false;\n            }\n          }\n\n          if (isFolder) {`;
  content = replaceOnce(content, oldFolderDetection, newFolderDetection, "api folder detection");

  content = replaceBetween(
    content,
    "                let frontmatter: Record<string, any> = {};\n",
    "\n                notesMap.set(itemRelativePath, {",
    `                const parsed = parseMarkdownDocument(content);\n                const frontmatter = parsed.frontmatter;\n                const body = parsed.body;\n                const tags = normalizeFrontmatterTags(frontmatter.tags);\n`,
    "api markdown parser block",
  );
  write(path, content);
}

// Electron: shared Markdown parser and richer knowledge-query payload.
{
  const path = "electron-main.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { pathToFileURL } from "url";\n',
    'import { pathToFileURL } from "url";\nimport { normalizeFrontmatterTags, parseMarkdownDocument } from "./src/utils/markdownFrontmatter";\n',
    "electron parser import",
  );

  content = replaceBetween(
    content,
    "        let frontmatter: any = {};\n        let body = content;\n",
    "        notes.push({",
    `        const parsed = parseMarkdownDocument(content);\n        const frontmatter = parsed.frontmatter;\n        const body = parsed.body;\n`,
    "electron scan parser block",
  );

  content = replaceBetween(
    content,
    "  const notes = docs.map(doc => ({\n",
    "\n  const selection = knowledgeContextService.select({",
    `  const notes = docs.map((doc) => {\n    let metadata: Record<string, unknown> = {};\n    try {\n      const parsed = JSON.parse(doc.metadata_json || "{}");\n      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed;\n    } catch {\n      metadata = {};\n    }\n    const directory = path.dirname(doc.relative_path).replace(/\\\\/g, "/");\n    const summary = String(doc.summary || "").trim();\n    const indexedContent = String(doc.content || "").trim();\n    const content = [summary ? \`## Resumo\\n\${summary}\` : "", indexedContent]\n      .filter(Boolean)\n      .join("\\n\\n");\n    return {\n      id: doc.id,\n      path: doc.relative_path.replace(/\\\\/g, "/"),\n      title: doc.title,\n      folder: directory === "." ? "00_Inbox" : directory,\n      content,\n      frontmatter: metadata,\n      tags: normalizeFrontmatterTags(metadata.tags ?? metadata.keywords),\n      wikilinks: [],\n      lastModified: new Date(doc.modified_at).toISOString(),\n      sizeBytes: doc.size,\n      syncedWithApi: true,\n    };\n  });\n`,
    "electron knowledge query mapping",
  );
  write(path, content);
}

// Knowledge retrieval must recognize the canonical Base folder.
{
  const path = "src/services/knowledge/KnowledgeContextService.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    "(?:00_Inbox|01_Estrategia|02_Produtos|03_Conteudos|04_Campanhas|05_Reunioes|06_Influenciadores_UGC|07_Pesquisas|08_Aprendizados|99_Templates)",
    "(?:00_Inbox|00_Base|01_Estrategia|02_Produtos|03_Conteudos|04_Campanhas|05_Reunioes|06_Influenciadores_UGC|07_Pesquisas|08_Aprendizados|99_Templates)",
    "knowledge taxonomy",
  );
  write(path, content);
}

// A file living in 00_Base is important context, but never becomes CONFIRMADO by folder alone.
{
  const path = "src/services/knowledge/EpistemicClassifier.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'if (normalizedFolder.includes("01_Estrategia") || normalizedFolder.includes("02_Produtos") || normalizedFolder.includes("08_Aprendizados")) {',
    'if (normalizedFolder.includes("00_Base") || normalizedFolder.includes("01_Estrategia") || normalizedFolder.includes("02_Produtos") || normalizedFolder.includes("08_Aprendizados")) {',
    "base epistemic fallback",
  );
  write(path, content);
}

// Storage bridge preserves YAML list tags parsed by the shared parser.
{
  const path = "src/services/storage/StorageManager.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { ObsidianApiConfig, ObsidianNote } from "../../types";\n',
    'import { ObsidianApiConfig, ObsidianNote } from "../../types";\nimport { normalizeFrontmatterTags } from "../../utils/markdownFrontmatter";\n',
    "storage tag import",
  );
  content = content.replaceAll(
    'Array.isArray(f.frontmatter?.tags) ? f.frontmatter.tags : []',
    'normalizeFrontmatterTags(f.frontmatter?.tags)',
  );
  write(path, content);
}

// Keep runtime schemas aligned with the current result/learning domain.
{
  const path = "src/domain/appStateSchemas.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'category: z.enum(["formato", "horario", "nicho", "emocao", "copywriting"]),',
    'category: z.enum(["formato", "horario", "nicho", "emocao", "copywriting", "canal", "oferta", "audiência"]),',
    "learning categories",
  );
  content = replaceOnce(
    content,
    'verdict: z.enum(["VENCEDOR", "ALTO_IMPACTO", "A_EVITAR", "EM_TESTE"]),',
    'verdict: z.enum(["VENCEDOR", "ALTO_IMPACTO", "A_EVITAR", "EM_TESTE", "CONFIRMADO", "REFUTADO"]),',
    "learning verdicts",
  );
  write(path, content);
}

// Keep UI taxonomy aligned with the canonical Vault bootstrap.
{
  const path = "src/data/defaultVault.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    '  "00_Inbox",\n  "01_Estrategia",',
    '  "00_Inbox",\n  "00_Base",\n  "01_Estrategia",',
    "default Base folder",
  );
  write(path, content);
}

console.log("Product consolidation transformations applied successfully.");
