import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";

function normalize(source: string): string {
  return source.replace(/\r\n/g, "\n");
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
