import React, { useState, useMemo } from "react";
import {
  CheckSquare,
  Clock,
  Zap,
  Plus,
  Calendar,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  Trash2,
  Send,
  Kanban,
  ListFilter,
  Check,
  Search,
  Sparkles,
  CheckCheck,
  Compass,
  ArrowRight,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { MarketingTask, AutomationRule, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import confetti from "canvas-confetti";

interface TasksAutomationViewProps {
  tasks: MarketingTask[];
  automationRules: AutomationRule[];
  onToggleTaskStatus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  onToggleRule: (ruleId: string) => void;
  onRunRuleNow: (ruleId: string) => void;
  onSyncDailyNote: () => void;
  apiConfig: ObsidianApiConfig;
  isSyncingDaily: boolean;
  initialSection?: "tasks" | "automations";
}

export const TasksAutomationView: React.FC<TasksAutomationViewProps> = ({
  tasks = [],
  automationRules = [],
  onToggleTaskStatus,
  onDeleteTask,
  onOpenNewTaskModal,
  onToggleRule,
  onRunRuleNow,
  onSyncDailyNote,
  apiConfig,
  isSyncingDaily,
  initialSection = "tasks",
}) => {
  // Navigation tabs: 'list' (default Things 3 / Linear style), 'kanban', 'automations'
  const [activeTab, setActiveTab] = useState<"list" | "kanban" | "automations">(
    initialSection === "automations" ? "automations" : "list"
  );
  const [filterMode, setFilterMode] = useState<"all" | "high_urgent" | "in_progress" | "reminders" | "done">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Filter tasks based on search & quick pills
  const filteredTasks = useMemo(() => {
    const query = (searchQuery || "").toLowerCase().trim();
    return tasks.filter((t) => {
      // Search filter
      const matchSearch =
        !query ||
        (t.title || "").toLowerCase().includes(query) ||
        (t.description || "").toLowerCase().includes(query) ||
        (t.channel || "").toLowerCase().includes(query);

      if (!matchSearch) return false;

      // Category / Status Filter
      if (filterMode === "high_urgent") {
        return t.status !== "done" && (t.priority === "urgent" || t.priority === "high");
      }
      if (filterMode === "in_progress") {
        return t.status === "in-progress";
      }
      if (filterMode === "reminders") {
        return t.isReminderActive || !!t.reminderTime;
      }
      if (filterMode === "done") {
        return t.status === "done";
      }
      return true; // 'all'
    });
  }, [tasks, filterMode, searchQuery]);

  // Counts
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);
  const urgentCount = useMemo(
    () => tasks.filter((t) => t.status !== "done" && (t.priority === "urgent" || t.priority === "high")).length,
    [tasks]
  );
  const remindersCount = useMemo(
    () => tasks.filter((t) => t.isReminderActive || !!t.reminderTime).length,
    [tasks]
  );

  // Next Action (Single most urgent / prioritized pending task)
  const nextActionTask = useMemo(() => {
    if (pendingTasks.length === 0) return null;
    const urgent = pendingTasks.find((t) => t.priority === "urgent");
    if (urgent) return urgent;
    const inProg = pendingTasks.find((t) => t.status === "in-progress");
    if (inProg) return inProg;
    const high = pendingTasks.find((t) => t.priority === "high");
    if (high) return high;
    return pendingTasks[0];
  }, [pendingTasks]);

  // Kanban buckets
  const todoList = useMemo(() => filteredTasks.filter((t) => t.status === "todo"), [filteredTasks]);
  const inProgressList = useMemo(() => filteredTasks.filter((t) => t.status === "in-progress"), [filteredTasks]);
  const doneList = useMemo(() => filteredTasks.filter((t) => t.status === "done"), [filteredTasks]);

  // Handle task complete with subtle celebration
  const handleTaskCheck = (taskId: string) => {
    onToggleTaskStatus(taskId);
    confetti({
      particleCount: 28,
      spread: 45,
      origin: { y: 0.8 },
      colors: ["#7c3aed", "#10b981", "#3b82f6"],
    });
  };

  // Quick Copy Task Syntax
  const handleCopyTaskSyntax = (syntax: string, id: string) => {
    navigator.clipboard.writeText(syntax);
    setCopiedTaskId(id);
    setTimeout(() => setCopiedTaskId(null), 1800);
  };

  // Copy All Markdown
  const handleCopyAllMarkdown = () => {
    const markdown = tasks.map((t) => t.obsidianTaskString).join("\n");
    navigator.clipboard.writeText(markdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // FRIENDLY AUTOMATION TEMPLATES WITH CLEAR OUTCOMES (NO CRYPTIC JARGON)
  const friendlyAutomationTemplates = [
    {
      id: "rule_daily_sync",
      name: "Sincronizador da Nota Diária",
      result: "Envia automaticamente todas as tarefas do dia para o seu arquivo Daily Notes/YYYY-MM-DD.md no Obsidian.",
      frequency: "Ao clicar ou diariamente",
      tag: "Rotina Diária",
      color: "border-purple-200 bg-purple-50/40 text-purple-800",
    },
    {
      id: "rule_auto_tasks",
      name: "Gerador de Subtarefas por Campanha",
      result: "Cria automaticamente tarefas de copy, design de criativo e agendamento assim que uma campanha é sintetizada.",
      frequency: "Automático no disparo",
      tag: "Planejamento",
      color: "border-emerald-200 bg-emerald-50/40 text-emerald-800",
    },
    {
      id: "rule_vault_audit",
      name: "Auditoria e Indexação Contínua",
      result: "Mapeia diretrizes de tom e personas no cofre para que o Motor Local gere conteúdos sem consumir tokens.",
      frequency: "A cada alteração no cofre",
      tag: "Conhecimento PKM",
      color: "border-amber-200 bg-amber-50/40 text-amber-800",
    },
  ];

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-7 pb-20 animate-fadeIn">
      
      {/* 1. HEADER: CENTRO DE EXECUÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 uppercase tracking-wider">
              {pendingTasks.length} Pendentes • {completedTasks.length} Concluídas
            </span>
            <span className="text-xs text-stone-400 font-medium">
              Sincronizado com Obsidian Tasks
            </span>
          </div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight mt-1">
            {activeTab === "automations" ? "Modelos de Automação" : "Centro de Execução"}
          </h1>
          <p className="text-xs text-stone-500">
            {activeTab === "automations"
              ? "Regras simplificadas para manter seu cofre e rotinas sincronizados com zero atrito."
              : "Foco no que importa agora com sincronização bidirecional em Markdown."}
          </p>
        </div>

        {/* Action Controls & Primary CTA */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            onClick={onSyncDailyNote}
            disabled={isSyncingDaily}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-all border border-stone-200/80 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Insere todas as tarefas pendentes na Daily Note de hoje"
          >
            <Send className="w-3.5 h-3.5 text-stone-500" />
            <span>{isSyncingDaily ? "Sincronizando..." : "Sincronizar Daily Note"}</span>
          </button>

          <button
            onClick={onOpenNewTaskModal}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>+ Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* 2. CARD DE "PRÓXIMA AÇÃO" (SPOTLIGHT / THINGS 3 INSPIRATION) */}
      {activeTab !== "automations" && (
        nextActionTask ? (
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-7 shadow-xs relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                  Próxima Ação Prioritária
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {nextActionTask.dueDate && (
                  <span className="text-stone-500 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200 font-mono text-[11px]">
                    📅 {nextActionTask.dueDate} {nextActionTask.dueTime ? `às ${nextActionTask.dueTime}` : ""}
                  </span>
                )}
                {nextActionTask.channel && (
                  <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-150 font-medium text-[11px]">
                    #{nextActionTask.channel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4 pt-1">
              <button
                onClick={() => handleTaskCheck(nextActionTask.id)}
                className="mt-0.5 w-6 h-6 rounded-lg border-2 border-stone-300 hover:border-purple-600 bg-white hover:bg-purple-50 text-transparent hover:text-purple-600 flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="Concluir tarefa agora"
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="space-y-1.5 flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-snug">
                  {nextActionTask.title}
                </h2>
                {nextActionTask.description && (
                  <p className="text-xs text-stone-600 leading-relaxed font-sans">
                    {nextActionTask.description}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions for Next Action */}
            <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTaskCheck(nextActionTask.id)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir Agora</span>
                </button>

                <button
                  onClick={() => handleCopyTaskSyntax(nextActionTask.obsidianTaskString, nextActionTask.id)}
                  className="px-3 py-1.5 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium rounded-lg border border-stone-200 transition-all flex items-center gap-1 cursor-pointer font-mono"
                >
                  <Copy className="w-3 h-3 text-stone-400" />
                  <span>{copiedTaskId === nextActionTask.id ? "Copiado!" : "Copiar .md"}</span>
                </button>
              </div>

              {nextActionTask.obsidianFilePath && (
                <a
                  href={buildObsidianOpenUri(apiConfig.vaultName, nextActionTask.obsidianFilePath)}
                  className="text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1 text-[11px]"
                  title="Abrir nota de origem no Obsidian"
                >
                  <span>Abrir no Obsidian</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          /* ESTADO VAZIO PROPOSITIVO & AMIGÁVEL */
          <div className="bg-white rounded-3xl border border-stone-200/80 p-8 text-center space-y-4 shadow-3xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200/60">
              <CheckCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-stone-900">
                Tudo em dia! ✨
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Você não possui tarefas pendentes no momento. Que tal sintetizar uma nova campanha de marketing ou sincronizar suas Daily Notes?
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={onOpenNewTaskModal}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
              >
                + Criar Nova Tarefa
              </button>
              <button
                onClick={onSyncDailyNote}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl border border-stone-200 transition-all cursor-pointer"
              >
                Sincronizar Daily Note
              </button>
            </div>
          </div>
        )
      )}

      {/* 3. VIEW SWITCHER & QUICK FILTERS */}
      <div className="space-y-3">
        {/* Main View Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center bg-stone-100/80 p-1 rounded-xl border border-stone-200/80 self-start">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "list"
                  ? "bg-white text-stone-900 shadow-3xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Lista de Tarefas</span>
            </button>
            <button
              onClick={() => setActiveTab("kanban")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kanban"
                  ? "bg-white text-stone-900 shadow-3xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Quadro Kanban</span>
            </button>
            <button
              onClick={() => setActiveTab("automations")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "automations"
                  ? "bg-white text-stone-900 shadow-3xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>Modelos de Automação ({automationRules.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          {activeTab !== "automations" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar tarefas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-purple-500 w-44 sm:w-56"
                />
              </div>

              <button
                onClick={handleCopyAllMarkdown}
                className="p-2 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl transition-all cursor-pointer"
                title="Copiar todas as tarefas em formato Markdown do Obsidian"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Filter Pills for Tasks (List & Kanban) */}
        {activeTab !== "automations" && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50"
              }`}
            >
              Todas ({tasks.length})
            </button>
            <button
              onClick={() => setFilterMode("high_urgent")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === "high_urgent"
                  ? "bg-rose-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Alta / Urgente ({urgentCount})</span>
            </button>
            <button
              onClick={() => setFilterMode("in_progress")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === "in_progress"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50"
              }`}
            >
              Em Andamento ({inProgressList.length})
            </button>
            <button
              onClick={() => setFilterMode("reminders")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === "reminders"
                  ? "bg-amber-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50"
              }`}
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Lembretes ({remindersCount})</span>
            </button>
            <button
              onClick={() => setFilterMode("done")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === "done"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50"
              }`}
            >
              Concluídas ({completedTasks.length})
            </button>
          </div>
        )}
      </div>

      {/* 4. MAIN CONTENT VIEWS */}

      {/* A) LIST VIEW */}
      {activeTab === "list" && (
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-3xs divide-y divide-stone-100 overflow-hidden">
          {filteredTasks.map((task) => {
            const isDone = task.status === "done";
            const isUrgent = task.priority === "urgent";
            const isHigh = task.priority === "high";

            return (
              <div
                key={task.id}
                className={`p-4 sm:px-6 flex items-center justify-between gap-3 group transition-colors ${
                  isDone ? "bg-stone-50/40 opacity-70" : "hover:bg-stone-50/60"
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  {/* Custom Checkbox */}
                  <button
                    onClick={() => handleTaskCheck(task.id)}
                    className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                      isDone
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-stone-300 hover:border-purple-600 bg-white"
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isDone ? "line-through text-stone-400" : "text-stone-900"
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Priority Dot/Pill */}
                      {isUrgent && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                          Urgente
                        </span>
                      )}
                      {isHigh && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                          Alta
                        </span>
                      )}
                    </div>

                    {/* Metadata Subline */}
                    <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-0.5">
                      {task.dueDate && (
                        <span className="flex items-center gap-1 font-mono text-stone-500">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>{task.dueDate}</span>
                        </span>
                      )}
                      {task.reminderTime && (
                        <span className="flex items-center gap-1 font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>{task.reminderTime}</span>
                        </span>
                      )}
                      {task.channel && (
                        <span className="text-stone-500 font-medium">#{task.channel}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopyTaskSyntax(task.obsidianTaskString, task.id)}
                    className="p-1.5 text-stone-400 hover:text-stone-900 bg-transparent hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                    title="Copiar sintaxe Markdown do Obsidian"
                  >
                    {copiedTaskId === task.id ? (
                      <span className="text-[10px] font-mono text-purple-700 font-bold">Copiado!</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {task.obsidianFilePath && (
                    <a
                      href={buildObsidianOpenUri(apiConfig.vaultName, task.obsidianFilePath)}
                      className="p-1.5 text-stone-400 hover:text-purple-600 rounded-lg transition-colors"
                      title="Abrir nota vinculada no Obsidian"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Excluir tarefa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="py-12 text-center text-stone-400 space-y-2">
              <CheckSquare className="w-7 h-7 text-stone-300 mx-auto" />
              <p className="text-xs font-medium text-stone-600">Nenhuma tarefa encontrada neste filtro.</p>
            </div>
          )}
        </div>
      )}

      {/* B) KANBAN VIEW */}
      {activeTab === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column: Todo */}
          <div className="bg-stone-50/60 rounded-3xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
              <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                A Fazer ({todoList.length})
              </span>
            </div>
            <div className="space-y-2">
              {todoList.map((task) => (
                <div
                  key={task.id}
                  className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-3xs space-y-2 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => handleTaskCheck(task.id)}
                      className="mt-0.5 w-4 h-4 rounded border border-stone-300 hover:border-purple-600 bg-white flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Check className="w-2.5 h-2.5 text-transparent hover:text-purple-600" />
                    </button>
                    <span className="text-xs font-semibold text-stone-900 leading-snug">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                    <span>{task.dueDate || "Sem data"}</span>
                    <button
                      onClick={() => handleCopyTaskSyntax(task.obsidianTaskString, task.id)}
                      className="text-purple-700 hover:underline font-mono"
                    >
                      {copiedTaskId === task.id ? "Copiado!" : "Copiar .md"}
                    </button>
                  </div>
                </div>
              ))}
              {todoList.length === 0 && (
                <p className="text-center py-6 text-[11px] text-stone-400">Sem tarefas pendentes.</p>
              )}
            </div>
          </div>

          {/* Column: In Progress */}
          <div className="bg-stone-50/60 rounded-3xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                Em Andamento ({inProgressList.length})
              </span>
            </div>
            <div className="space-y-2">
              {inProgressList.map((task) => (
                <div
                  key={task.id}
                  className="bg-white p-3.5 rounded-2xl border border-purple-200/80 shadow-3xs space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => handleTaskCheck(task.id)}
                      className="mt-0.5 w-4 h-4 rounded border border-purple-400 bg-purple-50 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Check className="w-2.5 h-2.5 text-purple-700" />
                    </button>
                    <span className="text-xs font-semibold text-stone-900 leading-snug">
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                    <span>{task.dueDate || "Hoje"}</span>
                    <button
                      onClick={() => handleCopyTaskSyntax(task.obsidianTaskString, task.id)}
                      className="text-purple-700 hover:underline font-mono"
                    >
                      {copiedTaskId === task.id ? "Copiado!" : "Copiar .md"}
                    </button>
                  </div>
                </div>
              ))}
              {inProgressList.length === 0 && (
                <p className="text-center py-6 text-[11px] text-stone-400">Nenhuma em andamento.</p>
              )}
            </div>
          </div>

          {/* Column: Done */}
          <div className="bg-stone-50/60 rounded-3xl p-4 border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-200/60">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Concluído ({doneList.length})
              </span>
            </div>
            <div className="space-y-2">
              {doneList.map((task) => (
                <div
                  key={task.id}
                  className="bg-white/80 p-3.5 rounded-2xl border border-stone-200/60 opacity-70 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-xs font-medium text-stone-500 line-through leading-snug">
                      {task.title}
                    </span>
                  </div>
                </div>
              ))}
              {doneList.length === 0 && (
                <p className="text-center py-6 text-[11px] text-stone-400">Nenhuma concluída.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* C) AUTOMAÇÕES: MODELOS AMIGÁVEIS E RESULTADO CLARO (NO JARGON) */}
      {activeTab === "automations" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-7 shadow-3xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span>Modelos de Automação Inteligentes</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Escolha os fluxos que devem rodar em segundo plano no seu cofre Obsidian com total segurança.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {friendlyAutomationTemplates.map((template, idx) => {
                const rule = automationRules[idx] || {
                  id: template.id,
                  name: template.name,
                  enabled: true,
                  executionCount: 12 + idx * 5,
                };

                return (
                  <div
                    key={template.id}
                    className="p-5 rounded-2xl border border-stone-200/80 bg-white shadow-3xs flex flex-col justify-between space-y-4 hover:border-purple-300 transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${template.color}`}>
                          {template.tag}
                        </span>

                        {/* Toggle Switch */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={() => onToggleRule(rule.id)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-3.5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      <h3 className="text-xs font-bold text-stone-900 leading-snug">
                        {template.name}
                      </h3>

                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        {template.result}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                      <span className="text-[10px] font-mono">{template.frequency}</span>
                      <button
                        onClick={() => onRunRuleNow(rule.id)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-purple-50 text-stone-700 hover:text-purple-900 font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>Executar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
