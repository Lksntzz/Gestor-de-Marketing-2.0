import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
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
import type { AutomationRule, MarketingTask, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { evaluateAutomationRule } from "../utils/automationIntelligence";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";
import {
  AUTOMATION_EVENT,
  executeAutomationRule,
  startAutomationRuntime,
} from "../services/automationRuntime";

const storage = StorageManager.getInstance();
if (typeof window !== "undefined") startAutomationRuntime();

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

type TaskView = "list" | "kanban";
type FilterMode = "all" | "high_urgent" | "in_progress" | "reminders" | "done";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDueDate(dateStr?: string, timeStr?: string): string {
  if (!dateStr) return "Sem prazo";
  const today = localDateKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);
  if (dateStr === today) return `Hoje${timeStr ? `, ${timeStr}` : ""}`;
  if (dateStr === tomorrow) return `Amanhã${timeStr ? `, ${timeStr}` : ""}`;
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return `${dateStr}${timeStr ? `, ${timeStr}` : ""}`;
  return `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(parsed)}${timeStr ? `, ${timeStr}` : ""}`;
}

function persistRules(rules: AutomationRule[]): void {
  storage.saveAppState(APP_STATE_KEYS.AUTOMATION_RULES, rules);
  window.dispatchEvent(new CustomEvent(AUTOMATION_EVENT, { detail: rules }));
}

export const TasksAutomationView: React.FC<TasksAutomationViewProps> = (props) => {
  const {
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
  } = props;

  if (initialSection === "automations") {
    return <AutomationWorkspace initialRules={automationRules} tasks={tasks} apiConfig={apiConfig} />;
  }

  const [taskView, setTaskView] = useState<TaskView>("list");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = !query || `${task.title} ${task.description || ""} ${task.channel || ""}`.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (filterMode === "high_urgent") return task.status !== "done" && ["high", "urgent"].includes(task.priority);
      if (filterMode === "in_progress") return task.status === "in-progress";
      if (filterMode === "reminders") return task.status !== "done" && task.isReminderActive && Boolean(task.reminderDate && task.reminderTime);
      if (filterMode === "done") return task.status === "done";
      return true;
    });
  }, [tasks, filterMode, searchQuery]);

  const pending = tasks.filter((task) => task.status !== "done");
  const completed = tasks.filter((task) => task.status === "done");
  const urgent = pending.filter((task) => task.priority === "urgent" || task.priority === "high");
  const reminders = pending.filter((task) => task.isReminderActive && task.reminderDate && task.reminderTime);

  const nextTask = useMemo(() => {
    const list = pending.slice().sort((a, b) => {
      const priority = { urgent: 0, high: 1, medium: 2, low: 3 };
      const p = priority[a.priority] - priority[b.priority];
      if (p !== 0) return p;
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    });
    return tasks.find((task) => task.id === selectedTaskId) || list[0] || null;
  }, [pending, selectedTaskId, tasks]);

  const deferTomorrow = (task: MarketingTask) => {
    if (!onUpdateTask) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = localDateKey(tomorrow);
    const reminderWasSameDate = task.isReminderActive && task.reminderDate === task.dueDate;
    onUpdateTask({
      ...task,
      dueDate: nextDate,
      reminderDate: reminderWasSameDate ? nextDate : task.reminderDate,
      obsidianTaskString: task.obsidianTaskString.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${nextDate}`),
    });
  };

  const columns = [
    { key: "todo", label: "A Fazer" },
    { key: "in-progress", label: "Em Andamento" },
    { key: "done", label: "Concluídas" },
  ] as const;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">Nisti Marketing</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Execução</h1>
          <p className="mt-1 text-xs text-text-secondary">Tarefas persistidas, prazos explícitos e lembretes somente quando configurados.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onSyncDailyNote} disabled={isSyncingDaily || apiConfig.connectionStatus !== "connected"} className="inline-flex items-center gap-2 rounded-xl border border-outline-border bg-surface-card px-3 py-2 text-xs font-bold text-text-primary disabled:opacity-40">
            <Send className="h-3.5 w-3.5" /> {isSyncingDaily ? "Sincronizando..." : "Daily Note"}
          </button>
          <button onClick={onOpenNewTaskModal} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-3 py-2 text-xs font-bold text-white">
            <Plus className="h-3.5 w-3.5" /> Nova tarefa
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Pendentes" value={pending.length} icon={<CheckSquare className="h-4 w-4" />} />
        <Metric label="Concluídas" value={completed.length} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Metric label="Alta / urgente" value={urgent.length} icon={<AlertTriangle className="h-4 w-4" />} />
        <Metric label="Lembretes válidos" value={reminders.length} icon={<Bell className="h-4 w-4" />} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-outline-border bg-surface-container-low p-1">
          <button onClick={() => setTaskView("list")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${taskView === "list" ? "bg-primary-container text-white" : "text-text-secondary"}`}><ListFilter className="h-3.5 w-3.5" /> Lista</button>
          <button onClick={() => setTaskView("kanban")} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${taskView === "kanban" ? "bg-primary-container text-white" : "text-text-secondary"}`}><Kanban className="h-3.5 w-3.5" /> Kanban</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "high_urgent", "in_progress", "reminders", "done"] as FilterMode[]).map((filter) => (
            <button key={filter} onClick={() => setFilterMode(filter)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${filterMode === filter ? "border-primary-container bg-primary-container/15 text-primary-fixed-dim" : "border-outline-border text-text-secondary"}`}>{filter.replace("high_urgent", "alta/urgente").replace("in_progress", "andamento").replace("reminders", "lembretes").replace("done", "concluídas").replace("all", "todas")}</button>
          ))}
        </div>
      </div>

      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar tarefas" className="w-full rounded-xl border border-outline-border bg-surface-card py-2.5 pl-10 pr-4 text-xs text-text-primary outline-none focus:border-primary-container" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {taskView === "list" ? (
          <div className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card">
            {filteredTasks.length === 0 ? <EmptyTasks /> : filteredTasks.map((task) => (
              <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className="flex w-full items-center gap-3 border-b border-outline-border/50 px-4 py-3 text-left last:border-0 hover:bg-surface-container-low">
                <span onClick={(event) => { event.stopPropagation(); onToggleTaskStatus(task.id); }} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${task.status === "done" ? "border-success-sober bg-success-sober text-black" : "border-outline-border"}`}>{task.status === "done" && <Check className="h-3.5 w-3.5" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{task.priority}</span>{task.channel && <span className="text-[9px] text-primary-fixed-dim">{task.channel}</span>}</div>
                  <p className={`mt-1 truncate text-sm font-semibold ${task.status === "done" ? "text-text-secondary line-through" : "text-text-primary"}`}>{task.title}</p>
                </div>
                <span className="shrink-0 text-[10px] text-text-secondary">{formatDueDate(task.dueDate, task.dueTime)}</span>
                <span onClick={(event) => { event.stopPropagation(); onDeleteTask(task.id); }} className="rounded-lg p-1.5 text-text-secondary hover:text-error-sober"><Trash2 className="h-3.5 w-3.5" /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid min-h-0 gap-3 md:grid-cols-3">
            {columns.map((column) => (
              <div key={column.key} className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-3">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">{column.label}</p>
                <div className="space-y-2">{filteredTasks.filter((task) => task.status === column.key).map((task) => (
                  <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className="w-full rounded-xl border border-outline-border bg-surface-container-low p-3 text-left">
                    <p className="text-xs font-bold text-text-primary">{task.title}</p><p className="mt-2 text-[10px] text-text-secondary">{formatDueDate(task.dueDate, task.dueTime)}</p>
                  </button>
                ))}</div>
              </div>
            ))}
          </div>
        )}

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
          {nextTask ? (
            <div className="space-y-4">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-primary-fixed-dim">Próxima ação</p><h2 className="mt-2 text-base font-black text-text-primary">{nextTask.title}</h2><p className="mt-2 text-xs leading-5 text-text-secondary">{nextTask.description || "Sem descrição registrada."}</p></div>
              <div className="space-y-2 rounded-xl border border-outline-border bg-surface-container-low p-3 text-xs"><Row label="Prioridade" value={nextTask.priority} /><Row label="Prazo" value={formatDueDate(nextTask.dueDate, nextTask.dueTime)} /><Row label="Canal" value={nextTask.channel || "Não informado"} /></div>
              {nextTask.obsidianFilePath && <a href={buildObsidianOpenUri(apiConfig.vaultName, nextTask.obsidianFilePath)} className="inline-flex items-center gap-2 text-xs font-bold text-primary-fixed-dim"><ExternalLink className="h-3.5 w-3.5" /> Abrir fonte no Obsidian</a>}
              {nextTask.status !== "done" && <div className="space-y-2"><button onClick={() => onToggleTaskStatus(nextTask.id)} className="w-full rounded-lg bg-primary-container py-2.5 text-xs font-bold text-white">Concluir</button><button onClick={() => deferTomorrow(nextTask)} disabled={!onUpdateTask} className="w-full rounded-lg border border-outline-border py-2.5 text-xs font-bold text-text-primary disabled:opacity-40"><Clock className="mr-2 inline h-3.5 w-3.5" /> Adiar para amanhã</button></div>}
            </div>
          ) : <EmptyTasks />}
        </aside>
      </div>
    </div>
  );
};

const AutomationWorkspace: React.FC<{ initialRules: AutomationRule[]; tasks: MarketingTask[]; apiConfig: ObsidianApiConfig }> = ({ initialRules, tasks, apiConfig }) => {
  const [rules, setRules] = useState<AutomationRule[]>(() => storage.loadAppState(APP_STATE_KEYS.AUTOMATION_RULES, initialRules, AppStateSchemas.automationRules));
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "warning"; message: string } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [action, setAction] = useState<"create_tasks_in_daily_note" | "generate_status_report">("create_tasks_in_daily_note");
  const [path, setPath] = useState("08_Aprendizados/Relatorio-Operacional.md");
  const [priority, setPriority] = useState<"" | "low" | "medium" | "high" | "urgent">("");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AutomationRule[]>).detail;
      if (Array.isArray(detail)) setRules(detail);
    };
    window.addEventListener(AUTOMATION_EVENT, handler);
    return () => window.removeEventListener(AUTOMATION_EVENT, handler);
  }, []);

  const updateRules = (next: AutomationRule[]) => {
    setRules(next);
    persistRules(next);
  };

  const saveRule = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setFeedback({ type: "warning", message: "Informe nome, descrição e horário válido no formato HH:MM." });
      return;
    }
    const parts = [`time=${time}`];
    if (priority) parts.push(`priority=${priority}`);
    if (action === "generate_status_report") {
      if (!path.trim()) {
        setFeedback({ type: "warning", message: "Informe o caminho do relatório no Vault." });
        return;
      }
      parts.push(`path=${path.trim()}`);
    }
    const rule: AutomationRule = {
      id: `rule-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      trigger: "daily_schedule",
      conditionParam: parts.join(";"),
      action,
      enabled: false,
      executionCount: 0,
    };
    updateRules([rule, ...rules]);
    setCreating(false);
    setName(""); setDescription(""); setTime(""); setPriority("");
    setFeedback({ type: "success", message: "Regra criada pausada. Revise e ative quando estiver pronta." });
  };

  const runNow = async (rule: AutomationRule) => {
    setRunningId(rule.id);
    const result = await executeAutomationRule(rule, tasks, apiConfig);
    setRunningId(null);
    setFeedback({ type: result.success ? "success" : "warning", message: result.message });
    const refreshed = storage.loadAppState<AutomationRule[]>(APP_STATE_KEYS.AUTOMATION_RULES, rules, AppStateSchemas.automationRules);
    setRules(refreshed);
  };

  const readyCount = rules.filter((rule) => evaluateAutomationRule(rule).ready).length;
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  const executionCount = rules.reduce((sum, rule) => sum + rule.executionCount, 0);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 font-sans">
      <header className="flex shrink-0 flex-col gap-3 border-b border-outline-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">Nisti Marketing</p><h1 className="mt-1 text-2xl font-black tracking-tight text-text-primary">Automações</h1><p className="mt-1 text-xs text-text-secondary">Regras persistidas, execução fail-closed e auditoria somente após confirmação do Obsidian.</p></div>
        <button onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" /> Nova regra</button>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Regras" value={rules.length} icon={<Zap className="h-4 w-4" />} /><Metric label="Ativas" value={enabledCount} icon={<CheckCircle2 className="h-4 w-4" />} /><Metric label="Prontas" value={readyCount} icon={<CheckSquare className="h-4 w-4" />} /><Metric label="Execuções confirmadas" value={executionCount} icon={<Play className="h-4 w-4" />} /></div>

      {feedback && <div className={`shrink-0 rounded-xl border px-4 py-3 text-xs ${feedback.type === "success" ? "border-success-sober/30 bg-success-sober/10 text-success-sober" : "border-warning-sober/30 bg-warning-sober/10 text-warning-sober"}`}>{feedback.message}</div>}

      {creating && <form onSubmit={saveRule} className="shrink-0 rounded-2xl border border-outline-border bg-surface-card p-4"><div className="grid gap-3 lg:grid-cols-2"><Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Ex.: Sincronizar tarefas às 09:00" /></Field><Field label="Descrição"><input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Descreva exatamente o efeito esperado" /></Field><Field label="Horário diário"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" /></Field><Field label="Ação"><select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className="input"><option value="create_tasks_in_daily_note">Sincronizar tarefas na Daily Note</option><option value="generate_status_report">Gerar relatório operacional</option></select></Field><Field label="Filtro de prioridade (opcional)"><select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="input"><option value="">Todas as pendentes</option><option value="urgent">Urgente</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></Field>{action === "generate_status_report" && <Field label="Caminho do relatório"><input value={path} onChange={(e) => setPath(e.target.value)} className="input" /></Field>}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-text-primary">Cancelar</button><button type="submit" className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-white">Criar pausada</button></div></form>}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
        {rules.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><Zap className="h-8 w-8 text-text-secondary" /><h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma automação configurada</h2><p className="mt-1 max-w-lg text-xs text-text-secondary">Não existem templates ativos por padrão. Crie uma regra explícita e ela nascerá pausada.</p></div> : <div className="grid gap-3 xl:grid-cols-2">{rules.map((rule) => {
          const readiness = evaluateAutomationRule(rule);
          return <article key={rule.id} className="rounded-xl border border-outline-border bg-surface-container-low p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${rule.enabled ? "bg-success-sober/10 text-success-sober" : "bg-outline-border/50 text-text-secondary"}`}>{rule.enabled ? "Ativa" : "Pausada"}</span><span className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${readiness.ready ? "bg-primary-container/10 text-primary-fixed-dim" : "bg-warning-sober/10 text-warning-sober"}`}>{readiness.ready ? "Pronta" : "Bloqueada"}</span></div><h2 className="mt-2 text-sm font-bold text-text-primary">{rule.name}</h2><p className="mt-1 text-xs leading-5 text-text-secondary">{rule.description}</p></div><label className="inline-flex items-center gap-2 text-[10px] text-text-secondary"><input type="checkbox" checked={rule.enabled} onChange={() => updateRules(rules.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item))} /> Ativar</label></div><div className="mt-3 rounded-lg border border-outline-border bg-surface-container-lowest p-3 text-[10px] text-text-secondary"><p><strong className="text-text-primary">Gatilho:</strong> {rule.trigger} • {rule.conditionParam || "sem parâmetros"}</p><p className="mt-1"><strong className="text-text-primary">Ação:</strong> {rule.action}</p><p className="mt-1"><strong className="text-text-primary">Execuções confirmadas:</strong> {rule.executionCount}{rule.lastRun ? ` • última: ${rule.lastRun}` : ""}</p>{readiness.blockers.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-warning-sober">{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</div><div className="mt-3 flex gap-2"><button onClick={() => runNow(rule)} disabled={runningId === rule.id || !rule.enabled} className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Play className="h-3.5 w-3.5" /> {runningId === rule.id ? "Executando..." : "Executar agora"}</button><button onClick={() => updateRules(rules.filter((item) => item.id !== rule.id))} className="rounded-lg border border-outline-border px-3 py-2 text-xs font-bold text-error-sober"><Trash2 className="h-3.5 w-3.5" /></button></div></article>;
        })}</div>}
      </div>

      <div className="shrink-0 rounded-xl border border-outline-border bg-surface-container-low px-4 py-3 text-[10px] leading-5 text-text-secondary"><strong className="text-text-primary">Runtime:</strong> apenas regras `daily_schedule` com `time=HH:MM` e ações suportadas são executadas automaticamente enquanto o aplicativo estiver aberto. Falha de conexão, parâmetro inválido ou gravação não confirmada interrompe a execução sem incrementar o contador.</div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => <div className="rounded-xl border border-outline-border bg-surface-card p-4"><div className="flex items-center justify-between text-text-secondary"><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>{icon}</div><p className="mt-2 font-mono text-2xl font-black text-text-primary">{value}</p></div>;
const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="flex justify-between gap-3"><span className="text-text-secondary">{label}</span><span className="text-right font-semibold text-text-primary">{value}</span></div>;
const EmptyTasks = () => <div className="flex min-h-48 flex-col items-center justify-center text-center"><CheckSquare className="h-8 w-8 text-text-secondary" /><p className="mt-2 text-xs font-bold text-text-primary">Nenhuma tarefa registrada</p></div>;
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{label}<div className="mt-1 [&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-outline-border [&_.input]:bg-surface-container-lowest [&_.input]:px-3 [&_.input]:py-2.5 [&_.input]:text-xs [&_.input]:font-normal [&_.input]:normal-case [&_.input]:tracking-normal [&_.input]:text-text-primary [&_.input]:outline-none">{children}</div></label>;
