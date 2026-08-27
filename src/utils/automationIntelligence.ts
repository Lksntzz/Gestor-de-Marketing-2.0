import type { AutomationRule, MarketingTask } from "../types";

export type SupportedAutomationAction = "create_tasks_in_daily_note" | "generate_status_report";

export interface AutomationRuleParams {
  time?: string;
  path?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface AutomationReadiness {
  ready: boolean;
  blockers: string[];
  params: AutomationRuleParams;
  automaticSupported: boolean;
  requiresObsidian: boolean;
}

const SUPPORTED_ACTIONS = new Set<AutomationRule["action"]>([
  "create_tasks_in_daily_note",
  "generate_status_report",
]);

export function parseAutomationParams(raw?: string): AutomationRuleParams {
  const params: AutomationRuleParams = {};
  String(raw || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, ...rest] = part.split("=");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join("=").trim();
      if (!value) return;
      if (key === "time") params.time = value;
      if (key === "path") params.path = value.replace(/^\/+/, "");
      if (key === "priority" && ["low", "medium", "high", "urgent"].includes(value)) {
        params.priority = value as AutomationRuleParams["priority"];
      }
    });
  return params;
}

export function evaluateAutomationRule(rule: AutomationRule): AutomationReadiness {
  const blockers: string[] = [];
  const params = parseAutomationParams(rule.conditionParam);

  if (!rule.name.trim()) blockers.push("Nome da regra ausente.");
  if (!rule.description.trim()) blockers.push("Descrição da regra ausente.");
  if (!SUPPORTED_ACTIONS.has(rule.action)) blockers.push("Ação ainda não possui executor seguro na versão 2.0.");

  const automaticSupported = rule.trigger === "daily_schedule";
  if (!automaticSupported) {
    blockers.push("Este gatilho ainda não possui runner automático auditado; use apenas execução manual.");
  } else if (!params.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(params.time)) {
    blockers.push("Gatilho diário exige conditionParam com time=HH:MM.");
  }

  if (rule.action === "generate_status_report" && !params.path) {
    blockers.push("Relatório exige conditionParam com path=Pasta/Arquivo.md.");
  }

  return {
    ready: blockers.length === 0,
    blockers,
    params,
    automaticSupported,
    requiresObsidian: true,
  };
}

export function filterTasksForAutomation(tasks: MarketingTask[], priority?: AutomationRuleParams["priority"]): MarketingTask[] {
  return tasks.filter((task) => task.status !== "done" && (!priority || task.priority === priority));
}

export function buildTaskAutomationMarkdown(tasks: MarketingTask[]): string {
  if (tasks.length === 0) return "_Nenhuma tarefa pendente que corresponda à regra._";
  return tasks.map((task) => task.obsidianTaskString || `- [ ] ${task.title}`).join("\n");
}

export function buildStatusReportMarkdown(tasks: MarketingTask[], now = new Date()): string {
  const pending = tasks.filter((task) => task.status !== "done");
  const done = tasks.filter((task) => task.status === "done");
  const urgent = pending.filter((task) => task.priority === "urgent");
  const high = pending.filter((task) => task.priority === "high");
  const timestamp = now.toISOString();

  return [
    "---",
    'tipo: "Relatório Operacional"',
    'status: "EM REVISÃO"',
    'epistemic_status: "CONFIRMADO"',
    'origem: "Automação Nisti Marketing"',
    `updated_at: "${timestamp}"`,
    "---",
    "",
    "# Relatório Operacional",
    "",
    `Gerado em: ${timestamp}`,
    "",
    "## Contagens registradas",
    `- Pendentes: ${pending.length}`,
    `- Concluídas: ${done.length}`,
    `- Urgentes pendentes: ${urgent.length}`,
    `- Alta prioridade pendentes: ${high.length}`,
    "",
    "> Este relatório resume somente o estado persistido das tarefas. Não contém métricas de marketing inferidas.",
  ].join("\n");
}
