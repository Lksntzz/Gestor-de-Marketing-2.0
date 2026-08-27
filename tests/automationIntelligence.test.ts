import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import type { AutomationRule, MarketingTask, ObsidianNote } from "../src/types";
import {
  createAutomationRuleFromBlueprint,
  executeAutomationRule,
  isDailyRuleDue,
  parseDailyScheduleTime,
  pendingInboxNotes,
  validateAutomationRule,
} from "../src/utils/automationIntelligence";

const pendingTask: MarketingTask = {
  id: "task-real",
  title: "Revisar material aprovado",
  priority: "high",
  status: "todo",
  dueDate: "",
  obsidianTaskString: "- [ ] Revisar material aprovado #revisao",
  tags: ["revisao"],
  isReminderActive: false,
};

const confirmedNote: ObsidianNote = {
  id: "note-confirmed",
  path: "01_Estrategia/Posicionamento.md",
  title: "Posicionamento",
  folder: "01_Estrategia",
  content: "Conteúdo confirmado",
  frontmatter: { status: "OFICIAL", epistemic_status: "CONFIRMADO" },
  tags: [],
  wikilinks: [],
  lastModified: "2026-08-27 10:00",
};

const pendingInbox: ObsidianNote = {
  id: "note-pending",
  path: "00_Inbox/Fonte.md",
  title: "Fonte",
  folder: "00_Inbox",
  content: "Aguardando revisão",
  frontmatter: { status: "EM REVISÃO", epistemic_status: "PENDENTE" },
  tags: [],
  wikilinks: [],
  lastModified: "2026-08-27 10:00",
};

function dailyRule(): AutomationRule {
  return {
    ...createAutomationRuleFromBlueprint("rule_daily_sync"),
    enabled: true,
    conditionParam: "09:30",
  };
}

describe("automações fundamentadas v2 etapa 7", () => {
  test("templates nascem desativados, sem horário inventado e sem execuções fictícias", () => {
    const rule = createAutomationRuleFromBlueprint("rule_daily_sync");
    expect(rule.enabled).toBe(false);
    expect(rule.executionCount).toBe(0);
    expect(rule.lastRun).toBeUndefined();
    expect(rule.conditionParam).toBe("");
  });

  test("horário diário exige formato HH:MM", () => {
    expect(parseDailyScheduleTime("09:30")).toBe("09:30");
    expect(parseDailyScheduleTime("25:00")).toBeNull();
    expect(parseDailyScheduleTime("")).toBeNull();

    const rule = { ...createAutomationRuleFromBlueprint("rule_daily_sync"), enabled: true };
    const validation = validateAutomationRule(rule, {
      isConnected: true,
      tasks: [pendingTask],
      notes: [],
    });
    expect(validation.runnable).toBe(false);
    expect(validation.reasons.join(" ")).toContain("horário diário");
  });

  test("runner considera a regra vencida após o horário e no máximo uma vez por dia local", () => {
    const rule = dailyRule();
    expect(isDailyRuleDue(rule, new Date(2026, 7, 27, 9, 29))).toBe(false);
    expect(isDailyRuleDue(rule, new Date(2026, 7, 27, 9, 30))).toBe(true);
    expect(isDailyRuleDue(rule, new Date(2026, 7, 27, 14, 0))).toBe(true);

    const executed = {
      ...rule,
      lastRun: new Date(2026, 7, 27, 9, 31).toISOString(),
    };
    expect(isDailyRuleDue(executed, new Date(2026, 7, 27, 15, 0))).toBe(false);
    expect(isDailyRuleDue(executed, new Date(2026, 7, 28, 9, 30))).toBe(true);
  });

  test("regra com escrita fica bloqueada sem Obsidian validado", () => {
    const validation = validateAutomationRule(dailyRule(), {
      isConnected: false,
      tasks: [pendingTask],
      notes: [],
    });
    expect(validation.runnable).toBe(false);
    expect(validation.reasons.join(" ")).toContain("Obsidian");
  });

  test("sincronização usa somente Markdown já registrado e só audita após confirmação", async () => {
    let receivedMarkdown = "";
    let auditCount = 0;
    const result = await executeAutomationRule(
      dailyRule(),
      { isConnected: true, tasks: [pendingTask], notes: [] },
      {
        syncPendingTasks: async (markdown) => {
          receivedMarkdown = markdown;
          return { success: true, message: "ok" };
        },
        pushNote: async () => ({ success: false }),
        logAudit: async () => {
          auditCount += 1;
        },
      }
    );
    expect(result.success).toBe(true);
    expect(receivedMarkdown).toBe(pendingTask.obsidianTaskString);
    expect(auditCount).toBe(1);
  });

  test("falha de gravação não registra execução como sucesso", async () => {
    let auditCount = 0;
    const result = await executeAutomationRule(
      dailyRule(),
      { isConnected: true, tasks: [pendingTask], notes: [] },
      {
        syncPendingTasks: async () => ({ success: false, message: "Vault recusou gravação" }),
        pushNote: async () => ({ success: false }),
        logAudit: async () => {
          auditCount += 1;
        },
      }
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Vault recusou");
    expect(auditCount).toBe(0);
  });

  test("envio de nota exige caminho explícito presente no snapshot atual", () => {
    const base = createAutomationRuleFromBlueprint("rule_push_note");
    const missing = validateAutomationRule(
      { ...base, enabled: true },
      { isConnected: true, tasks: [], notes: [confirmedNote] }
    );
    expect(missing.runnable).toBe(false);

    const ready = validateAutomationRule(
      { ...base, enabled: true, conditionParam: confirmedNote.path },
      { isConnected: true, tasks: [], notes: [confirmedNote] }
    );
    expect(ready.runnable).toBe(true);
  });

  test("relatório do Inbox distingue fonte confirmada de fonte pendente", () => {
    expect(pendingInboxNotes([confirmedNote, pendingInbox]).map((note) => note.id)).toEqual([
      "note-pending",
    ]);
  });

  test("regra legada desconhecida é bloqueada", () => {
    const legacy: AutomationRule = {
      id: "legacy-custom",
      name: "Legada",
      description: "Regra antiga",
      trigger: "daily_schedule",
      action: "schedule_reminders",
      enabled: true,
      executionCount: 99,
      conditionParam: "09:00",
    };
    const validation = validateAutomationRule(legacy, {
      isConnected: true,
      tasks: [pendingTask],
      notes: [confirmedNote],
    });
    expect(validation.supported).toBe(false);
    expect(validation.runnable).toBe(false);
  });

  test("UI não chama executores legados e exige configuração explícita do horário", async () => {
    const source = await readFile(
      new URL("../src/components/TasksAutomationView.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toContain("onRunRuleNow(");
    expect(source).not.toContain("onToggleRule(");
    expect(source).not.toContain("12 + idx");
    expect(source).toContain('type="time"');
    expect(source).toContain("Execuções confirmadas");
    expect(source).toContain("Falhas não incrementam o contador");
  });

  test("runtime global mantém fail-closed antes de incrementar contador", async () => {
    const runtime = await readFile(
      new URL("../src/services/automationRuntime.ts", import.meta.url),
      "utf8"
    );
    expect(runtime).toContain("api.isObsidianSessionVerified()");
    expect(runtime).toContain("if (!result.success) return false");
    expect(runtime.indexOf("if (!result.success) return false")).toBeLessThan(
      runtime.lastIndexOf("updateSuccessfulRun(")
    );
    expect(runtime).toContain("setInterval");
  });
});
