import type { AutomationRule, MarketingTask, ObsidianApiConfig } from "../types";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { api } from "./api";
import { APP_STATE_KEYS, StorageManager } from "./storage/StorageManager";
import {
  buildStatusReportMarkdown,
  buildTaskAutomationMarkdown,
  evaluateAutomationRule,
  filterTasksForAutomation,
} from "../utils/automationIntelligence";

const storage = StorageManager.getInstance();
const AUTOMATION_EVENT = "nisti:automation-rules-changed";
let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

const DEFAULT_CONFIG: ObsidianApiConfig = {
  endpoint: "http://127.0.0.1:27124",
  apiKey: "",
  geminiApiKey: "",
  vaultName: "MarketingVault",
  useHttps: false,
  autoSync: true,
  syncIntervalSeconds: 60,
  connectionStatus: "disconnected",
  allowSelfSignedCerts: true,
};

export interface AutomationExecutionResult {
  success: boolean;
  message: string;
}

function persistRules(rules: AutomationRule[]): void {
  storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, rules);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTOMATION_EVENT, { detail: rules }));
  }
}

function updateRuleAfterSuccess(ruleId: string, executedAt: string): void {
  const rules = storage.loadAppState<AutomationRule[]>(
    APP_STATE_KEYS.AUTOMATION_RULES,
    [],
    AppStateSchemas.automationRules
  );
  persistRules(
    rules.map((rule) =>
      rule.id === ruleId
        ? { ...rule, lastRun: executedAt, executionCount: rule.executionCount + 1 }
        : rule
    )
  );
}

export async function executeAutomationRule(
  rule: AutomationRule,
  tasks: MarketingTask[],
  config: ObsidianApiConfig
): Promise<AutomationExecutionResult> {
  if (!rule.enabled) return { success: false, message: "A regra está pausada." };

  const readiness = evaluateAutomationRule(rule);
  const manualOnlyBlockers = readiness.blockers.filter(
    (blocker) => !blocker.includes("runner automático auditado") && !blocker.includes("Gatilho diário exige")
  );
  if (manualOnlyBlockers.length > 0) {
    return { success: false, message: manualOnlyBlockers.join(" ") };
  }

  if (config.connectionStatus !== "connected" || !api.isObsidianSessionVerified()) {
    return { success: false, message: "Obsidian não está validado. A automação foi bloqueada sem alterar dados." };
  }

  const selectedTasks = filterTasksForAutomation(tasks, readiness.params.priority);
  const executedAt = new Date().toISOString();

  try {
    if (rule.action === "create_tasks_in_daily_note") {
      const result = await api.upsertDailyNoteSection(
        config,
        `automation-${rule.id}`,
        `Automação: ${rule.name}`,
        buildTaskAutomationMarkdown(selectedTasks)
      );
      if (!result?.success) {
        return { success: false, message: result?.message || "O Obsidian não confirmou a gravação." };
      }
    } else if (rule.action === "generate_status_report") {
      const targetPath = readiness.params.path;
      if (!targetPath) return { success: false, message: "Caminho do relatório não configurado." };
      const result = await api.pushNoteToObsidian(config, targetPath, buildStatusReportMarkdown(tasks));
      if (!result?.success) {
        return { success: false, message: result?.message || "O Obsidian não confirmou o relatório." };
      }
    } else {
      return { success: false, message: "Ação sem executor seguro. Nenhuma alteração foi realizada." };
    }

    updateRuleAfterSuccess(rule.id, executedAt);
    await storage.logAudit({
      action: "AUTOMATION_TRIGGERED",
      entityType: "AUTOMATION",
      entityId: rule.id,
      details: `Regra '${rule.name}' executada com sucesso. Ação: ${rule.action}.`,
    });
    return { success: true, message: "Execução confirmada pelo Obsidian e registrada na auditoria." };
  } catch (error: any) {
    return { success: false, message: error?.message || "Falha ao executar a automação." };
  }
}

function ranToday(rule: AutomationRule, now: Date): boolean {
  const lastRun = String(rule.lastRun || "");
  if (!lastRun) return false;
  return lastRun.slice(0, 10) === now.toISOString().slice(0, 10);
}

async function automationTick(): Promise<void> {
  if (tickInFlight || typeof window === "undefined") return;
  tickInFlight = true;
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const rules = storage.loadAppState<AutomationRule[]>(
      APP_STATE_KEYS.AUTOMATION_RULES,
      [],
      AppStateSchemas.automationRules
    );
    const tasks = storage.loadAppState<MarketingTask[]>(APP_STATE_KEYS.TASKS, [], AppStateSchemas.tasks);
    const config = await storage.loadApiConfig(DEFAULT_CONFIG);

    for (const rule of rules) {
      if (!rule.enabled || rule.trigger !== "daily_schedule" || ranToday(rule, now)) continue;
      const readiness = evaluateAutomationRule(rule);
      if (!readiness.ready || readiness.params.time !== currentTime) continue;
      await executeAutomationRule(rule, tasks, config);
    }
  } finally {
    tickInFlight = false;
  }
}

export function startAutomationRuntime(): void {
  if (typeof window === "undefined" || timer) return;
  timer = setInterval(() => void automationTick(), 30_000);
  window.setTimeout(() => void automationTick(), 2_000);
}

export function stopAutomationRuntime(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export { AUTOMATION_EVENT };
