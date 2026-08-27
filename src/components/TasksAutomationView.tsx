import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Kanban,
  ListFilter,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  AutomationRule,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
  TaskPriority,
} from "../types";
import { api } from "../services/api";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import {
  buildExecutionSnapshot,
  classifyTask,
  formatTaskDueLabel,
  moveTaskToNextDay,
  taskMatchesSearch,
} from "../utils/executionIntelligence";
import {
  AUTOMATION_BLUEPRINTS,
  automationActionLabel,
  automationTriggerLabel,
  createAutomationRuleFromBlueprint,
  executeAutomationRule,
  formatAutomationLastRun,
  validateAutomationRule,
  type AutomationBlueprintId,
} from "../utils/automationIntelligence";

interface TasksAutomationViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask?: (task: MarketingTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onToggleRule: (ruleId: string) => void;
  onRunRuleNow: (ruleId: string) => void;
  onSyncDailyNote: () => void;
  apiConfig: ObsidianApiConfig;
  isSyncingDaily: boolean;
  initialSection?: "tasks" | "automations";
}

type FilterMode = "all" | "overdue" | "today" | "in_progress" | "reminders" | "done";
type ViewMode = "list" | "kanban" | "automations";
type Feedback = { type: "success" | "warning" | "info"; message: string } | null;

const storage = StorageManager.getInstance();

const priorityLabels: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const priorityClasses: Record<TaskPriority, string> = {
  urgent: "border-error-sober/40 bg-error-sober/10 text-error-sober",
  high: "border-warning-sober/40 bg-warning-sober/10 text-warning-sober",
  medium: "border-primary-container/30 bg-primary-container/10 text-primary-fixed-dim",
  low: "border-outline-border bg-surface-elevated text-text-secondary",
};

function formatLastSync(value?: string): string {
  if (!value) return "Nenhuma sincronização confirmada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `Última sincronização: ${parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
}

function uniqueTasks(groups: MarketingTask[][]): MarketingTask[] {
  const seen = new Set<string>();
  const ordered: MarketingTask[] = [];
  for (const group of groups) {
    for (const task of group) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      ordered.push(task);
    }
  }
  return ordered;
}

export const TasksAutomationView: React.FC<TasksAutomationViewProps> = ({
  tasks = [],
  automationRules = [],
  onToggleTaskStatus,
  onUpdateTask,
  onDeleteTask,
  onOpenNewTaskModal,
  onSyncDailyNote,
  apiConfig,
  isSyncingDaily,
  initialSection = "tasks",
}) => {
  const [activeTab, setActiveTab] = useState<ViewMode>(
    initialSection === "automations" ? "automations" : "list"
  );
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  const [rules, setRules] = useState<AutomationRule[]>(() =>
    storage.loadAppState<AutomationRule[]>(APP_STATE_KEYS.AUTOMATION_RULES, automationRules)
  );
  const [vaultNotes, setVaultNotes] = useState<ObsidianNote[]>([]);
  const [runtimeConnected, setRuntimeConnected] = useState(false);
  const [isRefreshingAutomationContext, setIsRefreshingAutomationContext] = useState(false);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  const snapshot = useMemo(() => buildExecutionSnapshot(tasks, now), [tasks, minuteKey]);
  const isConnected = apiConfig.connectionStatus === "connected";

  const persistRules = (next: AutomationRule[]) => {
    setRules(next);
    storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, next);
  };

  const refreshAutomationContext = async (): Promise<{
    connected: boolean;
    notes: ObsidianNote[];
  }> => {
    setIsRefreshingAutomationContext(true);
    try {
      const connected =
        apiConfig.connectionStatus === "connected" && api.isObsidianSessionVerified();
      setRuntimeConnected(connected);
      if (!connected) {
        setVaultNotes([]);
        return { connected: false, notes: [] };
      }

      const notes = (await storage.readDesktopNotesForApp()) || [];
      setVaultNotes(notes);
      return { connected: true, notes };
    } catch {
      setRuntimeConnected(false);
      setVaultNotes([]);
      return { connected: false, notes: [] };
    } finally {
      setIsRefreshingAutomationContext(false);
    }
  };

  useEffect(() => {
    void refreshAutomationContext();
    const timer = window.setInterval(() => {
      const connected =
        apiConfig.connectionStatus === "connected" && api.isObsidianSessionVerified();
      setRuntimeConnected(connected);
      if (!connected) setVaultNotes([]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [apiConfig.connectionStatus]);

  const automationContext = useMemo(
    () => ({ isConnected: runtimeConnected, tasks, notes: vaultNotes }),
    [runtimeConnected, tasks, vaultNotes]
  );

  const enabledRules = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const readyRules = useMemo(
    () =>
      rules.filter((rule) =>
        validateAutomationRule({ ...rule, enabled: true }, automationContext).runnable
      ).length,
    [rules, automationContext]
  );
  const totalExecutions = useMemo(
    () => rules.reduce((sum, rule) => sum + Number(rule.executionCount || 0), 0),
    [rules]
  );

  const orderedTasks = useMemo(() => {
    const remainingPending = snapshot.pending.filter(
      (task) =>
        !snapshot.overdue.some((item) => item.id === task.id) &&
        !snapshot.dueToday.some((item) => item.id === task.id) &&
        !snapshot.inProgress.some((item) => item.id === task.id)
    );
    return uniqueTasks([
      snapshot.overdue,
      snapshot.dueToday,
      snapshot.inProgress,
      remainingPending,
      snapshot.completed,
    ]);
  }, [snapshot]);

  const filteredTasks = useMemo(() => {
    return orderedTasks.filter((task) => {
      if (!taskMatchesSearch(task, searchQuery)) return false;
      if (filterMode === "overdue") return classifyTask(task, snapshot.today) === "overdue";
      if (filterMode === "today") return classifyTask(task, snapshot.today) === "today";
      if (filterMode === "in_progress") return task.status === "in-progress";
      if (filterMode === "reminders") {
        return snapshot.remindersDue.some((item) => item.id === task.id);
      }
      if (filterMode === "done") return task.status === "done";
      return true;
    });
  }, [filterMode, orderedTasks, searchQuery, snapshot]);

  const activeTask = useMemo(() => {
    if (selectedTaskId) {
      const selected = tasks.find((task) => task.id === selectedTaskId);
      if (selected) return selected;
    }
    return snapshot.nextAction;
  }, [selectedTaskId, snapshot.nextAction, tasks]);

  const todoTasks = useMemo(
    () => filteredTasks.filter((task) => task.status === "todo"),
    [filteredTasks]
  );
  const inProgressTasks = useMemo(
    () => filteredTasks.filter((task) => task.status === "in-progress"),
    [filteredTasks]
  );
  const doneTasks = useMemo(
    () => filteredTasks.filter((task) => task.status === "done"),
    [filteredTasks]
  );

  const updateTask = (task: MarketingTask, patch: Partial<MarketingTask>) => {
    if (!onUpdateTask) return;
    onUpdateTask({ ...task, ...patch });
  };

  const handleStartTask = (task: MarketingTask) => {
    if (task.status !== "todo") return;
    updateTask(task, { status: "in-progress" });
  };

  const handleDeferTask = (task: MarketingTask) => {
    if (!onUpdateTask) return;
    onUpdateTask(moveTaskToNextDay(task));
  };

  const handleCopyTask = async (task: MarketingTask) => {
    if (!task.obsidianTaskString) return;
    await navigator.clipboard.writeText(task.obsidianTaskString);
    setCopiedTaskId(task.id);
    window.setTimeout(() => setCopiedTaskId(null), 1600);
  };

  const handleOpenInObsidian = (task: MarketingTask) => {
    if (!task.obsidianFilePath || !apiConfig.vaultName) return;
    window.location.href = buildObsidianOpenUri(apiConfig.vaultName, task.obsidianFilePath);
  };

  const addAutomation = (blueprintId: AutomationBlueprintId) => {
    if (rules.some((rule) => rule.id === blueprintId)) {
      setFeedback({ type: "info", message: "Essa regra já está registrada." });
      return;
    }
    const rule = createAutomationRuleFromBlueprint(blueprintId);
    persistRules([...rules, rule]);
    setFeedback({
      type: "success",
      message: `Regra “${rule.name}” adicionada como inativa. Revise a configuração antes de habilitar.`,
    });
  };

  const updateAutomationCondition = (ruleId: string, conditionParam: string) => {
    const next = rules.map((rule) =>
      rule.id === ruleId ? { ...rule, conditionParam, enabled: false } : rule
    );
    persistRules(next);
    setFeedback({
      type: "info",
      message: "Configuração alterada. A regra foi desativada e precisa ser habilitada novamente.",
    });
  };

  const toggleAutomation = async (ruleId: string) => {
    const target = rules.find((rule) => rule.id === ruleId);
    if (!target) return;

    if (target.enabled) {
      persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: false } : rule)));
      setFeedback({ type: "info", message: `Regra “${target.name}” desativada.` });
      return;
    }

    const fresh = await refreshAutomationContext();
    const validation = validateAutomationRule(
      { ...target, enabled: true },
      { isConnected: fresh.connected, tasks, notes: fresh.notes }
    );
    if (!validation.runnable) {
      setFeedback({
        type: "warning",
        message: validation.reasons[0] || "A regra ainda não está pronta para ser habilitada.",
      });
      return;
    }

    persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: true } : rule)));
    setFeedback({
      type: "success",
      message: `Regra “${target.name}” habilitada. A execução permanece manual nesta versão.`,
    });
  };

  const deleteAutomation = (ruleId: string) => {
    const target = rules.find((rule) => rule.id === ruleId);
    persistRules(rules.filter((rule) => rule.id !== ruleId));
    setFeedback({
      type: "info",
      message: target ? `Regra “${target.name}” removida.` : "Regra removida.",
    });
  };

  const runAutomation = async (ruleId: string) => {
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule || runningRuleId) return;

    setRunningRuleId(ruleId);
    setFeedback(null);
    try {
      const fresh = await refreshAutomationContext();
      const result = await executeAutomationRule(
        rule,
        { isConnected: fresh.connected, tasks, notes: fresh.notes },
        {
          syncPendingTasks: async (markdown) => {
            const response = await api
              .upsertDailyNoteSection(
                apiConfig,
                "automation-v2-pending-tasks",
                "📋 Tarefas pendentes — Automação Nisti",
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
                apiConfig,
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
              details: `[v2 fail-closed] ${rule.name}: ${details}`,
            });
          },
        }
      );

      if (!result.success) {
        setFeedback({ type: "warning", message: result.message });
        return;
      }

      const executedAt = new Date().toISOString();
      const next = rules.map((item) =>
        item.id === rule.id
          ? {
              ...item,
              executionCount: Number(item.executionCount || 0) + 1,
              lastRun: executedAt,
            }
          : item
      );
      persistRules(next);
      setFeedback({ type: "success", message: result.message });
      await refreshAutomationContext();
    } catch (error: any) {
      setFeedback({
        type: "warning",
        message: error?.message || "A automação falhou antes de receber confirmação do Obsidian.",
      });
    } finally {
      setRunningRuleId(null);
    }
  };

  const renderTaskRow = (task: MarketingTask) => {
    const bucket = classifyTask(task, snapshot.today);
    return (
      <div
        key={task.id}
        onClick={() => setSelectedTaskId(task.id)}
        className={`w-full text-left rounded-xl border p-3 transition-colors cursor-pointer ${
          activeTask?.id === task.id
            ? "border-primary-container bg-primary-container/10"
            : "border-outline-border bg-surface-card hover:bg-surface-elevated"
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleTaskStatus(task.id);
            }}
            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
              task.status === "done"
                ? "bg-success-sober border-success-sober text-white"
                : "border-outline-border text-transparent hover:border-primary-container"
            }`}
            aria-label={task.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-sm font-semibold truncate ${
                  task.status === "done"
                    ? "line-through text-text-secondary"
                    : "text-text-primary"
                }`}
              >
                {task.title}
              </p>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityClasses[task.priority]}`}
              >
                {priorityLabels[task.priority]}
              </span>
              {task.status === "in-progress" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary-container/30 bg-primary-container/10 text-primary-fixed-dim">
                  Em andamento
                </span>
              )}
              {bucket === "overdue" && task.status !== "done" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-error-sober/30 bg-error-sober/10 text-error-sober">
                  Vencida
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1">
                <Clock3 className="w-3 h-3" />
                {formatTaskDueLabel(task, now)}
              </span>
              {task.channel && <span>{task.channel}</span>}
              {task.obsidianFilePath && (
                <span className="truncate max-w-[260px]">{task.obsidianFilePath}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 animate-fadeIn font-sans">
      <div className="shrink-0 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3 border-b border-outline-border pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span
              className={`px-2 py-1 rounded-md border ${
                activeTab === "automations"
                  ? runtimeConnected
                    ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                    : "border-error-sober/30 bg-error-sober/10 text-error-sober"
                  : isConnected
                    ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                    : "border-error-sober/30 bg-error-sober/10 text-error-sober"
              }`}
            >
              {activeTab === "automations"
                ? runtimeConnected
                  ? "Runtime Obsidian validado"
                  : "Runtime Obsidian bloqueado"
                : isConnected
                  ? "Obsidian conectado"
                  : "Obsidian desconectado"}
            </span>
            <span className="text-text-secondary normal-case tracking-normal font-medium">
              {formatLastSync(apiConfig.lastSyncTime)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">
            {activeTab === "automations" ? "Automações" : "Execução"}
          </h1>
          <p className="mt-1 text-xs text-text-secondary max-w-3xl">
            {activeTab === "automations"
              ? "Regras auditáveis e fail-closed. Nesta versão, nenhuma regra roda em segundo plano: a execução exige ação manual, configuração válida e confirmação do Obsidian quando houver escrita."
              : "Priorize, execute e sincronize tarefas sem datas, métricas ou urgências inventadas."}
          </p>
        </div>

        {activeTab !== "automations" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSyncDailyNote}
              disabled={!isConnected || isSyncingDaily}
              className="px-3.5 py-2 rounded-xl border border-outline-border bg-surface-card text-xs font-semibold text-text-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSyncingDaily ? "Sincronizando..." : "Sincronizar Daily Note"}
            </button>
            <button
              type="button"
              onClick={onOpenNewTaskModal}
              disabled={!isConnected}
              className="px-4 py-2 rounded-xl bg-primary-container text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nova tarefa
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void refreshAutomationContext()}
            disabled={isRefreshingAutomationContext}
            className="px-3.5 py-2 rounded-xl border border-outline-border bg-surface-card text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshingAutomationContext ? "animate-spin" : ""}`}
            />
            Atualizar contexto
          </button>
        )}
      </div>

      {activeTab !== "automations" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          {[
            ["Vencidas", snapshot.overdue.length, AlertTriangle, "text-error-sober"],
            ["Para hoje", snapshot.dueToday.length, Clock3, "text-warning-sober"],
            ["Em andamento", snapshot.inProgress.length, Play, "text-primary-fixed-dim"],
            ["Lembretes vencidos", snapshot.remindersDue.length, Bell, "text-text-primary"],
          ].map(([label, value, Icon, color]) => {
            const MetricIcon = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div
                key={String(label)}
                className="rounded-xl border border-outline-border bg-surface-card p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                    {String(label)}
                  </span>
                  <MetricIcon className={`w-4 h-4 ${String(color)}`} />
                </div>
                <div className="mt-2 text-2xl font-black text-text-primary">{Number(value)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="inline-flex rounded-xl border border-outline-border bg-surface-card p-1 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeTab === "list" ? "bg-surface-elevated text-text-primary" : "text-text-secondary"
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("kanban")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeTab === "kanban" ? "bg-surface-elevated text-text-primary" : "text-text-secondary"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("automations")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              activeTab === "automations"
                ? "bg-surface-elevated text-text-primary"
                : "text-text-secondary"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Automações
          </button>
        </div>

        {activeTab !== "automations" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar tarefa"
                className="w-52 pl-8 pr-3 py-2 rounded-xl border border-outline-border bg-surface-card text-xs text-text-primary outline-none focus:border-primary-container"
              />
            </div>
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
              className="px-3 py-2 rounded-xl border border-outline-border bg-surface-card text-xs text-text-primary outline-none"
            >
              <option value="all">Todas</option>
              <option value="overdue">Vencidas</option>
              <option value="today">Hoje</option>
              <option value="in_progress">Em andamento</option>
              <option value="reminders">Lembretes vencidos</option>
              <option value="done">Concluídas</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === "automations" ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ["Regras registradas", rules.length, Zap],
              ["Regras habilitadas", enabledRules, CheckCircle2],
              ["Prontas agora", readyRules, ShieldCheck],
              ["Execuções confirmadas", totalExecutions, Play],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as React.ComponentType<{ className?: string }>;
              return (
                <div key={String(label)} className="rounded-xl border border-outline-border bg-surface-card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                      {String(label)}
                    </span>
                    <MetricIcon className="w-4 h-4 text-primary-fixed-dim" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-text-primary">{Number(value)}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-warning-sober/30 bg-warning-sober/10 p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-warning-sober shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-text-primary">Sem automação em segundo plano nesta etapa</p>
              <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                Os gatilhos abaixo documentam a intenção da regra. O executor da v2 só roda quando você clica em Executar, com o aplicativo aberto. Nenhuma execução é simulada e o contador só aumenta após sucesso confirmado.
              </p>
            </div>
          </div>

          {feedback && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                feedback.type === "success"
                  ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                  : feedback.type === "warning"
                    ? "border-error-sober/30 bg-error-sober/10 text-error-sober"
                    : "border-outline-border bg-surface-card text-text-secondary"
              }`}
            >
              {feedback.message}
            </div>
          )}

          <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-text-primary">Adicionar regra segura</h2>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Templates entram sempre desativados e sem histórico fictício.
                </p>
              </div>
              <span className="text-[10px] text-text-secondary">{vaultNotes.length} fonte(s) no snapshot atual</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {AUTOMATION_BLUEPRINTS.map((blueprint) => {
                const alreadyAdded = rules.some((rule) => rule.id === blueprint.id);
                return (
                  <article key={blueprint.id} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-4 flex flex-col">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary-fixed-dim shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-xs font-bold text-text-primary">{blueprint.name}</h3>
                        <p className="mt-1 text-[11px] leading-5 text-text-secondary">{blueprint.description}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] text-text-secondary">{blueprint.runtimeNotice}</p>
                    <button
                      type="button"
                      onClick={() => addAutomation(blueprint.id)}
                      disabled={alreadyAdded}
                      className="mt-4 px-3 py-2 rounded-lg border border-outline-border text-xs font-semibold text-text-primary disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {alreadyAdded ? "Já adicionada" : "Adicionar regra"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-text-primary">Regras registradas</h2>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Regras legadas desconhecidas ficam bloqueadas até serem removidas ou migradas.
                </p>
              </div>
            </div>

            {rules.length === 0 ? (
              <div className="min-h-44 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-outline-border">
                <Zap className="w-8 h-8 text-text-secondary" />
                <h3 className="mt-3 text-sm font-bold text-text-primary">Nenhuma regra registrada</h3>
                <p className="mt-1 text-xs text-text-secondary max-w-md">
                  Adicione somente a automação que deseja configurar. Nada é ativado automaticamente.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {rules.map((rule) => {
                  const validation = validateAutomationRule(rule, automationContext);
                  const validationWhenEnabled = validateAutomationRule(
                    { ...rule, enabled: true },
                    automationContext
                  );
                  const running = runningRuleId === rule.id;
                  return (
                    <article key={rule.id} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-text-primary">{rule.name}</h3>
                            <span
                              className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                                !validation.supported
                                  ? "border-error-sober/30 bg-error-sober/10 text-error-sober"
                                  : rule.enabled
                                    ? "border-success-sober/30 bg-success-sober/10 text-success-sober"
                                    : "border-outline-border text-text-secondary"
                              }`}
                            >
                              {!validation.supported ? "Bloqueada" : rule.enabled ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                            {rule.description || "Sem descrição registrada."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAutomation(rule.id)}
                          className="p-1.5 rounded-lg border border-outline-border text-text-secondary hover:text-error-sober"
                          title="Excluir regra"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg border border-outline-border p-2.5">
                          <span className="block text-text-secondary">Gatilho declarado</span>
                          <strong className="text-text-primary">{automationTriggerLabel(rule.trigger)}</strong>
                        </div>
                        <div className="rounded-lg border border-outline-border p-2.5">
                          <span className="block text-text-secondary">Ação</span>
                          <strong className="text-text-primary">{automationActionLabel(rule.action)}</strong>
                        </div>
                      </div>

                      {rule.action === "push_to_obsidian_api" && validation.supported && (
                        <div className="mt-3">
                          <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                            Nota autorizada para envio
                          </label>
                          <select
                            value={rule.conditionParam || ""}
                            onChange={(event) => updateAutomationCondition(rule.id, event.target.value)}
                            className="mt-1.5 w-full px-3 py-2 rounded-lg border border-outline-border bg-surface-card text-xs text-text-primary outline-none"
                          >
                            <option value="">Selecione uma nota do snapshot validado</option>
                            {vaultNotes.map((note) => (
                              <option key={note.path} value={note.path}>
                                {note.path}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {validationWhenEnabled.reasons.length > 0 && (
                        <div className="mt-3 rounded-lg border border-outline-border bg-surface-card p-2.5">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Bloqueios atuais</p>
                          <ul className="mt-1.5 space-y-1 text-[11px] text-text-secondary">
                            {validationWhenEnabled.reasons.map((reason) => (
                              <li key={reason}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleAutomation(rule.id)}
                          disabled={!validation.supported}
                          className={`px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-40 ${
                            rule.enabled
                              ? "border-error-sober/30 text-error-sober"
                              : "border-outline-border text-text-primary"
                          }`}
                        >
                          {rule.enabled ? "Desativar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void runAutomation(rule.id)}
                          disabled={!validation.runnable || running || runningRuleId !== null}
                          className="px-3 py-2 rounded-lg bg-primary-container text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {running ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          {running ? "Executando..." : "Executar"}
                        </button>
                      </div>

                      <div className="mt-3 pt-3 border-t border-outline-border flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-secondary">
                        <span>{Number(rule.executionCount || 0)} execução(ões) confirmada(s)</span>
                        <span>{formatAutomationLastRun(rule.lastRun)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-outline-border bg-surface-card">
            {activeTab === "list" ? (
              <div className="h-full min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredTasks.length ? (
                  filteredTasks.map(renderTaskRow)
                ) : (
                  <div className="h-full min-h-52 flex flex-col items-center justify-center text-center">
                    <CheckSquare className="w-8 h-8 text-text-secondary" />
                    <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma tarefa neste filtro</h2>
                    <p className="mt-1 text-xs text-text-secondary">
                      A lista só exibe tarefas realmente registradas.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-x-auto p-3">
                <div className="grid grid-cols-3 gap-3 min-w-[820px] h-full">
                  {[
                    ["A fazer", todoTasks],
                    ["Em andamento", inProgressTasks],
                    ["Concluídas", doneTasks],
                  ].map(([label, group]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-outline-border bg-surface-elevated/30 min-h-0 overflow-hidden flex flex-col"
                    >
                      <div className="shrink-0 px-3 py-2.5 border-b border-outline-border flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary">{String(label)}</span>
                        <span className="text-[10px] text-text-secondary">
                          {(group as MarketingTask[]).length}
                        </span>
                      </div>
                      <div className="p-2 space-y-2 overflow-y-auto min-h-0">
                        {(group as MarketingTask[]).map(renderTaskRow)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
            {activeTask ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Próxima ação</span>
                  <h2 className="mt-1 text-lg font-black text-text-primary">{activeTask.title}</h2>
                  {activeTask.description && (
                    <p className="mt-2 text-xs leading-5 text-text-secondary">{activeTask.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-outline-border p-2.5">
                    <span className="block text-text-secondary">Prazo</span>
                    <strong className="text-text-primary">{formatTaskDueLabel(activeTask, now)}</strong>
                  </div>
                  <div className="rounded-lg border border-outline-border p-2.5">
                    <span className="block text-text-secondary">Prioridade</span>
                    <strong className="text-text-primary">{priorityLabels[activeTask.priority]}</strong>
                  </div>
                </div>

                {activeTask.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTask.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-1 rounded-md border border-outline-border text-text-secondary">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {activeTask.status === "todo" && onUpdateTask && (
                    <button
                      type="button"
                      onClick={() => handleStartTask(activeTask)}
                      className="w-full px-3 py-2 rounded-xl border border-primary-container/40 bg-primary-container/10 text-primary-fixed-dim text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Iniciar tarefa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleTaskStatus(activeTask.id)}
                    className="w-full px-3 py-2 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {activeTask.status === "done" ? "Reabrir" : "Concluir"}
                  </button>
                  {activeTask.status !== "done" && onUpdateTask && (
                    <button
                      type="button"
                      onClick={() => handleDeferTask(activeTask)}
                      className="w-full px-3 py-2 rounded-xl border border-outline-border text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Clock3 className="w-3.5 h-3.5" /> Adiar para amanhã
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t border-outline-border grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyTask(activeTask)}
                    disabled={!activeTask.obsidianTaskString}
                    className="px-2.5 py-2 rounded-lg border border-outline-border text-[11px] text-text-primary disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedTaskId === activeTask.id ? "Copiado" : "Copiar MD"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenInObsidian(activeTask)}
                    disabled={!activeTask.obsidianFilePath || !isConnected}
                    className="px-2.5 py-2 rounded-lg border border-outline-border text-[11px] text-text-primary disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir fonte
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteTask(activeTask.id)}
                  className="w-full px-3 py-2 rounded-xl border border-error-sober/30 text-error-sober text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover tarefa
                </button>
              </div>
            ) : (
              <div className="h-full min-h-52 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-8 h-8 text-success-sober" />
                <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma ação pendente</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Crie uma tarefa somente quando houver uma ação real a executar.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
