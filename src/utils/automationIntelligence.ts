import type { AutomationRule, MarketingTask, ObsidianNote } from "../types";

export type AutomationBlueprintId =
  | "rule_daily_sync"
  | "rule_vault_audit"
  | "rule_push_note";

export interface AutomationBlueprint {
  id: AutomationBlueprintId;
  name: string;
  description: string;
  trigger: AutomationRule["trigger"];
  action: AutomationRule["action"];
  requiresObsidian: boolean;
  requiresNotePath: boolean;
  runtimeNotice: string;
}

export interface AutomationValidationContext {
  isConnected: boolean;
  tasks: MarketingTask[];
  notes: ObsidianNote[];
}

export interface AutomationValidation {
  supported: boolean;
  configured: boolean;
  runnable: boolean;
  reasons: string[];
  requiresObsidian: boolean;
}

export interface AutomationExecutionAdapter {
  syncPendingTasks: (markdown: string) => Promise<{ success: boolean; message?: string }>;
  pushNote: (note: ObsidianNote) => Promise<{ success: boolean; message?: string }>;
  logAudit: (details: string) => Promise<void>;
}

export interface AutomationExecutionResult {
  success: boolean;
  message: string;
  details?: string;
}

export const AUTOMATION_BLUEPRINTS: AutomationBlueprint[] = [
  {
    id: "rule_daily_sync",
    name: "Sincronizar tarefas pendentes na Daily Note",
    description:
      "Reconcilia apenas tarefas já registradas na seção gerenciada da Daily Note. Não cria prazo, prioridade, lembrete ou tarefa por inferência.",
    trigger: "daily_schedule",
    action: "create_tasks_in_daily_note",
    requiresObsidian: true,
    requiresNotePath: false,
    runtimeNotice: "Execução manual nesta versão; não roda em segundo plano.",
  },
  {
    id: "rule_vault_audit",
    name: "Relatório de triagem do Inbox",
    description:
      "Conta fontes pendentes em 00_Inbox e registra o resultado no log de auditoria. Não cria tarefas, datas ou prioridades automaticamente.",
    trigger: "on_note_tagged",
    action: "generate_status_report",
    requiresObsidian: true,
    requiresNotePath: false,
    runtimeNotice: "Execução manual nesta versão; o Vault é relido antes da análise.",
  },
  {
    id: "rule_push_note",
    name: "Enviar nota existente ao Obsidian",
    description:
      "Regrava uma nota já existente no snapshot validado. Exige que o caminho seja escolhido explicitamente e nunca cria conteúdo novo.",
    trigger: "on_note_tagged",
    action: "push_to_obsidian_api",
    requiresObsidian: true,
    requiresNotePath: true,
    runtimeNotice: "Execução manual nesta versão; exige caminho de nota explícito.",
  },
];

export function findAutomationBlueprint(rule: AutomationRule): AutomationBlueprint | null {
  return (
    AUTOMATION_BLUEPRINTS.find(
      (blueprint) =>
        blueprint.id === rule.id &&
        blueprint.action === rule.action &&
        blueprint.trigger === rule.trigger
    ) || null
  );
}

export function createAutomationRuleFromBlueprint(id: AutomationBlueprintId): AutomationRule {
  const blueprint = AUTOMATION_BLUEPRINTS.find((item) => item.id === id);
  if (!blueprint) throw new Error(`Blueprint de automação não encontrado: ${id}`);

  return {
    id: blueprint.id,
    name: blueprint.name,
    description: blueprint.description,
    trigger: blueprint.trigger,
    action: blueprint.action,
    conditionParam: blueprint.requiresNotePath ? "" : undefined,
    enabled: false,
    executionCount: 0,
  };
}

export function automationTriggerLabel(trigger: AutomationRule["trigger"]): string {
  const labels: Record<AutomationRule["trigger"], string> = {
    on_campaign_created: "Ao criar campanha",
    daily_schedule: "Agendamento diário (intenção)",
    on_note_tagged: "Evento de nota (intenção)",
    reminder_triggered: "Disparo de lembrete (intenção)",
  };
  return labels[trigger];
}

export function automationActionLabel(action: AutomationRule["action"]): string {
  const labels: Record<AutomationRule["action"], string> = {
    create_tasks_in_daily_note: "Reconciliar tarefas na Daily Note",
    schedule_reminders: "Agendar lembretes",
    push_to_obsidian_api: "Enviar nota existente ao Obsidian",
    generate_status_report: "Gerar relatório de status",
  };
  return labels[action];
}

export function noteNeedsReview(note: ObsidianNote): boolean {
  const editorial = String(note.frontmatter?.status || "").toUpperCase();
  const epistemic = String(note.frontmatter?.epistemic_status || "").toUpperCase();
  if (editorial === "OFICIAL" && (!epistemic || epistemic === "CONFIRMADO")) return false;
  return true;
}

export function pendingInboxNotes(notes: ObsidianNote[]): ObsidianNote[] {
  return notes.filter((note) => note.folder === "00_Inbox" && noteNeedsReview(note));
}

export function validateAutomationRule(
  rule: AutomationRule,
  context: AutomationValidationContext
): AutomationValidation {
  const reasons: string[] = [];
  const blueprint = findAutomationBlueprint(rule);
  const supported = Boolean(blueprint);

  if (!supported) {
    reasons.push("Regra legada ou ação não suportada pelo runtime seguro da versão 2.0.");
  }

  const requiresObsidian = blueprint?.requiresObsidian ?? true;
  if (requiresObsidian && !context.isConnected) {
    reasons.push("Obsidian não está validado neste runtime.");
  }

  if (rule.action === "create_tasks_in_daily_note") {
    const pending = context.tasks.filter((task) => task.status !== "done" && task.obsidianTaskString.trim());
    if (pending.length === 0) reasons.push("Nenhuma tarefa pendente com Markdown explícito para sincronizar.");
  }

  if (rule.action === "push_to_obsidian_api") {
    const path = String(rule.conditionParam || "").trim();
    if (!path) {
      reasons.push("Selecione explicitamente a nota que poderá ser enviada.");
    } else if (!context.notes.some((note) => note.path === path)) {
      reasons.push("A nota configurada não existe no snapshot validado atual.");
    }
  }

  if (rule.action === "schedule_reminders") {
    reasons.push("Agendamento automático de lembretes ainda não possui executor seguro nesta versão.");
  }

  const configured = supported && reasons.every((reason) => !reason.includes("Selecione explicitamente") && !reason.includes("não existe no snapshot") && !reason.includes("não possui executor"));
  const runnable = Boolean(rule.enabled && supported && reasons.length === 0);

  return {
    supported,
    configured,
    runnable,
    reasons,
    requiresObsidian,
  };
}

export async function executeAutomationRule(
  rule: AutomationRule,
  context: AutomationValidationContext,
  adapter: AutomationExecutionAdapter
): Promise<AutomationExecutionResult> {
  const validation = validateAutomationRule(rule, context);
  if (!rule.enabled) {
    return { success: false, message: "A regra está inativa. Ative-a explicitamente antes de executar." };
  }
  if (!validation.runnable) {
    return {
      success: false,
      message: validation.reasons[0] || "A regra não está pronta para execução segura.",
    };
  }

  if (rule.action === "create_tasks_in_daily_note") {
    const pending = context.tasks.filter((task) => task.status !== "done" && task.obsidianTaskString.trim());
    const markdown = pending.map((task) => task.obsidianTaskString.trim()).join("\n");
    const result = await adapter.syncPendingTasks(markdown);
    if (!result.success) {
      return { success: false, message: result.message || "O Obsidian não confirmou a gravação da Daily Note." };
    }
    const details = `${pending.length} tarefa(s) pendente(s) reconciliada(s) na Daily Note sem completar campos ausentes.`;
    await adapter.logAudit(details);
    return { success: true, message: details, details };
  }

  if (rule.action === "generate_status_report") {
    const pending = pendingInboxNotes(context.notes);
    const details = pending.length
      ? `${pending.length} fonte(s) em 00_Inbox aguardam revisão humana: ${pending.map((note) => note.title).join(", ")}.`
      : "Nenhuma fonte pendente foi encontrada em 00_Inbox no snapshot validado.";
    await adapter.logAudit(details);
    return { success: true, message: details, details };
  }

  if (rule.action === "push_to_obsidian_api") {
    const path = String(rule.conditionParam || "").trim();
    const note = context.notes.find((item) => item.path === path);
    if (!note) {
      return { success: false, message: "A nota configurada deixou de existir no snapshot validado." };
    }
    const result = await adapter.pushNote(note);
    if (!result.success) {
      return { success: false, message: result.message || "O Obsidian não confirmou a gravação da nota." };
    }
    const details = `Nota existente confirmada no Obsidian: ${note.path}.`;
    await adapter.logAudit(details);
    return { success: true, message: details, details };
  }

  return {
    success: false,
    message: "A ação configurada não possui executor seguro na versão 2.0.",
  };
}

export function formatAutomationLastRun(value?: string): string {
  if (!value) return "Nunca executada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
