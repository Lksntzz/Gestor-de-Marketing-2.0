import { describe, expect, test } from "bun:test";
import { parseWorkspaceBackupText, serializeWorkspaceBackup } from "../src/domain/workspaceProtection";

const note = {
  id: "note-1",
  path: "00_Inbox/Teste.md",
  title: "Teste",
  folder: "00_Inbox",
  content: "# Teste",
  frontmatter: { status: "OFICIAL" },
  tags: [],
  wikilinks: [],
  lastModified: "2026-08-28 10:00",
};

const campaign = {
  id: "camp-1",
  title: "Campanha",
  objective: "Objetivo",
  targetAudience: "Público",
  tone: "Tom",
  status: "draft" as const,
  channels: [],
  channelsContent: [],
  linkedNotePaths: [],
  summary: "",
  strategy: "",
  startDate: "",
  endDate: "",
  createdDate: "2026-08-28",
};

const task = {
  id: "task-1",
  title: "Tarefa",
  priority: "medium" as const,
  status: "todo" as const,
  dueDate: "",
  obsidianTaskString: "- [ ] Tarefa",
  tags: [],
  isReminderActive: false,
};

describe("workspace protection round trip", () => {
  test("serializes and restores all protected collections without credentials", () => {
    const json = serializeWorkspaceBackup({
      version: "2.1.11",
      exportedAt: "2026-08-28T21:00:00.000Z",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
      automationRules: [],
      ideas: [],
      scripts: [],
      visuals: [],
      emotionalDrivers: [],
      niches: [],
      postHistory: [],
      learnings: [],
      weeklyRoutine: [],
      engineMode: "local",
      editorialItems: [{
        id: "ed-1",
        title: "Item",
        contentType: "Post",
        platform: "Instagram",
        objective: "Teste",
        scheduledDate: "2026-09-01",
        status: "DRAFT",
        priority: "medium",
        createdAt: 10,
        updatedAt: 11,
      }],
      apiConfig: {
        endpoint: "https://127.0.0.1:27124",
        vaultName: "Vault",
        connectionStatus: "connected",
        apiKey: "secret",
        openaiApiKey: "secret-2",
      },
    });

    expect(json).not.toContain("secret");

    const restored = parseWorkspaceBackupText(json);
    expect(restored.formatVersion).toBe(2);
    expect(restored.notes[0]?.id).toBe("note-1");
    expect(restored.editorialItems?.[0]?.id).toBe("ed-1");
    expect(restored.engineMode).toBe("local");
    expect(restored.apiConfig?.connectionStatus).toBe("disconnected");
  });

  test("legacy restore plan keeps absent collections undefined", () => {
    const restored = parseWorkspaceBackupText(JSON.stringify({
      version: "2.1.7",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
    }));

    expect(restored.weeklyRoutine).toBeUndefined();
    expect(restored.automationRules).toBeUndefined();
    expect(restored.editorialItems).toBeUndefined();
  });
});
