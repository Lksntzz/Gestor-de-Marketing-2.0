from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"pattern not found: {label}")
    return text.replace(old, new, 1)


# 1. REST snapshot must scan the whole active Vault, while Inbox automation stays scoped.
api_path = Path("src/services/api.ts")
api = api_path.read_text(encoding="utf-8")
api = replace_once(
    api,
    'let useDirectClientSideFetch = true;\nconst storage = StorageManager.getInstance();',
    'let useDirectClientSideFetch = true;\nconst OBSIDIAN_VAULT_IGNORED_SEGMENTS = new Set([".obsidian", ".trash", ".git", ".hg", ".svn", "node_modules"]);\nconst storage = StorageManager.getInstance();',
    "ignored Vault segments",
)
api = replace_once(
    api,
    'export async function syncWebObsidianNotes(config: ObsidianApiConfig): Promise<ObsidianNote[]> {',
    'export async function syncWebObsidianNotes(\n  config: ObsidianApiConfig,\n  roots: string[] = [""],\n): Promise<ObsidianNote[]> {',
    "sync signature",
)
api = replace_once(
    api,
    '          itemRelativePath = itemRelativePath.replace(/\\/+/g, "/");\n\n          const isMarkdown = itemRelativePath.toLowerCase().endsWith(".md");',
    '          itemRelativePath = itemRelativePath.replace(/\\/+/g, "/");\n\n          const pathSegments = itemRelativePath.split("/").filter(Boolean);\n          if (pathSegments.some((segment) => OBSIDIAN_VAULT_IGNORED_SEGMENTS.has(segment.toLowerCase()))) {\n            continue;\n          }\n\n          const isMarkdown = itemRelativePath.toLowerCase().endsWith(".md");',
    "ignored segment check",
)
api = replace_once(
    api,
    '  await crawl(NISTI_VAULT_ROOT);\n  const resultNotes = Array.from(notesMap.values());',
    '  const scanRoots = roots.length > 0 ? roots : [""];\n  for (const root of scanRoots) {\n    await crawl(root);\n  }\n  const resultNotes = Array.from(notesMap.values());',
    "whole Vault scan roots",
)
triage_start = api.index('async function triageNistiInbox(')
triage_end = api.index('\nfunction stopObsidianHeartbeat()', triage_start)
triage_block = api[triage_start:triage_end]
triage_block = replace_once(
    triage_block,
    '  const notes = await syncWebObsidianNotes(config);',
    '  const notes = await syncWebObsidianNotes(config, [NISTI_INBOX_FOLDER]);',
    "Inbox-only triage scan",
)
api = api[:triage_start] + triage_block + api[triage_end:]
api_path.write_text(api, encoding="utf-8")

# 2. Electron physical index is optional in REST-first mode. Empty IPC results must
# fall back to the REST snapshot already held in memory.
client_path = Path("src/services/creationGenerationClient.ts")
client = client_path.read_text(encoding="utf-8")
client = replace_once(
    client,
    '      const response = await window.electronAPI.queryKnowledge(query, preferredSourcePaths);\n      return { knowledgeSources: response.sources, knowledgeWarning: response.warning };',
    '      const response = await window.electronAPI.queryKnowledge(query, preferredSourcePaths);\n      if (Array.isArray(response?.sources) && response.sources.length > 0) {\n        return { knowledgeSources: response.sources, knowledgeWarning: response.warning };\n      }\n      if (notes.length === 0) {\n        return { knowledgeSources: [], knowledgeWarning: response?.warning };\n      }\n      console.warn("Electron knowledge index returned no sources; using the REST Vault snapshot in memory.");',
    "IPC empty fallback",
)
client_path.write_text(client, encoding="utf-8")

# 3. Existing Markdown outside Nisti Marketing is discoverable knowledge. It can
# unlock contextual work, but remains PENDENTE unless the note itself carries an
# explicit epistemic status. Automatic physical movement is still Inbox-only.
stage_path = Path("src/domain/smartKnowledgeStage2.ts")
stage = stage_path.read_text(encoding="utf-8")
start = stage.index('export function assessSmartKnowledgeReadiness(')
# This function is the final declaration in the file today.
old_function = stage[start:]
new_function = '''export function assessSmartKnowledgeReadiness(notes: ObsidianNote[]): {
  ready: boolean;
  usableSources: number;
  pendingSources: number;
  strategicSources: number;
} {
  const managed = notes.filter((note) => normalizedPath(note).startsWith(`${NISTI_VAULT_ROOT}/`));
  const external = notes.filter((note) => {
    const path = normalizedPath(note);
    if (path.startsWith(`${NISTI_VAULT_ROOT}/`)) return false;
    if (!String(note.content || "").trim()) return false;
    const segments = path.split("/").map((segment) => segment.toLowerCase());
    return !segments.some((segment) => [".obsidian", ".trash", ".git", ".hg", ".svn", "node_modules"].includes(segment));
  });

  const usable = managed.filter((note) => {
    const path = normalizedPath(note);
    if (path.startsWith(`${NISTI_INBOX_FOLDER}/`) || path.includes("/99_Templates/")) return false;
    const epistemic = String(note.frontmatter?.epistemic_status || note.frontmatter?.status || "PENDENTE").toUpperCase();
    return epistemic === "CONFIRMADO" || epistemic === "HIPÓTESE" || epistemic === "OFICIAL";
  });
  const strategic = usable.filter((note) => PLANNING_KNOWLEDGE_FOLDERS.some((folder) => normalizedPath(note).startsWith(`${folder}/`)));
  const managedPending = managed.filter((note) => {
    const epistemic = String(note.frontmatter?.epistemic_status || note.frontmatter?.status || "PENDENTE").toUpperCase();
    return epistemic === "PENDENTE" || epistemic === "NOVO" || epistemic === "EM REVISÃO";
  }).length;

  // Notes already present elsewhere in the active Obsidian Vault are legitimate
  // discovered sources. They are available to retrieval immediately, but are not
  // promoted to CONFIRMADO and are never moved unless they enter Nisti/00_Inbox.
  const discoveredExternalSources = external.length;

  return {
    ready: strategic.length > 0 || discoveredExternalSources > 0,
    usableSources: usable.length + discoveredExternalSources,
    pendingSources: managedPending + discoveredExternalSources,
    strategicSources: strategic.length + discoveredExternalSources,
  };
}
'''
stage = stage[:start] + new_function
stage_path.write_text(stage, encoding="utf-8")

# 4. Version alignment.
pkg_path = Path("package.json")
pkg = pkg_path.read_text(encoding="utf-8")
pkg = replace_once(pkg, '"version": "3.1.3"', '"version": "3.1.4"', "package version")
pkg_path.write_text(pkg, encoding="utf-8")

rel_path = Path("src/utils/reliability.ts")
rel = rel_path.read_text(encoding="utf-8")
rel = replace_once(rel, 'export const APP_VERSION = "3.1.3";', 'export const APP_VERSION = "3.1.4";', "app version")
rel_path.write_text(rel, encoding="utf-8")

# 5. Regression tests document the new source-of-truth contract.
test_path = Path("tests/obsidianFullVaultRead.test.ts")
test_path.write_text('''import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

function normalize(source: string): string {
  return source.replace(/\\r\\n/g, "\\n");
}

describe("Obsidian full Vault read", () => {
  test("REST snapshot scans the Vault root instead of only Nisti Marketing", () => {
    const source = normalize(readFileSync("src/services/api.ts", "utf8"));
    expect(source).toContain('roots: string[] = [""]');
    expect(source).toContain("for (const root of scanRoots)");
    expect(source).not.toContain("await crawl(NISTI_VAULT_ROOT);");
  });

  test("automatic triage remains restricted to Nisti Inbox", () => {
    const source = normalize(readFileSync("src/services/api.ts", "utf8"));
    const start = source.indexOf("async function triageNistiInbox");
    const end = source.indexOf("function stopObsidianHeartbeat", start);
    const block = source.slice(start, end);
    expect(block).toContain("syncWebObsidianNotes(config, [NISTI_INBOX_FOLDER])");
  });

  test("internal Obsidian metadata folders are excluded from recursive read", () => {
    const source = normalize(readFileSync("src/services/api.ts", "utf8"));
    expect(source).toContain("OBSIDIAN_VAULT_IGNORED_SEGMENTS");
    expect(source).toContain('".obsidian"');
    expect(source).toContain('".trash"');
  });

  test("AI falls back to REST-loaded notes when the optional physical index is empty", () => {
    const source = normalize(readFileSync("src/services/creationGenerationClient.ts", "utf8"));
    expect(source).toContain("response.sources.length > 0");
    expect(source).toContain("using the REST Vault snapshot in memory");
  });
});
''', encoding="utf-8")

print("Applied Obsidian 3.1.4 full Vault read hotfix")
