import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { KnowledgeIndex } from "../src/services/knowledge/index/KnowledgeIndex";

test("3.1.11: calendário persiste item sem hora opcional usando SQL NULL", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "nisti-calendar-3111-"));
  const index = new KnowledgeIndex(path.join(directory, "knowledge_index.sqlite"));

  try {
    assert.doesNotThrow(() => {
      index.upsertEditorialItem({
        id: "ed-3111",
        title: "Conteúdo sem horário",
        contentType: "Carrossel de 5 slides",
        platform: "Instagram",
        objective: "Educar",
        scheduledDate: "2026-09-05",
        scheduledTime: undefined,
        status: "DRAFT",
        priority: "medium",
        scriptId: "script-3111",
        ideaId: undefined,
        campaignId: undefined,
        obsidianPath: undefined,
        notes: undefined,
        createdAt: 1_000,
        updatedAt: 2_000,
      });
    });

    const [saved] = index.getEditorialItems();
    assert.ok(saved);
    assert.equal(saved.id, "ed-3111");
    assert.equal(saved.scheduled_time, null);
    assert.equal(saved.idea_id, null);
    assert.equal(saved.campaign_id, null);
    assert.equal(saved.obsidian_path, null);
    assert.equal(saved.notes, null);
  } finally {
    index.close();
    await rm(directory, { recursive: true, force: true });
  }
});
