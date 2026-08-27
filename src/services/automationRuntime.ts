import type { AutomationRule, MarketingTask, ObsidianApiConfig } from "../types";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { api } from "./api";
import { APP_STATE_KEYS, StorageManager } from "./storage/StorageManager";
import { executeAutomationRule, isDailyRuleDue } from "../utils/automationIntelligence";

const storage = StorageManager.getInstance();
const PERSISTENT_STATE_EVENT = "nisti:persistent-state-updated";
const APP_STATE_CHANGED_EVENT = "nisti:app-state-changed";
const RUNTIME_SOURCE_ID = "automation-runtime-v2";

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

function publishRules(rules: AutomationRule[]): void {
  storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, rules);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PERSISTENT_STATE_EVENT, {
      detail: {
        key: APP_STATE_KEYS.AUTOMATION_RULES,
        value: rules,
        sourceId: RUNTIME_SOURCE_ID,
      },
    })
  );
  window.dispatchEvent(
    new CustomEvent(APP_STATE_CHANGED_EVENT, {
      detail: { key: APP_STATE_KEYS.AUTOMATION_RULES },
    })
  );
}

function updateSuccessfulRun(ruleId: string, executedAt: string): void {
  const latestRules = storage.loadAppState<AutomationRule[]>(
    APP_STATE_KEYS.AUTOMATION_RULES,
    [],
    AppStateSchemas.automationRules
  );
  publishRules(
    latestRules.map((rule) =>
      rule.id === ruleId
        ? {
            ...rule,
            executionCount: Number(rule.executionCount || 0) + 1,
            lastRun: executedAt,
          }
        : rule
    )
  );
}

async function executeScheduledRule(
  rule: AutomationRule,
  tasks: MarketingTask[],
  config: ObsidianApiConfig
): Promise<boolean> {
  const connected =
    config.connectionStatus === "connected" && api.isObsidianSessionVerified();
  if (!connected) return false;

  const notes = (await storage.readDesktopNotesForApp()) || [];
  const result = await executeAutomationRule(
    rule,
    { isConnected: true, tasks, notes },
    {
      syncPendingTasks: async (markdown) => {
        const response = await api
          .upsertDailyNoteSection(
            config,
            `automation-v2-${rule.id}`,
            `📋 ${rule.name}`,
            markdown
          )
          .catch((error: any) => ({
            success: false,
            message: error?.message || "Falha ao gravar a Daily Note.",
          }));
        return {
          success: Boolean(response?.success),
          message: response?.message,
        };
      },
      pushNote: async (note) => {
        const response = await api
          .pushNoteToObsidian(
            config,
            note.path,
            note.content,
            note.frontmatter as Record<string, unknown>
          )
          .catch((error: any) => ({
            success: false,
            message: error?.message || "Falha ao gravar a nota.",
          }));
        return {
          success: Boolean(response?.success),
          message: response?.message,
        };
      },
      logAudit: async (details) => {
        await storage.logAudit({
          action: "AUTOMATION_TRIGGERED",
          entityType: "AUTOMATION",
          entityId: rule.id,
          details: `[v2 scheduled fail-closed] ${rule.name}: ${details}`,
        });
      },
    }
  );

  if (!result.success) return false;
  updateSuccessfulRun(rule.id, new Date().toISOString());
  return true;
}

export async function runAutomationSchedulerTick(now = new Date()): Promise<void> {
  if (tickInFlight || typeof window === "undefined") return;
  tickInFlight = true;
  try {
    const rules = storage.loadAppState<AutomationRule[]>(
      APP_STATE_KEYS.AUTOMATION_RULES,
      [],
      AppStateSchemas.automationRules
    );
    const dueRules = rules.filter((rule) => isDailyRuleDue(rule, now));
    if (dueRules.length === 0) return;

    const config = await storage.loadApiConfig(DEFAULT_CONFIG);
    if (
      config.connectionStatus !== "connected" ||
      !api.isObsidianSessionVerified()
    ) {
      return;
    }

    const tasks = storage.loadAppState<MarketingTask[]>(
      APP_STATE_KEYS.TASKS,
      [],
      AppStateSchemas.tasks
    );

    for (const rule of dueRules) {
      await executeScheduledRule(rule, tasks, config);
    }
  } finally {
    tickInFlight = false;
  }
}

export function startAutomationRuntime(): void {
  if (typeof window === "undefined" || timer) return;
  window.setTimeout(() => void runAutomationSchedulerTick(), 1500);
  timer = setInterval(() => void runAutomationSchedulerTick(), 30_000);
}

export function stopAutomationRuntime(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
