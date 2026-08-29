import { beforeEach, describe, expect, test } from "bun:test";
import { APP_STATE_KEYS, StorageManager } from "../src/services/storage/StorageManager";
import {
  prepareWorkspaceBackup,
  restoreWorkspaceBackupText,
} from "../src/services/workspaceBackupService";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.has(key) ? this.values.get(key)! : null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

const config = {
  endpoint: "https://127.0.0.1:27124",
  apiKey: "obsidian-secret",
  geminiApiKey: "gemini-secret",
  openaiApiKey: "openai-secret",
  aiProvider: "openai" as const,
  aiModel: "gpt-test",
  vaultName: "MarketingVault",
  useHttps: true,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "connected" as const,
  allowSelfSignedCerts: true,
};

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
  status: "draft",
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
  priority: "medium",
  status: "todo",
  dueDate: "",
  obsidianTaskString: "- [ ] Tarefa",
  tags: [],
  isReminderActive: false,
};

describe("workspace backup runtime service", () => {
  beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
    delete (globalThis as any).window;
  });

  test("exports the persisted workspace without credentials", async () => {
    const storage = StorageManager.getInstance();
    storage.saveAppState(APP_STATE_KEYS.NOTES, [note]);
    storage.saveAppState(APP_STATE_KEYS.CAMPAIGNS, [campaign]);
    storage.saveAppState(APP_STATE_KEYS.TASKS, [task]);
    storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, []);
    storage.saveAppState(APP_STATE_KEYS.IDEAS, []);
    storage.saveAppState(APP_STATE_KEYS.SCRIPTS, []);
    storage.saveAppState(APP_STATE_KEYS.VISUALS, []);
    storage.saveAppState(APP_STATE_KEYS.EMOTIONAL_DRIVERS, []);
    storage.saveAppState(APP_STATE_KEYS.NICHES, []);
    storage.saveAppState(APP_STATE_KEYS.POST_HISTORY, []);
    storage.saveAppState(APP_STATE_KEYS.LEARNINGS, []);
    storage.saveAppState(APP_STATE_KEYS.WEEKLY_ROUTINE, []);
    storage.saveTextState(APP_STATE_KEYS.ENGINE_MODE, "local");

    const backup = await prepareWorkspaceBackup(config);
    const parsed = JSON.parse(backup.jsonString);

    expect(parsed.formatVersion).toBe(2);
    expect(parsed.notes[0].id).toBe("note-1");
    expect(parsed.campaigns[0].id).toBe("camp-1");
    expect(parsed.tasks[0].id).toBe("task-1");
    expect(parsed.editorialItems).toEqual([]);
    expect(parsed.apiConfig.connectionStatus).toBe("disconnected");
    expect(backup.jsonString).not.toContain("obsidian-secret");
    expect(backup.jsonString).not.toContain("gemini-secret");
    expect(backup.jsonString).not.toContain("openai-secret");
  });

  test("legacy import does not erase collections absent from the old backup", async () => {
    const storage = StorageManager.getInstance();
    storage.saveAppState(APP_STATE_KEYS.IDEAS, [{ id: "keep-me" }]);

    await restoreWorkspaceBackupText(JSON.stringify({
      version: "2.1.7",
      notes: [note],
      campaigns: [campaign],
      tasks: [task],
    }), config);

    expect(storage.loadAppState(APP_STATE_KEYS.IDEAS, [])).toEqual([{ id: "keep-me" }]);
    expect(storage.loadAppState(APP_STATE_KEYS.NOTES, [])[0]?.id).toBe("note-1");
  });

  test("restored non-secret configuration preserves existing credentials and disconnects runtime", async () => {
    const storage = StorageManager.getInstance();
    const result = await restoreWorkspaceBackupText(JSON.stringify({
      formatVersion: 2,
      version: "2.1.11",
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
      editorialItems: [],
      apiConfig: {
        endpoint: "https://localhost:9999",
        vaultName: "RestoredVault",
        connectionStatus: "connected",
        aiProvider: "gemini",
      },
    }), config);

    expect(result.restoredApiConfig?.endpoint).toBe("https://localhost:9999");
    expect(result.restoredApiConfig?.vaultName).toBe("RestoredVault");
    expect(result.restoredApiConfig?.connectionStatus).toBe("disconnected");
    expect(result.restoredApiConfig?.apiKey).toBe("obsidian-secret");
    expect(result.restoredApiConfig?.geminiApiKey).toBe("gemini-secret");
    expect(result.restoredApiConfig?.openaiApiKey).toBe("openai-secret");

    const persistedConfig = localStorage.getItem("nisti_pkm_api_config_secure_v2") || "";
    expect(persistedConfig).not.toContain("obsidian-secret");
    expect(persistedConfig).not.toContain("gemini-secret");
    expect(persistedConfig).not.toContain("openai-secret");
  });
});
