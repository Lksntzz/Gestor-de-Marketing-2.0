import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  ExternalLink,
  Filter,
  FolderOpen,
  Plus,
} from "lucide-react";
import { MarketingTask, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";

interface ExecutionCommandCenterProps {
  tasks: MarketingTask[];
  onToggleTaskStatus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onSyncDailyNote: () => void;
  apiConfig: ObsidianApiConfig;
  isSyncingDaily: boolean;
}

type FilterMode = "all" | "urgent" | "reminders" | "done";
type SortMode = "priority" | "date";

const priorityRank: Record<MarketingTask["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function priorityLabel(priority: MarketingTask["priority"]) {
  if (priority === "urgent") return "URGENTE";
  if (priority === "high") return "ALTA";
  if (priority === "low") return "BAIXA";
  return "NORMAL";
}

function priorityClass(priority: MarketingTask["priority"]) {
  if (priority === "urgent") return "text-red-400 bg-red-950/50 border-red-700";
  if (priority === "high") return "text-amber-400 bg-amber-950/40 border-amber-700";
  if (priority === "low") return "text-slate-500 bg-[#263140] border-[#475569]";
  return "text-slate-400 bg-[#263140] border-[#475569]";
}

export const ExecutionCommandCenter: React.FC<ExecutionCommandCenterProps> = ({
  tasks,
  onToggleTaskStatus,
  onDeleteTask: _onDeleteTask,
  onOpenNewTaskModal,
  onSyncDailyNote,
  apiConfig,
  isSyncingDaily,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = todayKey();

  const pending = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const completedToday = useMemo(
    () => tasks.filter((task) => task.status === "done" && String(task.completedAt || "").slice(0, 10) === today),
    [tasks, today]
  );
  const urgent = useMemo(() => pending.filter((task) => task.priority === "urgent"), [pending]);
  const reminders = useMemo(() => pending.filter((task) => task.isReminderActive || Boolean(task.reminderTime)), [pending]);

  const visibleTasks = useMemo(() => {
    let list = tasks.filter((task) => {
      if (filterMode === "urgent") return task.status !== "done" && (task.priority === "urgent" || task.priority === "high");
      if (filterMode === "reminders") return task.status !== "done" && (task.isReminderActive || Boolean(task.reminderTime));
      if (filterMode === "done") return task.status === "done";
      return task.status !== "done";
    });

    list = list.slice().sort((a, b) => {
      if (sortMode === "priority") {
        const rankDiff = priorityRank[b.priority] - priorityRank[a.priority];
        if (rankDiff !== 0) return rankDiff;
      }
      const aDate = `${a.dueDate || "9999-12-31"} ${a.dueTime || "23:59"}`;
      const bDate = `${b.dueDate || "9999-12-31"} ${b.dueTime || "23:59"}`;
      return aDate.localeCompare(bDate);
    });
    return list;
  }, [tasks, filterMode, sortMode]);

  const spotlight = useMemo(() => {
    const source = pending.slice().sort((a, b) => {
      const rankDiff = priorityRank[b.priority] - priorityRank[a.priority];
      if (rankDiff !== 0) return rankDiff;
      const aDate = `${a.dueDate || "9999-12-31"} ${a.dueTime || "23:59"}`;
      const bDate = `${b.dueDate || "9999-12-31"} ${b.dueTime || "23:59"}`;
      return aDate.localeCompare(bDate);
    });
    return source.find((task) => task.id === selectedId) || source[0] || null;
  }, [pending, selectedId]);

  const dueLabel = (task: MarketingTask) => {
    if (!task.dueDate) return "Sem prazo";
    if (task.dueDate === today) return `Hoje${task.dueTime ? `, ${task.dueTime}` : ""}`;
    return `${task.dueDate}${task.dueTime ? `, ${task.dueTime}` : ""}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-7 font-sans overflow-y-auto">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50">Centro de Execução</h1>
            <p className="text-sm text-slate-400 mt-1">Gestão tática e acompanhamento das tarefas operacionais.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSyncDailyNote} disabled={isSyncingDaily} className="h-9 px-4 border border-[#334155] bg-[#182234] hover:bg-[#263140] disabled:opacity-50 text-xs font-semibold">
              {isSyncingDaily ? "Sincronizando..." : "Sync Daily"}
            </button>
            <button onClick={onOpenNewTaskModal} className="h-9 px-4 bg-[#2563eb] hover:bg-blue-500 text-xs font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Nova Tarefa</button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Pendentes" value={pending.length} icon={<FolderOpen className="w-5 h-5 text-slate-400" />} />
          <StatCard label="Concluídas Hoje" value={completedToday.length} valueClass="text-emerald-400" icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} />
          <StatCard label="Urgentes" value={urgent.length} valueClass="text-red-400" icon={<AlertTriangle className="w-5 h-5 text-red-400" />} />
          <StatCard label="Lembretes" value={reminders.length} valueClass="text-amber-400" icon={<Bell className="w-5 h-5 text-amber-400" />} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <select value={filterMode} onChange={(event) => setFilterMode(event.target.value as FilterMode)} className="h-9 pl-9 pr-8 bg-[#182234] border border-[#334155] text-xs text-slate-300 outline-none appearance-none">
              <option value="all">Pendentes</option><option value="urgent">Alta/Urgente</option><option value="reminders">Lembretes</option><option value="done">Concluídas</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-9 px-3 bg-[#182234] border border-[#334155] text-xs text-slate-300 outline-none">
            <option value="priority">Ordenar: Prioridade</option><option value="date">Ordenar: Prazo</option>
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] gap-6 min-h-[580px]">
          <section className="bg-[#182234] border border-[#334155] rounded-sm overflow-hidden">
            <div className="h-12 px-5 border-b border-[#334155] flex items-center justify-between">
              <h2 className="text-sm font-semibold">Fila de Execução</h2>
              <span className="text-xs text-slate-500">Mostrando {visibleTasks.length} de {tasks.length}</span>
            </div>
            <div className="divide-y divide-[#334155]">
              {visibleTasks.length ? visibleTasks.map((task) => {
                const active = spotlight?.id === task.id;
                return (
                  <button key={task.id} onClick={() => setSelectedId(task.id)} className={`w-full min-h-[64px] px-5 grid grid-cols-[28px_auto_auto_minmax(0,1fr)_auto] items-center gap-3 text-left border-l-4 transition-colors ${active ? "bg-[#1d2a40] border-l-blue-500" : task.priority === "urgent" ? "border-l-red-500 hover:bg-[#1c2637]" : task.priority === "high" ? "border-l-amber-500 hover:bg-[#1c2637]" : "border-l-blue-600/70 hover:bg-[#1c2637]"}`}>
                    <span onClick={(event) => { event.stopPropagation(); onToggleTaskStatus(task.id); }} className="w-4 h-4 border border-slate-400 bg-slate-100 hover:bg-white flex items-center justify-center"><Circle className="w-2 h-2 text-transparent" /></span>
                    <span className={`px-2 py-1 text-[9px] font-bold border rounded-sm ${priorityClass(task.priority)}`}>{priorityLabel(task.priority)}</span>
                    <span className="px-2 py-1 text-[9px] font-bold bg-[#263140] border border-[#475569] text-slate-400 rounded-sm uppercase">{task.channel || task.tags?.[0] || "GERAL"}</span>
                    <span className="truncate text-sm text-slate-100">{task.title}</span>
                    <span className={`text-xs font-mono whitespace-nowrap ${task.priority === "urgent" && task.dueDate === today ? "text-red-400" : "text-slate-400"}`}>{dueLabel(task)}</span>
                  </button>
                );
              }) : <div className="py-16 text-center text-sm text-slate-500">Nenhuma tarefa neste filtro.</div>}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="bg-[#182234] border border-[#334155] border-t-4 border-t-red-500 rounded-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Spotlight: Próxima Ação</p>
              {spotlight ? (
                <>
                  <h2 className="text-xl font-semibold text-slate-50 mt-5 leading-7">{spotlight.title}</h2>
                  <p className="text-sm text-slate-400 leading-6 mt-3">{spotlight.description || "Sem descrição adicional registrada."}</p>
                  <div className="mt-5 bg-[#111827] border border-[#334155] p-3 text-xs space-y-2">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Canal</span><span className="text-slate-200">{spotlight.channel || "Geral"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Prazo</span><span className={spotlight.priority === "urgent" ? "text-red-400" : "text-slate-200"}>{dueLabel(spotlight)}</span></div>
                    {spotlight.obsidianFilePath && <div className="flex justify-between gap-3"><span className="text-slate-500">Fonte PKM</span><span className="text-violet-300 truncate">{spotlight.obsidianFilePath}</span></div>}
                  </div>
                  <button onClick={() => onToggleTaskStatus(spotlight.id)} className="w-full h-11 mt-5 bg-[#2563eb] hover:bg-blue-500 text-sm font-semibold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Concluir Agora</button>
                  {spotlight.obsidianFilePath && (
                    <a href={buildObsidianOpenUri(apiConfig.vaultName, spotlight.obsidianFilePath)} className="w-full h-10 mt-2 border border-[#475569] hover:bg-[#263140] text-xs font-semibold text-slate-300 flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> Abrir Fonte no Obsidian</a>
                  )}
                </>
              ) : <p className="text-sm text-slate-500 mt-5">Sem próxima ação pendente.</p>}
            </div>

            <div className="bg-[#182234] border border-[#334155] rounded-sm p-5">
              <h3 className="text-xs font-bold text-slate-400">Notas Rápidas</h3>
              <div className="mt-4 min-h-[110px] bg-[#111827] border border-[#475569] p-3 text-xs font-mono leading-5 text-slate-400 whitespace-pre-wrap">
                {spotlight ? [spotlight.description, spotlight.tags?.length ? `Tags: ${spotlight.tags.join(", ")}` : "", spotlight.reminderDate ? `Lembrete: ${spotlight.reminderDate} ${spotlight.reminderTime || ""}` : ""].filter(Boolean).join("\n") || "Sem notas adicionais." : "Selecione uma tarefa na fila."}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">Somente leitura nesta tela; edite a origem para alterar o conteúdo.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; valueClass?: string }> = ({ label, value, icon, valueClass = "text-slate-50" }) => (
  <div className="min-h-[100px] bg-[#182234] border border-[#334155] rounded-sm p-4 flex items-center justify-between">
    <div><p className="text-[10px] uppercase tracking-[0.1em] font-bold text-slate-400">{label}</p><p className={`text-3xl font-semibold mt-2 ${valueClass}`}>{value}</p></div>{icon}
  </div>
);
