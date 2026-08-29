import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type {
  MarketingTask,
  ObsidianApiConfig,
  TaskPriority,
} from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import {
  buildExecutionSnapshot,
  classifyTask,
  editorialIdFromTask,
  formatTaskDueLabel,
  isEditorialTask,
  moveTaskToNextDay,
  taskMatchesSearch,
} from "../utils/executionIntelligence";

type FilterMode =
  | "all"
  | "overdue"
  | "today"
  | "in_progress"
  | "upcoming"
  | "unscheduled"
  | "done";

interface ExecutionTasksViewProps {
  tasks: MarketingTask[];
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask?: (task: MarketingTask) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onPublishEditorialTask?: (taskId: string) => Promise<void>;
  onOpenPlanning?: () => void;
  apiConfig: ObsidianApiConfig;
}

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

export const ExecutionTasksView: React.FC<ExecutionTasksViewProps> = ({
  tasks = [],
  onToggleTaskStatus,
  onUpdateTask,
  onDeleteTask,
  onOpenNewTaskModal,
  onPublishEditorialTask,
  onOpenPlanning,
  apiConfig,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [publishingTaskId, setPublishingTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  const snapshot = useMemo(() => buildExecutionSnapshot(tasks, now), [tasks, minuteKey]);
  const isConnected = apiConfig.connectionStatus === "connected";

  const orderedTasks = useMemo(() => {
    const upcoming = snapshot.pending.filter(
      (task) => classifyTask(task, snapshot.today) === "upcoming"
    );
    const unscheduled = snapshot.pending.filter(
      (task) => classifyTask(task, snapshot.today) === "unscheduled"
    );

    return uniqueTasks([
      snapshot.overdue,
      snapshot.dueToday,
      snapshot.inProgress,
      upcoming,
      unscheduled,
      snapshot.completed,
    ]);
  }, [snapshot]);

  const filteredTasks = useMemo(() => {
    return orderedTasks.filter((task) => {
      if (!taskMatchesSearch(task, searchQuery)) return false;

      const bucket = classifyTask(task, snapshot.today);
      if (filterMode === "overdue") return bucket === "overdue";
      if (filterMode === "today") return bucket === "today";
      if (filterMode === "in_progress") return task.status === "in-progress";
      if (filterMode === "upcoming") return bucket === "upcoming";
      if (filterMode === "unscheduled") return bucket === "unscheduled";
      if (filterMode === "done") return task.status === "done";
      return true;
    });
  }, [filterMode, orderedTasks, searchQuery, snapshot.today]);

  const activeTask = useMemo(() => {
    if (selectedTaskId) {
      const selected = tasks.find((task) => task.id === selectedTaskId);
      if (selected) return selected;
    }
    return snapshot.nextAction;
  }, [selectedTaskId, snapshot.nextAction, tasks]);

  const activeEditorialId = activeTask ? editorialIdFromTask(activeTask) : null;

  const updateTask = (task: MarketingTask, patch: Partial<MarketingTask>) => {
    if (!onUpdateTask || isEditorialTask(task)) return;
    onUpdateTask({ ...task, ...patch });
  };

  const handleStartTask = (task: MarketingTask) => {
    if (task.status !== "todo" || !onUpdateTask || isEditorialTask(task)) return;
    updateTask(task, { status: "in-progress" });
  };

  const handleDeferTask = (task: MarketingTask) => {
    if (!onUpdateTask || task.status === "done" || isEditorialTask(task)) return;
    onUpdateTask(moveTaskToNextDay(task));
  };

  const handleDeleteTask = (taskId: string) => {
    if (isEditorialTask(taskId)) return;
    onDeleteTask(taskId);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  const handlePublishEditorialTask = async (task: MarketingTask) => {
    if (!onPublishEditorialTask || !isEditorialTask(task) || task.status === "done") return;
    setPublishingTaskId(task.id);
    setActionError("");
    try {
      await onPublishEditorialTask(task.id);
    } catch (error: any) {
      setActionError(error?.message || "Não foi possível marcar a publicação como concluída.");
    } finally {
      setPublishingTaskId(null);
    }
  };

  const renderTaskRow = (task: MarketingTask) => {
    const bucket = classifyTask(task, snapshot.today);
    const isActive = activeTask?.id === task.id;
    const editorial = isEditorialTask(task);

    return (
      <button
        key={task.id}
        type="button"
        onClick={() => {
          setSelectedTaskId(task.id);
          setActionError("");
        }}
        className={`w-full text-left rounded-xl border p-3 transition-colors ${
          isActive
            ? "border-primary-container bg-primary-container/10"
            : "border-outline-border bg-surface-card hover:bg-surface-elevated"
        }`}
      >
        <div className="flex items-start gap-3">
          {editorial ? (
            <span
              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                task.status === "done"
                  ? "bg-success-sober border-success-sober text-white"
                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
              }`}
              title={task.status === "done" ? "Publicação registrada" : "Tarefa vinculada ao calendário"}
            >
              {task.status === "done" ? <Check className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onToggleTaskStatus(task.id);
              }}
              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                task.status === "done"
                  ? "bg-success-sober border-success-sober text-white"
                  : "border-outline-border text-transparent hover:border-primary-container"
              }`}
              role="checkbox"
              aria-checked={task.status === "done"}
              aria-label={task.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-sm font-semibold ${
                  task.status === "done"
                    ? "line-through text-text-secondary"
                    : "text-text-primary"
                }`}
              >
                {task.title}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityClasses[task.priority]}`}>
                {priorityLabels[task.priority]}
              </span>
              {editorial && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300">
                  Calendário
                </span>
              )}
              {!editorial && task.status === "in-progress" && (
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
                <span className="truncate max-w-[280px]">Fonte: {task.obsidianFilePath}</span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 animate-fadeIn font-sans">
      <header className="shrink-0 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 border-b border-outline-border pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary">Execução</h1>
          <p className="mt-1 text-xs text-text-secondary max-w-3xl">
            Uma fila única para executar o trabalho. Publicações mantêm o Calendário como fonte de verdade para data e status editorial.
          </p>
          {!isConnected && (
            <p className="mt-2 text-[10px] text-amber-300">
              Base desconectada: tarefas locais continuam disponíveis; apenas ações que abrem fontes no Obsidian ficam indisponíveis.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className="px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova tarefa
        </button>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <button type="button" onClick={() => setFilterMode("overdue")} className="rounded-xl border border-outline-border bg-surface-card p-3.5 text-left">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Vencidas</span><AlertTriangle className="w-4 h-4 text-error-sober" /></div>
          <div className="mt-2 text-2xl font-black text-text-primary">{snapshot.overdue.length}</div>
        </button>
        <button type="button" onClick={() => setFilterMode("today")} className="rounded-xl border border-outline-border bg-surface-card p-3.5 text-left">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Para hoje</span><Clock3 className="w-4 h-4 text-warning-sober" /></div>
          <div className="mt-2 text-2xl font-black text-text-primary">{snapshot.dueToday.length}</div>
        </button>
        <button type="button" onClick={() => setFilterMode("in_progress")} className="rounded-xl border border-outline-border bg-surface-card p-3.5 text-left">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Em andamento</span><Play className="w-4 h-4 text-primary-fixed-dim" /></div>
          <div className="mt-2 text-2xl font-black text-text-primary">{snapshot.inProgress.length}</div>
        </button>
        <button type="button" onClick={() => setFilterMode("done")} className="rounded-xl border border-outline-border bg-surface-card p-3.5 text-left">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">Concluídas</span><CheckCircle2 className="w-4 h-4 text-success-sober" /></div>
          <div className="mt-2 text-2xl font-black text-text-primary">{snapshot.completed.length}</div>
        </button>
      </section>

      <section className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar tarefa" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-outline-border bg-surface-card text-xs text-text-primary outline-none focus:border-primary-container" />
        </div>
        <select value={filterMode} onChange={(event) => setFilterMode(event.target.value as FilterMode)} className="px-3 py-2.5 rounded-xl border border-outline-border bg-surface-card text-xs text-text-primary outline-none">
          <option value="all">Todas as tarefas</option>
          <option value="overdue">Vencidas</option>
          <option value="today">Hoje</option>
          <option value="in_progress">Em andamento</option>
          <option value="upcoming">Próximas</option>
          <option value="unscheduled">Sem prazo</option>
          <option value="done">Concluídas</option>
        </select>
      </section>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-3 space-y-2">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(renderTaskRow)
          ) : (
            <div className="h-full min-h-52 flex flex-col items-center justify-center text-center px-4">
              <CheckCircle2 className="w-8 h-8 text-text-secondary/50" />
              <h2 className="mt-3 text-sm font-bold text-text-primary">Nenhuma tarefa neste filtro</h2>
              <p className="mt-1 text-xs text-text-secondary max-w-sm">A lista mostra somente tarefas realmente registradas. Altere o filtro ou crie uma nova tarefa.</p>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto rounded-2xl border border-outline-border bg-surface-card p-4">
          {activeTask ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                  {activeEditorialId ? "Publicação selecionada" : "Tarefa selecionada"}
                </span>
                <h2 className="mt-1 text-lg font-black text-text-primary">{activeTask.title}</h2>
                {activeTask.description && <p className="mt-2 text-xs leading-5 text-text-secondary">{activeTask.description}</p>}
              </div>

              {activeEditorialId && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-[11px] text-text-secondary">
                  <strong className="block text-indigo-300">Vinculada ao Calendário</strong>
                  <span className="mt-1 block">Data, prioridade, exclusão e status editorial são alterados no Planejamento para evitar duas fontes de verdade.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-outline-border p-2.5"><span className="block text-text-secondary">Prazo</span><strong className="text-text-primary">{formatTaskDueLabel(activeTask, now)}</strong></div>
                <div className="rounded-lg border border-outline-border p-2.5"><span className="block text-text-secondary">Prioridade</span><strong className="text-text-primary">{priorityLabels[activeTask.priority]}</strong></div>
              </div>

              {activeTask.channel && (
                <div className="rounded-lg border border-outline-border p-2.5 text-[11px]"><span className="block text-text-secondary">Canal</span><strong className="text-text-primary">{activeTask.channel}</strong></div>
              )}

              {activeTask.obsidianFilePath && (
                <div className="rounded-lg border border-outline-border p-2.5 text-[11px]"><span className="block text-text-secondary">Fonte vinculada</span><strong className="text-text-primary break-all">{activeTask.obsidianFilePath}</strong></div>
              )}

              {actionError && (
                <div className="rounded-xl border border-error-sober/25 bg-error-sober/10 p-3 text-[11px] text-error-sober">
                  {actionError}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-outline-border">
                {activeEditorialId ? (
                  <>
                    {activeTask.status !== "done" && onPublishEditorialTask && (
                      <button
                        type="button"
                        disabled={publishingTaskId === activeTask.id}
                        onClick={() => void handlePublishEditorialTask(activeTask)}
                        className="w-full px-3 py-2.5 rounded-xl bg-success-sober text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {publishingTaskId === activeTask.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Marcar como publicado
                      </button>
                    )}
                    {onOpenPlanning && (
                      <button
                        type="button"
                        onClick={onOpenPlanning}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        Ajustar no calendário
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {activeTask.status === "todo" && onUpdateTask && (
                      <button type="button" onClick={() => handleStartTask(activeTask)} className="w-full px-3 py-2.5 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-1.5">
                        <Play className="w-3.5 h-3.5" /> Iniciar tarefa
                      </button>
                    )}
                    {activeTask.status !== "done" && onUpdateTask && (
                      <button type="button" onClick={() => handleDeferTask(activeTask)} className="w-full px-3 py-2.5 rounded-xl border border-outline-border text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" /> Mover para amanhã
                      </button>
                    )}
                    <button type="button" onClick={() => onToggleTaskStatus(activeTask.id)} className="w-full px-3 py-2.5 rounded-xl border border-outline-border text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> {activeTask.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"}
                    </button>
                  </>
                )}

                {activeTask.obsidianFilePath && isConnected && apiConfig.vaultName && (
                  <a href={buildObsidianOpenUri(apiConfig.vaultName, activeTask.obsidianFilePath)} className="w-full px-3 py-2.5 rounded-xl border border-outline-border text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir fonte no Obsidian
                  </a>
                )}

                {!activeEditorialId && (
                  <button type="button" onClick={() => handleDeleteTask(activeTask.id)} className="w-full px-3 py-2.5 rounded-xl border border-error-sober/30 text-error-sober text-xs font-semibold flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir tarefa
                  </button>
                )}
              </div>

              {snapshot.nextAction?.id === activeTask.id && activeTask.status !== "done" && (
                <div className="rounded-xl border border-primary-container/20 bg-primary-container/5 p-3 text-[11px] text-text-secondary">
                  <div className="flex items-center gap-1.5 font-bold text-text-primary">Próxima ação operacional <ArrowRight className="w-3.5 h-3.5" /></div>
                  <p className="mt-1">Esta é a primeira tarefa da fila calculada por prazo e prioridade registrados.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-48 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-8 h-8 text-text-secondary/50" />
              <h2 className="mt-3 text-sm font-bold text-text-primary">Fila vazia</h2>
              <p className="mt-1 text-xs text-text-secondary">Crie uma tarefa para iniciar a execução.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
