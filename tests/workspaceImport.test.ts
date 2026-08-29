import { describe, expect, test } from "bun:test";
import { parseWorkspaceImport } from "../src/domain/appStateSchemas";

const validWorkspace = {
  version: "0.1.6",
  notes: [
    {
      id: "note-1",
      path: "00_Inbox/Teste.md",
      title: "Teste",
      folder: "00_Inbox",
      content: "# Teste",
      frontmatter: { status: "OFICIAL" },
      tags: ["teste"],
      wikilinks: [],
      lastModified: "2026-08-26 10:00",
    },
  ],
  campaigns: [
    {
      id: "camp-1",
      title: "Campanha",
      objective: "Validar",
      targetAudience: "Clientes",
      tone: "Profissional",
      status: "active",
      channels: ["Instagram"],
      channelsContent: [],
      linkedNotePaths: [],
      summary: "Resumo",
      strategy: "Estratégia",
      startDate: "2026-08-26",
      endDate: "2026-09-01",
      createdDate: "2026-08-26",
    },
  ],
  tasks: [
    {
      id: "task-1",
      title: "Tarefa",
      priority: "high",
      status: "todo",
      dueDate: "2026-08-26",
      obsidianTaskString: "- [ ] Tarefa",
      tags: ["marketing"],
      isReminderActive: false,
    },
  ],
  apiConfig: {
    endpoint: "http://127.0.0.1:27124",
    vaultName: "MarketingVault",
    apiKey: "SHOULD_NEVER_BE_IMPORTED",
  },
};

describe("workspace import validation", () => {
  test("accepts a valid versioned workspace and strips credentials", () => {
    const parsed = parseWorkspaceImport(validWorkspace);
    expect(parsed.version).toBe("0.1.6");
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.apiConfig).toBeDefined();
    expect((parsed.apiConfig as Record<string, unknown>).apiKey).toBeUndefined();
  });

  test("accepts sparse result evidence without fabricating legacy metrics", () => {
    const parsed = parseWorkspaceImport({
      ...validWorkspace,
      postHistory: [
        {
          id: "result-sparse",
          title: "Publicação real",
          channel: "Instagram",
          format: "Reel",
          publishedAt: "2026-08-29T12:30",
          editorialItemId: "ed-1",
          evidenceSource: "https://example.test/post",
        },
      ],
    });

    expect(parsed.postHistory?.[0]).toMatchObject({
      id: "result-sparse",
      editorialItemId: "ed-1",
    });
    expect(parsed.postHistory?.[0].metrics).toBeUndefined();
    expect(parsed.postHistory?.[0].performanceScore).toBeUndefined();
  });

  test("rejects malformed tasks instead of contaminating persisted state", () => {
    expect(() =>
      parseWorkspaceImport({
        ...validWorkspace,
        tasks: [{ id: "broken", title: 123 }],
      })
    ).toThrow();
  });

  test("rejects a structurally unrelated JSON file", () => {
    expect(() => parseWorkspaceImport({ hello: "world" })).toThrow();
  });
});
