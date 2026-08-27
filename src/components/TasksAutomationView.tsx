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
import { PERSISTENT_STATE_EVENT } from "../hooks/usePersistentState";
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
const RUNTIME_SOURCE_ID = "tasks-automation-view-v2";

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

function publishRules(rules: AutomationRule[]): void {
  storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, rules);
  window.dispatchEvent(
    new CustomEvent(PERSISTENT_STATE_EVENT, {
      detail: {
        key: APP_STATE_KEYS.AUTOMATION_RULES,
        value: rules,
        sourceId: RUNTIME_SOURCE_ID,
      },
    })
  );
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
    publishRules(next);
  };

  useEffect(() => {
    const handlePersistentUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: unknown; sourceId?: string }>).detail;
      if (!detail || detail.key !== APP_STATE_KEYS.AUTOMATION_RULES || detail.sourceId === RUNTIME_SOURCE_ID) return;
      if (Array.isArray(detail.value)) setRules(detail.value as AutomationRule[]);
    };
    window.addEventListener(PERSISTENT_STATE_EVENT, handlePersistentUpdate);
    return () => window.removeEventListener(PERSISTENT_STATE_EVENT, handlePersistentUpdate);
  }, []);

  const refreshAutomationContext = async (): Promise<{ connected: boolean; notes: ObsidianNote[] }> => {
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
  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const readyRules = rules.filter((rule) =>
    validateAutomationRule({ ...rule, enabled: true }, automationContext).runnable
  ).length;
  const totalExecutions = rules.reduce(
    (sum, rule) => sum + Number(rule.executionCount || 0),
    0
  );

  const orderedTasks = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...snapshot.overdue,
      ...snapshot.dueToday,
      ...snapshot.inProgress,
      ...snapshot.pending,
      ...snapshot.completed,
    ].filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [snapshot]);

  const filteredTasks = useMemo(
    () =>
      orderedTasks.filter((task) => {
        if (!taskMatchesSearch(task, searchQuery)) return false;
        if (filterMode === "overdue") return classifyTask(task, snapshot.today) === "overdue";
        if (filterMode === "today") return classifyTask(task, snapshot.today) === "today";
        if (filterMode === "in_progress") return task.status === "in-progress";
        if (filterMode === "reminders") return snapshot.remindersDue.some((item) => item.id === task.id);
        if (filterMode === "done") return task.status === "done";
        return true;
      }),
    [filterMode, orderedTasks, searchQuery, snapshot]
  );

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || snapshot.nextAction,
    [selectedTaskId, snapshot.nextAction, tasks]
  );

  const updateTask = (task: MarketingTask, patch: Partial<MarketingTask>) => {
    if (onUpdateTask) onUpdateTask({ ...task, ...patch });
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
      message: `Regra “${rule.name}” adicionada como inativa. Configure e valide antes de habilitar.`,
    });
  };

  const updateAutomationCondition = (ruleId: string, conditionParam: string) => {
    persistRules(
      rules.map((rule) =>
        rule.id === ruleId ? { ...rule, conditionParam, enabled: false } : rule
      )
    );
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
        message: validation.reasons[0] || "A regra ainda não está pronta para execução segura.",
      });
      return;
    }

    persistRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: true } : rule)));
    setFeedback({
      type: "success",
      message:
        target.trigger === "daily_schedule"
          ? `Regra “${target.name}” habilitada. Ela poderá executar automaticamente enquanto o Nisti estiver aberto.`
          : `Regra “${target.name}” habilitada para execução manual.`,
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
                `automation-v2-${rule.id}`,
                `📋 ${rule.name}`,
                markdown
              )
              .catch((error: any) => ({
                success: false,
                message: error?.message || "Falha ao gravar a Daily Note.",
              }));
            return { success: Boolean(response?.success), message: response?.message };
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
            return { success: Boolean(response?.success), message: response?.message };
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
      persistRules(
        rules.map((item) =>
          item.id === rule.id
            ? {
                ...item,
                executionCount: Number(item.executionCount || 0) + 1,
                lastRun: executedAt,
              }
            : item
        )
      );
      setFeedback({ type: "success", message: result.message });
      await refreshAutomationContext();
    } catch (error: any) {
      setFeedback({
        type: "warning",
        message: error?.message || "A automação falhou antes da confirmação do Obsidian.",
      });
    } finally {
      setRunningRuleId(null);
    }
  };

  const taskGroups = [
    { key: "todo", label: "A fazer", items: filteredTasks.filter((task) => task.status === "todo") },
    { key: "in-progress", label: "Em andamento", items: filteredTasks.filter((task) => task.status === "in-progress") },
    { key: "done", label: "Concluídas", items: filteredTasks.filter((task) => task.status === "done") },
  ];

  const renderTask = (task: MarketingTask) => {
    const bucket = classifyTask(task, snapshot.today);
    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setSelectedTaskId(task.id)}
        className={`w-full rounded-xl border p-3 text-left transition-colors ${
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
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
              task.status === "done"
                ? "border-success-sober bg-success-sober text-white"
                : "border-outline-border text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`truncate text-sm font-semibold ${task.status === "done" ? "text-text-secondary line-through" : "text-text-primary"}`}>{task.title}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${priorityClasses[task.priority]}`}>{priorityLabels[task.priority]}</span>
              {bucket === "overdue" && task.status !== "done" && <span className="rounded-full border border-error-sober/30 bg-error-sober/10 px-2 py-0.5 text-[10px] text-error-sober">Vencida</span>}
            </div>
            <p className="mt-1 text-[11px] text-text-secondary">{formatTaskDueLabel(task, now)}{task.channel ? ` • ${task.channel}` : ""}</p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className={`rounded-md border px-2 py-1 ${runtimeConnected || (activeTab !== "automations" && isConnected) ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : "border-error-sober/30 bg-error-sober/10 text-error-sober"}`}>
              {runtimeConnected || (activeTab !== "automations" && isConnected) ? "Obsidian validado" : "Obsidian bloqueado"}
            </span>
            <span className="font-medium normal-case tracking-normal text-text-secondary">{formatLastSync(apiConfig.lastSyncTime)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">{activeTab === "automations" ? "Automações" : "Execução"}</h1>
          <p className="mt-1 max-w-3xl text-xs text-text-secondary">
            {activeTab === "automations"
              ? "Regras auditáveis e fail-closed. Somente o gatilho diário explicitamente configurado pode rodar em segundo plano enquanto o aplicativo estiver aberto."
              : "Priorize e execute tarefas sem prazos, métricas ou urgências inventadas."}
          </p>
        </div>
        {activeTab === "automations" ? (
          <button type="button" onClick={() => void refreshAutomationContext()} disabled={isRefreshingAutomationContext} className="inline-flex items-center gap-2 rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-xs font-semibold text-text-primary disabled:opacity-40"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAutomationContext ? "animate-spin" : ""}`} />Atualizar contexto</button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onSyncDailyNote} disabled={!isConnected || isSyncingDaily} className="inline-flex items-center gap-2 rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-xs font-semibold text-text-primary disabled:opacity-40"><Send className="h-3.5 w-3.5" />{isSyncingDaily ? "Sincronizando..." : "Daily Note"}</button>
            <button type="button" onClick={onOpenNewTaskModal} disabled={!isConnected} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Nova tarefa</button>
          </div>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-outline-border bg-surface-card p-1">
          <TabButton active={activeTab === "list"} onClick={() => setActiveTab("list")} icon={<ListFilter className="h-3.5 w-3.5" />} label="Lista" />
          <TabButton active={activeTab === "kanban"} onClick={() => setActiveTab("kanban")} icon={<Kanban className="h-3.5 w-3.5" />} label="Kanban" />
          <TabButton active={activeTab === "automations"} onClick={() => setActiveTab("automations")} icon={<Zap className="h-3.5 w-3.5" />} label="Automações" />
        </div>
        {activeTab !== "automations" && <div className="flex gap-2"><div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar tarefa" className="w-52 rounded-xl border border-outline-border bg-surface-card py-2 pl-8 pr-3 text-xs text-text-primary outline-none" /></div><select value={filterMode} onChange={(event) => setFilterMode(event.target.value as FilterMode)} className="rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-xs text-text-primary"><option value="all">Todas</option><option value="overdue">Vencidas</option><option value="today">Hoje</option><option value="in_progress">Em andamento</option><option value="reminders">Lembretes vencidos</option><option value="done">Concluídas</option></select></div>}
      </div>

      {activeTab === "automations" ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Regras" value={rules.length} icon={<Zap className="h-4 w-4" />} /><Metric label="Habilitadas" value={enabledRules} icon={<CheckCircle2 className="h-4 w-4" />} /><Metric label="Prontas" value={readyRules} icon={<ShieldCheck className="h-4 w-4" />} /><Metric label="Execuções confirmadas" value={totalExecutions} icon={<Play className="h-4 w-4" />} /></div>
          <div className="rounded-xl border border-primary-container/25 bg-primary-container/5 p-4 text-[11px] leading-5 text-text-secondary"><strong className="text-text-primary">Runner diário ativo:</strong> regras `daily_schedule` executam no primeiro ciclo após o horário configurado, no máximo uma vez por dia, somente enquanto o Nisti estiver aberto e com Obsidian validado. Falhas não incrementam o contador.</div>
          {feedback && <div className={`rounded-xl border p-3 text-xs ${feedback.type === "success" ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : feedback.type === "warning" ? "border-error-sober/30 bg-error-sober/10 text-error-sober" : "border-outline-border bg-surface-card text-text-secondary"}`}>{feedback.message}</div>}

          <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
            <h2 className="text-sm font-bold text-text-primary">Adicionar regra segura</h2>
            <p className="mt-1 text-[11px] text-text-secondary">Toda regra entra desativada e sem histórico fictício.</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">{AUTOMATION_BLUEPRINTS.map((blueprint) => { const added = rules.some((rule) => rule.id === blueprint.id); return <article key={blueprint.id} className="flex flex-col rounded-xl border border-outline-border bg-surface-elevated/30 p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-fixed-dim" /><div><h3 className="text-xs font-bold text-text-primary">{blueprint.name}</h3><p className="mt-1 text-[11px] leading-5 text-text-secondary">{blueprint.description}</p></div></div><p className="mt-3 text-[10px] text-text-secondary">{blueprint.runtimeNotice}</p><button type="button" onClick={() => addAutomation(blueprint.id)} disabled={added} className="mt-4 rounded-lg border border-outline-border px-3 py-2 text-xs font-semibold text-text-primary disabled:opacity-40"><Plus className="mr-1 inline h-3.5 w-3.5" />{added ? "Já adicionada" : "Adicionar regra"}</button></article>; })}</div>
          </section>

          <section className="rounded-2xl border border-outline-border bg-surface-card p-4">
            <h2 className="text-sm font-bold text-text-primary">Regras registradas</h2>
            {rules.length === 0 ? <div className="mt-3 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-outline-border text-center"><Zap className="h-8 w-8 text-text-secondary" /><p className="mt-2 text-xs font-bold text-text-primary">Nenhuma regra registrada</p></div> : <div className="mt-3 grid gap-3 lg:grid-cols-2">{rules.map((rule) => {
              const validation = validateAutomationRule(rule, automationContext);
              const whenEnabled = validateAutomationRule({ ...rule, enabled: true }, automationContext);
              const running = runningRuleId === rule.id;
              return <article key={rule.id} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-text-primary">{rule.name}</h3><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${!validation.supported ? "border-error-sober/30 text-error-sober" : rule.enabled ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : "border-outline-border text-text-secondary"}`}>{!validation.supported ? "Bloqueada" : rule.enabled ? "Ativa" : "Inativa"}</span></div><p className="mt-1 text-[11px] leading-5 text-text-secondary">{rule.description || "Sem descrição registrada."}</p></div><button type="button" onClick={() => persistRules(rules.filter((item) => item.id !== rule.id))} className="rounded-lg border border-outline-border p-1.5 text-text-secondary hover:text-error-sober"><Trash2 className="h-3.5 w-3.5" /></button></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><InfoCell label="Gatilho" value={automationTriggerLabel(rule.trigger)} /><InfoCell label="Ação" value={automationActionLabel(rule.action)} /></div>
                {rule.trigger === "daily_schedule" && validation.supported && <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Horário diário<input type="time" value={rule.conditionParam || ""} onChange={(event) => updateAutomationCondition(rule.id, event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-border bg-surface-card px-3 py-2 text-xs font-normal text-text-primary outline-none" /></label>}
                {rule.action === "push_to_obsidian_api" && validation.supported && <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-text-secondary">Nota autorizada<select value={rule.conditionParam || ""} onChange={(event) => updateAutomationCondition(rule.id, event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-border bg-surface-card px-3 py-2 text-xs font-normal text-text-primary"><option value="">Selecione uma nota</option>{vaultNotes.map((note) => <option key={note.path} value={note.path}>{note.path}</option>)}</select></label>}
                {whenEnabled.reasons.length > 0 && <div className="mt-3 rounded-lg border border-outline-border bg-surface-card p-2.5"><p className="text-[10px] font-bold uppercase text-text-secondary">Bloqueios atuais</p><ul className="mt-1 space-y-1 text-[11px] text-text-secondary">{whenEnabled.reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div>}
                <div className="mt-3 flex gap-2"><button type="button" onClick={() => void toggleAutomation(rule.id)} disabled={!validation.supported} className={`rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40 ${rule.enabled ? "border-error-sober/30 text-error-sober" : "border-outline-border text-text-primary"}`}>{rule.enabled ? "Desativar" : "Habilitar"}</button><button type="button" onClick={() => void runAutomation(rule.id)} disabled={!validation.runnable || running || runningRuleId !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}{running ? "Executando..." : "Executar agora"}</button></div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-outline-border pt-3 text-[10px] text-text-secondary"><span>{Number(rule.executionCount || 0)} execução(ões) confirmada(s)</span><span>{formatAutomationLastRun(rule.lastRun)}</span></div>
              </article>;
            })}</div>}
          </section>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-3">
            {activeTab === "list" ? <div className="space-y-2">{filteredTasks.length ? filteredTasks.map(renderTask) : <EmptyTasks />}</div> : <div className="grid min-w-[760px] grid-cols-3 gap-3">{taskGroups.map((group) => <div key={group.key} className="rounded-xl border border-outline-border bg-surface-elevated/30 p-2"><div className="mb-2 flex items-center justify-between px-1 text-xs font-bold text-text-primary"><span>{group.label}</span><span className="text-[10px] text-text-secondary">{group.items.length}</span></div><div className="space-y-2">{group.items.map(renderTask)}</div></div>)}</div>}
          </div>
          <aside className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
            {activeTask ? <div className="space-y-4"><div><span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Próxima ação</span><h2 className="mt-1 text-lg font-black text-text-primary">{activeTask.title}</h2>{activeTask.description && <p className="mt-2 text-xs leading-5 text-text-secondary">{activeTask.description}</p>}</div><div className="grid grid-cols-2 gap-2 text-[11px]"><InfoCell label="Prazo" value={formatTaskDueLabel(activeTask, now)} /><InfoCell label="Prioridade" value={priorityLabels[activeTask.priority]} /></div><div className="space-y-2">{activeTask.status === "todo" && onUpdateTask && <button type="button" onClick={() => updateTask(activeTask, { status: "in-progress" })} className="w-full rounded-xl border border-primary-container/40 bg-primary-container/10 px-3 py-2 text-xs font-bold text-primary-fixed-dim"><Play className="mr-1 inline h-3.5 w-3.5" />Iniciar</button>}<button type="button" onClick={() => onToggleTaskStatus(activeTask.id)} className="w-full rounded-xl bg-primary-container px-3 py-2 text-xs font-bold text-white"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{activeTask.status === "done" ? "Reabrir" : "Concluir"}</button>{activeTask.status !== "done" && onUpdateTask && <button type="button" onClick={() => onUpdateTask(moveTaskToNextDay(activeTask))} className="w-full rounded-xl border border-outline-border px-3 py-2 text-xs font-semibold text-text-primary"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Adiar para amanhã</button>}</div><div className="grid grid-cols-2 gap-2 border-t border-outline-border pt-3"><button type="button" onClick={async () => { if (!activeTask.obsidianTaskString) return; await navigator.clipboard.writeText(activeTask.obsidianTaskString); setCopiedTaskId(activeTask.id); window.setTimeout(() => setCopiedTaskId(null), 1600); }} disabled={!activeTask.obsidianTaskString} className="rounded-lg border border-outline-border px-2 py-2 text-[11px] text-text-primary disabled:opacity-40"><Copy className="mr-1 inline h-3 w-3" />{copiedTaskId === activeTask.id ? "Copiado" : "Copiar MD"}</button><button type="button" onClick={() => activeTask.obsidianFilePath && (window.location.href = buildObsidianOpenUri(apiConfig.vaultName, activeTask.obsidianFilePath))} disabled={!activeTask.obsidianFilePath || !isConnected} className="rounded-lg border border-outline-border px-2 py-2 text-[11px] text-text-primary disabled:opacity-40"><ExternalLink className="mr-1 inline h-3 w-3" />Abrir fonte</button></div><button type="button" onClick={() => onDeleteTask(activeTask.id)} className="w-full rounded-xl border border-error-sober/30 px-3 py-2 text-xs font-semibold text-error-sober"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remover tarefa</button></div> : <EmptyTasks />}
          </aside>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${active ? "bg-surface-elevated text-text-primary" : "text-text-secondary"}`}>{icon}{label}</button>;
const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-xl border border-outline-border bg-surface-card p-3.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}</span><span className="text-primary-fixed-dim">{icon}</span></div><div className="mt-2 text-2xl font-black text-text-primary">{value}</div></div>;
const InfoCell: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-lg border border-outline-border p-2.5"><span className="block text-text-secondary">{label}</span><strong className="text-text-primary">{value}</strong></div>;
const EmptyTasks = () => <div className="flex min-h-48 flex-col items-center justify-center text-center"><CheckSquare className="h-8 w-8 text-text-secondary" /><h2 className="mt-2 text-sm font-bold text-text-primary">Nenhuma tarefa registrada</h2><p className="mt-1 text-xs text-text-secondary">A tela mostra somente tarefas persistidas.</p></div>;
