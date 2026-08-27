import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Copy,
  ExternalLink,
  Kanban,
  ListFilter,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  Zap,
} from "lucide-react";
import type { AutomationRule, MarketingTask, ObsidianApiConfig, TaskPriority } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import {
  buildExecutionSnapshot,
  classifyTask,
  formatTaskDueLabel,
  moveTaskToNextDay,
  taskMatchesSearch,
} from "../utils/executionIntelligence";

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
  return `Última sincronização: ${parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`;
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

function ruleTriggerLabel(rule: AutomationRule): string {
  const labels: Record<AutomationRule["trigger"], string> = {
    on_campaign_created: "Ao criar campanha",
    daily_schedule: "Agendamento diário",
    on_note_tagged: "Ao identificar tag",
    reminder_triggered: "Ao disparar lembrete",
  };
  return labels[rule.trigger] || rule.trigger;
}

function ruleActionLabel(rule: AutomationRule): string {
  const labels: Record<AutomationRule["action"], string> = {
    create_tasks_in_daily_note: "Criar tarefas na Daily Note",
    schedule_reminders: "Agendar lembretes",
    push_to_obsidian_api: "Enviar ao Obsidian",
    generate_status_report: "Gerar relatório de status",
  };
  return labels[rule.action] || rule.action;
}

export const TasksAutomationView: React.FC<TasksAutomationViewProps> = ({
  tasks = [],
  automationRules = [],
  onToggleTaskStatus,
  onUpdateTask,
  onDeleteTask,
  onOpenNewTaskModal,
  onToggleRule,
  onRunRuleNow,
  onSyncDailyNote,
  apiConfig,
  isSyncingDaily,
  initialSection = "tasks",
}) => {
  const [activeTab, setActiveTab] = useState<ViewMode>(initialSection === "automations" ? "automations" : "list");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  const now = new Date();
  const snapshot = useMemo(() => buildExecutionSnapshot(tasks, now), [tasks, now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()]);
  const isConnected = apiConfig.connectionStatus === "connected";

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
      if (filterMode === "reminders") return snapshot.remindersDue.some((item) => item.id === task.id);
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

  const todoTasks = useMemo(() => filteredTasks.filter((task) => task.status === "todo"), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((task) => task.status === "in-progress"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((task) => task.status === "done"), [filteredTasks]);

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

  const renderTaskRow = (task: MarketingTask) => {
    const bucket = classifyTask(task, snapshot.today);
    return (
      <button
        type="button"
        key={task.id}
        onClick={() => setSelectedTaskId(task.id)}
        className={`w-full text-left rounded-xl border p-3 transition-colors ${
          activeTask?.id === task.id
            ? "border-primary-container bg-primary-container/10"
            : "border-outline-border bg-surface-card hover:bg-surface-elevated"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            onClick={(event) => {
              event.stopPropagation();
              onToggleTaskStatus(task.id);
            }}
            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
              task.status === "done"
                ? "bg-success-sober border-success-sober text-white"
                : "border-outline-border text-transparent hover:border-primary-container"
            }`}
            role="checkbox"
            aria-checked={task.status === "done"}
          >
            <Check className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-semibold truncate ${task.status === "done" ? "line-through text-text-secondary" : "text-text-primary"}`}>
                {task.title}
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityClasses[task.priority]}`}>
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
              <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" />{formatTaskDueLabel(task, now)}</span>
              {task.channel && <span>{task.channel}</span>}
              {task.obsidianFilePath && <span className="truncate max-w-[260px]">{task.obsidianFilePath}</span>}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 animate-fadeIn font-sans">
      <div className="shrink-0 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3 border-b border-outline-border pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className={`px-2 py-1 rounded-md border ${isConnected ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : "border-error-sober/30 bg-error-sober/10 text-error-sober"}`}>
              {isConnected ? "Obsidian conectado" : "Obsidian desconectado"}
            </span>
            <span className="text-text-secondary normal-case tracking-normal font-medium">{formatLastSync(apiConfig.lastSyncTime)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">
            {activeTab === "automations" ? "Automações" : "Execução"}
          </h1>
          <p className="mt-1 text-xs text-text-secondary max-w-2xl">
            {activeTab === "automations"
              ? "Regras registradas no aplicativo. Esta tela não presume execução automática sem histórico real."
              : "Priorize, execute e sincronize tarefas sem datas, métricas ou urgências inventadas."}
          </p>
        </div>

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
              <div key={String(label)} className="rounded-xl border border-outline-border bg-surface-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">{String(label)}</span>
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
          <button type="button" onClick={() => setActiveTab("list")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${activeTab === "list" ? "bg-surface-elevated text-text-primary" : "text-text-secondary"}`}>
            <ListFilter className="w-3.5 h-3.5" /> Lista
          </button>
          <button type="button" onClick={() => setActiveTab("kanban")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${activeTab === "kanban" ? "bg-surface-elevated text-text-primary" : "text-text-secondary"}`}>
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </button>
          <button type="button" onClick={() => setActiveTab("automations")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${activeTab === "automations" ? "bg-surface-elevated text-text-primary" : "text-text-secondary"}`}>
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
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
          {automationRules.length === 0 ? (
            <div className="h-full min-h-52 flex flex-col items-center justify-center text-center">
              <Zap className="w-8 h-8 text-text-secondary" />
              <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma regra registrada</h2>
              <p className="mt-1 text-xs text-text-secondary max-w-md">A etapa de Automações será tratada separadamente. Nenhuma execução é presumida nesta tela.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {automationRules.map((rule) => (
                <div key={rule.id} className="rounded-xl border border-outline-border bg-surface-elevated/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{rule.name}</h3>
                      <p className="mt-1 text-xs text-text-secondary">{rule.description || "Sem descrição registrada."}</p>
                    </div>
                    <button type="button" onClick={() => onToggleRule(rule.id)} className={`text-[10px] px-2 py-1 rounded-full border ${rule.enabled ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : "border-outline-border text-text-secondary"}`}>
                      {rule.enabled ? "Ativa" : "Inativa"}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-outline-border p-2"><span className="block text-text-secondary">Gatilho</span><strong className="text-text-primary">{ruleTriggerLabel(rule)}</strong></div>
                    <div className="rounded-lg border border-outline-border p-2"><span className="block text-text-secondary">Ação</span><strong className="text-text-primary">{ruleActionLabel(rule)}</strong></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                    <span>{rule.executionCount} execuções registradas</span>
                    <button type="button" onClick={() => onRunRuleNow(rule.id)} disabled={!isConnected} className="px-2.5 py-1.5 rounded-lg border border-outline-border text-text-primary disabled:opacity-40 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Executar
                    </button>
                  </div>
                  {rule.lastRun && <p className="mt-2 text-[10px] text-text-secondary">Última execução: {rule.lastRun}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="min-h-0 overflow-hidden rounded-2xl border border-outline-border bg-surface-card">
            {activeTab === "list" ? (
              <div className="h-full min-h-0 overflow-y-auto p-3 space-y-2">
                {filteredTasks.length ? filteredTasks.map(renderTaskRow) : (
                  <div className="h-full min-h-52 flex flex-col items-center justify-center text-center">
                    <CheckSquare className="w-8 h-8 text-text-secondary" />
                    <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma tarefa neste filtro</h2>
                    <p className="mt-1 text-xs text-text-secondary">A lista só exibe tarefas realmente registradas.</p>
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
                    <div key={String(label)} className="rounded-xl border border-outline-border bg-surface-elevated/30 min-h-0 overflow-hidden flex flex-col">
                      <div className="shrink-0 px-3 py-2.5 border-b border-outline-border flex items-center justify-between">
                        <span className="text-xs font-bold text-text-primary">{String(label)}</span>
                        <span className="text-[10px] text-text-secondary">{(group as MarketingTask[]).length}</span>
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
                  {activeTask.description && <p className="mt-2 text-xs leading-5 text-text-secondary">{activeTask.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-outline-border p-2.5"><span className="block text-text-secondary">Prazo</span><strong className="text-text-primary">{formatTaskDueLabel(activeTask, now)}</strong></div>
                  <div className="rounded-lg border border-outline-border p-2.5"><span className="block text-text-secondary">Prioridade</span><strong className="text-text-primary">{priorityLabels[activeTask.priority]}</strong></div>
                </div>

                {activeTask.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{activeTask.tags.map((tag) => <span key={tag} className="text-[10px] px-2 py-1 rounded-md border border-outline-border text-text-secondary">#{tag}</span>)}</div>
                )}

                <div className="space-y-2">
                  {activeTask.status === "todo" && onUpdateTask && (
                    <button type="button" onClick={() => handleStartTask(activeTask)} className="w-full px-3 py-2 rounded-xl border border-primary-container/40 bg-primary-container/10 text-primary-fixed-dim text-xs font-bold flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5" /> Iniciar tarefa</button>
                  )}
                  <button type="button" onClick={() => onToggleTaskStatus(activeTask.id)} className="w-full px-3 py-2 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {activeTask.status === "done" ? "Reabrir" : "Concluir"}</button>
                  {activeTask.status !== "done" && onUpdateTask && (
                    <button type="button" onClick={() => handleDeferTask(activeTask)} className="w-full px-3 py-2 rounded-xl border border-outline-border text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Adiar para amanhã</button>
                  )}
                </div>

                <div className="pt-3 border-t border-outline-border grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleCopyTask(activeTask)} disabled={!activeTask.obsidianTaskString} className="px-2.5 py-2 rounded-lg border border-outline-border text-[11px] text-text-primary disabled:opacity-40 flex items-center justify-center gap-1"><Copy className="w-3 h-3" /> {copiedTaskId === activeTask.id ? "Copiado" : "Copiar MD"}</button>
                  <button type="button" onClick={() => handleOpenInObsidian(activeTask)} disabled={!activeTask.obsidianFilePath || !isConnected} className="px-2.5 py-2 rounded-lg border border-outline-border text-[11px] text-text-primary disabled:opacity-40 flex items-center justify-center gap-1"><ExternalLink className="w-3 h-3" /> Abrir fonte</button>
                </div>

                <button type="button" onClick={() => onDeleteTask(activeTask.id)} className="w-full px-3 py-2 rounded-xl border border-error-sober/30 text-error-sober text-xs font-semibold flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Remover tarefa</button>
              </div>
            ) : (
              <div className="h-full min-h-52 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-8 h-8 text-success-sober" />
                <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma ação pendente</h2>
                <p className="mt-1 text-xs text-text-secondary">Crie uma tarefa somente quando houver uma ação real a executar.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
