import { describe, expect, test } from "bun:test";
import type { MarketingTask } from "../src/types";
import {
  dateForRoutineDay,
  isReminderDue,
  localDateKey,
  mergeByPath,
  reminderEventKey,
  stableRoutineTaskId,
  upsertItemsById,
  upsertManagedSection,
} from "../src/utils/reliability";

function task(overrides: Partial<MarketingTask> = {}): MarketingTask {
  return {
    id: "task-1",
    title: "Publicar conteúdo",
    priority: "high",
    status: "todo",
    dueDate: "2026-08-26",
    reminderDate: "2026-08-26",
    reminderTime: "09:00",
    obsidianTaskString: "- [ ] Publicar conteúdo",
    tags: ["marketing"],
    isReminderActive: true,
    ...overrides,
  };
}

describe("reliability utilities", () => {
  test("uses local calendar date without UTC conversion", () => {
    expect(localDateKey(new Date(2026, 7, 26, 23, 59, 0))).toBe("2026-08-26");
  });

  test("maps the routine week using the actual DailyRoutineSlot day names", () => {
    const anchor = new Date(2026, 7, 26, 12, 0, 0);
    expect(dateForRoutineDay("Segunda", anchor)).toBe("2026-08-24");
    expect(dateForRoutineDay("Terça", anchor)).toBe("2026-08-25");
    expect(dateForRoutineDay("Quarta", anchor)).toBe("2026-08-26");
    expect(dateForRoutineDay("Domingo", anchor)).toBe("2026-08-30");
  });

  test("upserts a managed Markdown section instead of duplicating it", () => {
    const initial = upsertManagedSection("# Daily", "tasks", "Tarefas", "- [ ] A");
    const updated = upsertManagedSection(initial, "tasks", "Tarefas", "- [ ] B");

    expect(updated).toContain("- [ ] B");
    expect(updated).not.toContain("- [ ] A");
    expect(updated.match(/nisti:start:tasks/g)?.length).toBe(1);
    expect(updated.match(/nisti:end:tasks/g)?.length).toBe(1);
  });

  test("creates stable routine IDs and refreshes metadata without resetting completion", () => {
    const anchor = new Date(2026, 7, 26, 12, 0, 0);
    const id = stableRoutineTaskId(anchor, "slot-segunda");
    const first = task({
      id,
      title: "Primeira versão",
      status: "done",
      completedAt: "2026-08-26T10:00:00.000Z",
    });
    const second = task({
      id,
      title: "Versão atualizada",
      status: "todo",
      dueTime: "15:30",
    });

    const result = upsertItemsById([first], [second]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Versão atualizada");
    expect(result[0].dueTime).toBe("15:30");
    expect(result[0].status).toBe("done");
    expect(result[0].completedAt).toBe("2026-08-26T10:00:00.000Z");
  });

  test("fires a reminder only inside the grace window and exposes a stable event key", () => {
    const reminderTask = task();
    expect(reminderEventKey(reminderTask)).toBe("task-1|2026-08-26|09:00");
    expect(isReminderDue(reminderTask, new Date(2026, 7, 26, 9, 3, 0))).toBe(true);
    expect(isReminderDue(reminderTask, new Date(2026, 7, 26, 9, 6, 0))).toBe(false);
    expect(isReminderDue(task({ status: "done" }), new Date(2026, 7, 26, 9, 1, 0))).toBe(false);
  });

  test("merges incoming vault notes by path without deleting local-only notes", () => {
    const local = [
      { path: "00_Inbox/A.md", value: "old" },
      { path: "00_Inbox/Local.md", value: "local" },
    ];
    const incoming = [{ path: "00_Inbox/A.md", value: "new" }];
    const merged = mergeByPath(local, incoming);

    expect(merged).toEqual([
      { path: "00_Inbox/A.md", value: "new" },
      { path: "00_Inbox/Local.md", value: "local" },
    ]);
  });
});
