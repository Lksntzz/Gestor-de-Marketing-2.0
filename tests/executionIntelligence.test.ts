import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { MarketingTask } from "../src/types";
import {
  buildExecutionSnapshot,
  classifyTask,
  formatTaskDueLabel,
  isReminderDue,
  localDateKey,
  moveTaskToNextDay,
} from "../src/utils/executionIntelligence";

function task(overrides: Partial<MarketingTask>): MarketingTask {
  return {
    id: overrides.id || "task",
    title: overrides.title || "Tarefa",
    description: overrides.description,
    channel: overrides.channel,
    priority: overrides.priority || "medium",
    status: overrides.status || "todo",
    dueDate: overrides.dueDate ?? "",
    dueTime: overrides.dueTime,
    reminderDate: overrides.reminderDate,
    reminderTime: overrides.reminderTime,
    obsidianTaskString: overrides.obsidianTaskString || "- [ ] Tarefa",
    obsidianFilePath: overrides.obsidianFilePath,
    linkedCampaignId: overrides.linkedCampaignId,
    tags: overrides.tags || [],
    isReminderActive: overrides.isReminderActive || false,
    completedAt: overrides.completedAt,
  };
}

describe("execution intelligence v2 etapa 5", () => {
  const now = new Date(2026, 7, 27, 10, 43, 0);

  test("prioriza vencida, hoje, em andamento, futura e sem prazo sem usar ordem de entrada", () => {
    const items = [
      task({ id: "future", title: "Futura", priority: "urgent", dueDate: "2026-08-30" }),
      task({ id: "unscheduled", title: "Sem prazo", priority: "urgent", dueDate: "" }),
      task({ id: "progress", title: "Em andamento", status: "in-progress", dueDate: "2026-08-29" }),
      task({ id: "today", title: "Hoje", priority: "low", dueDate: "2026-08-27" }),
      task({ id: "late", title: "Vencida", priority: "low", dueDate: "2026-08-26" }),
    ];

    const snapshot = buildExecutionSnapshot(items, now);
    expect(snapshot.nextAction?.id).toBe("late");
    expect(snapshot.overdue.map((item) => item.id)).toEqual(["late"]);
    expect(snapshot.dueToday.map((item) => item.id)).toEqual(["today"]);
  });

  test("datas são calculadas pela data local e não por datas fixas do protótipo", () => {
    expect(localDateKey(now)).toBe("2026-08-27");
    expect(classifyTask(task({ dueDate: "2026-08-26" }), "2026-08-27")).toBe("overdue");
    expect(formatTaskDueLabel(task({ dueDate: "2026-08-27", dueTime: "14:00" }), now)).toBe("Hoje, 14:00");
    expect(formatTaskDueLabel(task({ dueDate: "2026-08-28" }), now)).toBe("Amanhã");
  });

  test("lembrete só fica vencido quando foi realmente configurado", () => {
    expect(isReminderDue(task({ isReminderActive: false, reminderDate: "2026-08-27", reminderTime: "09:00" }), now)).toBe(false);
    expect(isReminderDue(task({ isReminderActive: true, reminderDate: "2026-08-27", reminderTime: "09:00" }), now)).toBe(true);
    expect(isReminderDue(task({ isReminderActive: true, reminderDate: "2026-08-27", reminderTime: "11:00" }), now)).toBe(false);
  });

  test("adiar é ação explícita e preserva horário, prioridade e lembrete associado", () => {
    const original = task({
      title: "Revisar pauta",
      priority: "high",
      dueDate: "2026-08-27",
      dueTime: "16:00",
      reminderDate: "2026-08-27",
      reminderTime: "15:00",
      isReminderActive: true,
      tags: ["conteudo"],
    });
    const moved = moveTaskToNextDay(original, now);
    expect(moved.dueDate).toBe("2026-08-28");
    expect(moved.dueTime).toBe("16:00");
    expect(moved.reminderDate).toBe("2026-08-28");
    expect(moved.reminderTime).toBe("15:00");
    expect(moved.priority).toBe("high");
    expect(moved.obsidianTaskString).toContain("📅 2026-08-28");
  });

  test("UI principal de execução é uma lista focada e não depende do Obsidian para criar tarefa", async () => {
    const execution = await readFile(new URL("../src/components/ExecutionTasksView.tsx", import.meta.url), "utf8");
    const modal = await readFile(new URL("../src/components/TaskModal.tsx", import.meta.url), "utf8");
    const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
    const navbar = await readFile(new URL("../src/components/Navbar.tsx", import.meta.url), "utf8");

    expect(execution).not.toContain("2026-08-26");
    expect(execution).not.toContain("2026-08-27");
    expect(execution).not.toContain("nisti_pkm_quick_notes");
    expect(execution).not.toContain("Sincronizado com Obsidian Tasks");
    expect(execution).not.toContain("Gerador de Subtarefas por Campanha");
    expect(execution).not.toContain("Kanban");
    expect(execution).not.toContain("Automações");
    expect(execution).toContain("Nova tarefa");
    expect(execution).not.toContain("disabled={!isConnected}");
    expect(execution).toContain("Tarefas continuam disponíveis mesmo quando a Base está desconectada");

    expect(main).toContain("ObsidianRuntimeGate");
    expect(main).not.toContain('className="fixed inset-0');
    expect(main).toContain("Local-only work");

    expect(navbar).not.toContain("Conectar base");
    expect(navbar).toContain('handleTabClick("tasks")');
    expect(navbar).toContain("Abrir Execução — funciona sem Base");
    expect(navbar).toContain("Requer Base conectada");

    expect(modal).toContain('useState<TaskPriority | "">("")');
    expect(modal).toContain("useState(false)");
    expect(modal).not.toContain("LinkedIn");
    expect(modal).not.toContain("11:30");
    expect(modal).not.toContain("Daily Notes/2026-");
    expect(modal).not.toContain("marketing, automacao");
  });
});
