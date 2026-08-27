import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { AutomationRule, MarketingTask } from "../src/types";
import {
  buildStatusReportMarkdown,
  buildTaskAutomationMarkdown,
  evaluateAutomationRule,
  filterTasksForAutomation,
  parseAutomationParams,
} from "../src/utils/automationIntelligence";

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const baseRule: AutomationRule = {
  id: "rule-1",
  name: "Sincronizar tarefas",
  description: "Sincroniza tarefas pendentes na Daily Note.",
  trigger: "daily_schedule",
  conditionParam: "time=09:30;priority=high",
  action: "create_tasks_in_daily_note",
  enabled: true,
  executionCount: 0,
};

describe("automações auditáveis v2 etapa 7", () => {
  test("interpreta parâmetros explícitos sem inferir valores", () => {
    expect(parseAutomationParams("time=09:30;priority=high;path=08_Aprendizados/Status.md")).toEqual({
      time: "09:30",
      priority: "high",
      path: "08_Aprendizados/Status.md",
    });
  });

  test("regra diária só fica pronta com horário válido", () => {
    expect(evaluateAutomationRule(baseRule).ready).toBe(true);
    const invalid = { ...baseRule, conditionParam: "priority=high" };
    const readiness = evaluateAutomationRule(invalid);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toContain("time=HH:MM");
  });

  test("ações sem executor seguro ficam bloqueadas", () => {
    const rule: AutomationRule = { ...baseRule, action: "schedule_reminders" };
    const readiness = evaluateAutomationRule(rule);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toContain("executor seguro");
  });

  test("relatório exige caminho explícito", () => {
    const rule: AutomationRule = { ...baseRule, action: "generate_status_report", conditionParam: "time=10:00" };
    expect(evaluateAutomationRule(rule).ready).toBe(false);
    expect(evaluateAutomationRule(rule).blockers.join(" ")).toContain("path=");
  });

  test("filtro usa somente tarefas pendentes e prioridade registrada", () => {
    const tasks: MarketingTask[] = [
      { id: "a", title: "Alta", priority: "high", status: "todo", dueDate: "", obsidianTaskString: "- [ ] Alta", tags: [], isReminderActive: false },
      { id: "b", title: "Baixa", priority: "low", status: "todo", dueDate: "", obsidianTaskString: "- [ ] Baixa", tags: [], isReminderActive: false },
      { id: "c", title: "Feita", priority: "high", status: "done", dueDate: "", obsidianTaskString: "- [x] Feita", tags: [], isReminderActive: false },
    ];
    expect(filterTasksForAutomation(tasks, "high").map((task) => task.id)).toEqual(["a"]);
    expect(buildTaskAutomationMarkdown(filterTasksForAutomation(tasks, "high"))).toBe("- [ ] Alta");
  });

  test("relatório operacional contém somente contagens do estado real", () => {
    const tasks: MarketingTask[] = [
      { id: "a", title: "Urgente", priority: "urgent", status: "todo", dueDate: "", obsidianTaskString: "- [ ] Urgente", tags: [], isReminderActive: false },
      { id: "b", title: "Feita", priority: "low", status: "done", dueDate: "", obsidianTaskString: "- [x] Feita", tags: [], isReminderActive: false },
    ];
    const report = buildStatusReportMarkdown(tasks, new Date("2026-08-27T12:00:00.000Z"));
    expect(report).toContain("Pendentes: 1");
    expect(report).toContain("Concluídas: 1");
    expect(report).toContain("Urgentes pendentes: 1");
    expect(report).not.toContain("CTR");
    expect(report).not.toContain("conversão");
  });

  test("tela não contém templates fictícios nem contadores inventados", async () => {
    const source = await read("src/components/TasksAutomationView.tsx");
    expect(source).not.toContain("executionCount: 12 + idx * 5");
    expect(source).not.toContain("Gerador de Subtarefas por Campanha");
    expect(source).not.toContain("Auditoria e Indexação Contínua");
    expect(source).not.toContain("Sincronizado com Obsidian Tasks");
    expect(source).toContain("Criar pausada");
    expect(source).toContain("Execuções confirmadas");
  });

  test("runtime só incrementa contador após sucesso", async () => {
    const source = await read("src/services/automationRuntime.ts");
    const successIndex = source.indexOf("updateRuleAfterSuccess");
    const writeIndex = source.indexOf("api.upsertDailyNoteSection");
    expect(writeIndex).toBeGreaterThan(-1);
    expect(successIndex).toBeGreaterThan(-1);
    expect(source).toContain("if (!result?.success)");
    expect(source).toContain("Obsidian não está validado");
  });
});
