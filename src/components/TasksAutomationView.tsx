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
  Bell,
  Trash,
} from "lucide-react";
import { MarketingTask, AutomationRule, ObsidianApiConfig } from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import confetti from "canvas-confetti";

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
  // Navigation tabs: 'list' (default Things 3 / Linear style), 'kanban', 'automations'
  const [activeTab, setActiveTab] = useState<"list" | "kanban" | "automations">(
    initialSection === "automations" ? "automations" : "list"
  );
  const [filterMode, setFilterMode] = useState<"all" | "high_urgent" | "in_progress" | "reminders" | "done">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Selected task for the spotlight sidebar (defaults to null, which resolves to the first high-priority pending task)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Editable local Quick Notes that persist across sessions
  const [quickNotes, setQuickNotes] = useState<string>(
    () =>
      localStorage.getItem("nisti_pkm_quick_notes") ||
      `> Verificar taxa de conversão esperada.\n> Alinhar com time de tráfego sobre o delay na aprovação.\n_`
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuickNotes(val);
    localStorage.setItem("nisti_pkm_quick_notes", val);
  };

  // Helper function to format due dates nicely in Portuguese
  const formatDueDate = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return "Sem prazo";
    const today = "2026-08-26";
    const tomorrow = "2026-08-27";
    const friday = "2026-08-28";

    if (dateStr === today) {
      return `Hoje${timeStr ? `, ${timeStr}` : ""}`;
    }
    if (dateStr === tomorrow) {
      return `Amanhã${timeStr ? `, ${timeStr}` : ""}`;
    }
    if (dateStr === friday) {
      return `Sexta${timeStr ? `, ${timeStr}` : ""}`;
    }

    // Format YYYY-MM-DD into a nicer Portuguese date
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const day = parts[2];
      const month = parts[1];
      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthIndex = parseInt(month, 10) - 1;
      const monthName = months[monthIndex] || month;
      return `${day} de ${monthName}${timeStr ? `, ${timeStr}` : ""}`;
    }
    return `${dateStr}${timeStr ? `, ${timeStr}` : ""}`;
  };

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

  // Real data calculations (Calculos de Dados Reais)
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);
  const urgentTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && (t.priority === "urgent" || t.priority === "high")),
    [tasks]
  );
  const reminderTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && (t.isReminderActive || !!t.reminderTime)),
    [tasks]
  );

  const urgentCount = urgentTasks.length;
  const remindersCount = reminderTasks.length;

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

  // Spotlight active task (selectedTaskId if found, else nextActionTask)
  const activeSpotlightTask = useMemo(() => {
    if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return nextActionTask;
  }, [tasks, selectedTaskId, nextActionTask]);

  // Kanban buckets based on current real tasks list
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
      colors: ["#2563eb", "#10b981", "#3b82f6"],
    });
  };

  // Defer active task to tomorrow
  const handleDeferTaskToTomorrow = (task: MarketingTask) => {
    if (!onUpdateTask) return;
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    onUpdateTask({
      ...task,
      dueDate: tomorrowStr,
      obsidianTaskString: (task.obsidianTaskString || "").replace(/\d{4}-\d{2}-\d{2}/, tomorrowStr),
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
      color: "border-purple-600/30 bg-purple-600/10 text-purple-300",
    },
    {
      id: "rule_auto_tasks",
      name: "Gerador de Subtarefas por Campanha",
      result: "Cria automaticamente tarefas de copy, design de criativo e agendamento assim que uma campanha é sintetizada.",
      frequency: "Automático no disparo",
      tag: "Planejamento",
      color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
    {
      id: "rule_vault_audit",
      name: "Auditoria e Indexação Contínua",
      result: "Mapeia diretrizes de tom e personas no cofre para que o Motor Local gere conteúdos sem consumir tokens.",
      frequency: "A cada alteração no cofre",
      tag: "Conhecimento PKM",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-fadeIn font-sans min-h-0">
      {/* 1. HEADER: CENTRO DE EXECUÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 shrink-0 border-b border-outline-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-text-primary bg-primary-container/15 px-2 py-0.5 rounded border border-primary-container/30 uppercase tracking-wider">
              {pendingTasks.length} Pendentes • {completedTasks.length} Concluídas
            </span>
            <span className="text-xs text-text-secondary font-medium">
              Sincronizado com Obsidian Tasks
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight mt-1.5">
            {activeTab === "automations" ? "Modelos de Automação" : "Centro de Execução"}
          </h1>
          <p className="text-xs text-text-secondary">
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
            className="px-3.5 py-2 bg-surface-card hover:bg-surface-elevated text-text-primary text-xs font-semibold rounded-xl transition-all border border-outline-border flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Insere todas as tarefas pendentes na Daily Note de hoje"
          >
            <Send className="w-3.5 h-3.5 text-primary-fixed-dim" />
            <span>{isSyncingDaily ? "Sincronizando..." : "Sincronizar Daily Note"}</span>
          </button>

          <button
            onClick={onOpenNewTaskModal}
            className="px-4 py-2 bg-primary-container hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            <span>+ Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* 2. REAL METRIC CARDS (CARD DE MÉTRICAS REAIS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        {/* Card 1: Pendentes */}
        <div className="bg-surface-card border border-outline-border p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Pendentes</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-text-primary font-mono">{pendingTasks.length}</span>
            <CheckSquare className="w-5 h-5 text-text-secondary" />
          </div>
        </div>

        {/* Card 2: Concluídas */}
        <div className="bg-surface-card border border-outline-border p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Concluídas</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-success-sober font-mono">{completedTasks.length}</span>
            <CheckCircle2 className="w-5 h-5 text-success-sober" />
          </div>
        </div>

        {/* Card 3: Urgentes */}
        <div className="bg-surface-card border border-outline-border p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Urgentes</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-error-sober font-mono">{urgentCount}</span>
            <AlertTriangle className="w-5 h-5 text-error-sober" />
          </div>
        </div>

        {/* Card 4: Lembretes */}
        <div className="bg-surface-card border border-outline-border p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Lembretes</span>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-black text-warning-sober font-mono">{remindersCount}</span>
            <Bell className="w-5 h-5 text-warning-sober" />
          </div>
        </div>
      </div>

      {/* 3. VIEW SWITCHER & QUICK FILTERS */}
      <div className="flex flex-col gap-3 shrink-0">
        {/* Main View Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center bg-[#1c2028] p-1 rounded-xl border border-outline-border self-start">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "list"
                  ? "bg-primary-container text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Lista de Tarefas</span>
            </button>
            <button
              onClick={() => setActiveTab("kanban")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kanban"
                  ? "bg-primary-container text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Quadro Kanban</span>
            </button>
            <button
              onClick={() => setActiveTab("automations")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "automations"
                  ? "bg-primary-container text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Automações ({automationRules.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          {activeTab !== "automations" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar tarefas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-surface-card border border-outline-border rounded-xl text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-primary-container w-44 sm:w-56"
                />
              </div>

              <button
                onClick={handleCopyAllMarkdown}
                className="p-2 bg-surface-card hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-outline-border rounded-xl transition-all cursor-pointer"
                title="Copiar todas as tarefas em formato Markdown"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5 text-success-sober" /> : <Copy className="w-3.5 h-3.5" />}
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
                  ? "bg-text-primary text-[#0f131c]"
                  : "bg-surface-card text-text-secondary border border-outline-border hover:bg-surface-elevated"
              }`}
            >
              Todas ({tasks.length})
            </button>
            <button
              onClick={() => setFilterMode("high_urgent")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === "high_urgent"
                  ? "bg-error-sober text-white"
                  : "bg-surface-card text-text-secondary border border-outline-border hover:bg-surface-elevated"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-error-sober" />
              <span>Alta / Urgente ({urgentCount})</span>
            </button>
            <button
              onClick={() => setFilterMode("in_progress")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === "in_progress"
                  ? "bg-primary-container text-white"
                  : "bg-surface-card text-text-secondary border border-outline-border hover:bg-surface-elevated"
              }`}
            >
              Em Andamento ({inProgressList.length})
            </button>
            <button
              onClick={() => setFilterMode("reminders")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === "reminders"
                  ? "bg-warning-sober text-white"
                  : "bg-surface-card text-text-secondary border border-outline-border hover:bg-surface-elevated"
              }`}
            >
              <Clock className="w-3 h-3 text-warning-sober" />
              <span>Lembretes ({remindersCount})</span>
            </button>
            <button
              onClick={() => setFilterMode("done")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                filterMode === "done"
                  ? "bg-success-sober text-white"
                  : "bg-surface-card text-text-secondary border border-outline-border hover:bg-surface-elevated"
              }`}
            >
              Concluídas ({completedTasks.length})
            </button>
          </div>
        )}
      </div>

      {/* 4. MASTER GRID LAYOUT (LISTS + SPOTLIGHT) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Left Area: Tasks (List or Kanban) */}
        <div className="xl:col-span-2 flex flex-col min-h-0">
          {/* A) LIST VIEW */}
          {activeTab === "list" && (
            <div className="bg-surface-card border border-outline-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
              {/* List Header */}
              <div className="px-4 py-3 border-b border-outline-border bg-surface-container-low flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Fila de Execução</span>
                <span className="text-[11px] font-medium text-text-secondary">
                  Mostrando {filteredTasks.length} tarefas
                </span>
              </div>

              {/* List Content */}
              <div className="divide-y divide-outline-border/40 overflow-y-auto no-scrollbar flex-1 min-h-0">
                {filteredTasks.map((task) => {
                  const isDone = task.status === "done";
                  const isUrgent = task.priority === "urgent";
                  const isHigh = task.priority === "high";

                  // Color bar accent based on priority
                  let accentColor = "bg-[#334155]";
                  if (isUrgent) accentColor = "bg-error-sober";
                  else if (isHigh) accentColor = "bg-warning-sober";
                  else if (task.priority === "medium") accentColor = "bg-primary-container";

                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`relative pl-5 pr-4 py-3.5 flex items-center justify-between gap-4 cursor-pointer transition-all hover:bg-surface-elevated/40 ${
                        isDone ? "opacity-60" : ""
                      } ${activeSpotlightTask?.id === task.id ? "bg-surface-elevated/20" : ""}`}
                    >
                      {/* Left accent color bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskCheck(task.id);
                          }}
                          className={`w-5 h-5 rounded border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                            isDone
                              ? "bg-success-sober border-success-sober text-[#0f131c]"
                              : "border-outline-border hover:border-primary-container bg-surface-container-low"
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 font-black" />}
                        </button>

                        {/* Labels & Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Priority Badge */}
                            {isUrgent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-error-sober/15 text-error-sober border border-error-sober/20">
                                Urgente
                              </span>
                            )}
                            {isHigh && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-warning-sober/15 text-warning-sober border border-warning-sober/20">
                                Alta
                              </span>
                            )}
                            {!isUrgent && !isHigh && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-outline-border/45 text-text-secondary border border-outline-border/30">
                                {task.priority === "medium" ? "Média" : "Baixa"}
                              </span>
                            )}

                            {/* Channel tag */}
                            {task.channel && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#31353e] text-[#c3c6d7] border border-outline-border">
                                {task.channel}
                              </span>
                            )}

                            {/* Linked note indicator */}
                            {task.obsidianFilePath && (
                              <span className="text-[10px] text-primary-fixed-dim/80 font-mono">
                                📑 {task.obsidianFilePath.split("/").pop()?.replace(".md", "")}
                              </span>
                            )}
                          </div>

                          {/* Task Title */}
                          <p
                            className={`text-xs sm:text-sm font-semibold mt-1 truncate ${
                              isDone ? "line-through text-text-secondary" : "text-text-primary"
                            }`}
                          >
                            {task.title}
                          </p>
                        </div>
                      </div>

                      {/* Right Meta Info & Quick Actions */}
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-[11px] text-text-secondary">
                          {formatDueDate(task.dueDate, task.dueTime)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Copy syntax */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyTaskSyntax(task.obsidianTaskString, task.id);
                            }}
                            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer"
                            title="Copiar sintaxe do Obsidian"
                          >
                            {copiedTaskId === task.id ? (
                              <span className="text-[9px] font-bold text-success-sober">Copiado</span>
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Open Note in Obsidian */}
                          {task.obsidianFilePath && (
                            <a
                              href={buildObsidianOpenUri(apiConfig.vaultName, task.obsidianFilePath)}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-text-secondary hover:text-primary-fixed-dim hover:bg-surface-elevated rounded-lg transition-colors"
                              title="Abrir no Obsidian"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Delete task */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                            className="p-1.5 text-[#334155] hover:text-error-sober hover:bg-surface-elevated rounded-lg transition-colors cursor-pointer"
                            title="Excluir tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <div className="py-16 text-center text-text-secondary space-y-3">
                    <CheckSquare className="w-10 h-10 text-outline-border/80 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-text-primary">Nenhuma tarefa por aqui!</p>
                      <p className="text-[11px] text-text-secondary mt-1">Crie uma nova tarefa ou tente outro filtro.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* B) KANBAN VIEW */}
          {activeTab === "kanban" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
              {/* Column: Todo */}
              <div className="bg-[#1c2028] rounded-xl p-4 border border-outline-border flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between pb-1.5 border-b border-outline-border/45 shrink-0">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    A Fazer ({todoList.length})
                  </span>
                </div>
                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
                  {todoList.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`bg-surface-card p-3.5 rounded-xl border cursor-pointer transition-all hover:border-primary-container ${
                        activeSpotlightTask?.id === task.id ? "border-primary-container ring-1 ring-primary-container/20" : "border-outline-border"
                      } space-y-2.5`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskCheck(task.id);
                          }}
                          className="mt-0.5 w-4 h-4 rounded border border-outline-border hover:border-primary-container bg-surface-container-low flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Check className="w-2.5 h-2.5 text-transparent hover:text-primary-container" />
                        </button>
                        <span className="text-xs font-bold text-text-primary leading-snug">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1.5 border-t border-outline-border/40">
                        <span className="font-mono">{formatDueDate(task.dueDate)}</span>
                        {task.channel && (
                          <span className="font-semibold uppercase text-primary-fixed-dim">#{task.channel}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {todoList.length === 0 && (
                    <p className="text-center py-8 text-[11px] text-text-secondary">Nenhuma tarefa pendente.</p>
                  )}
                </div>
              </div>

              {/* Column: In Progress */}
              <div className="bg-[#1c2028] rounded-xl p-4 border border-outline-border flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between pb-1.5 border-b border-outline-border/45 shrink-0">
                  <span className="text-[11px] font-bold text-primary-fixed-dim uppercase tracking-wider">
                    Em Andamento ({inProgressList.length})
                  </span>
                </div>
                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
                  {inProgressList.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`bg-surface-card p-3.5 rounded-xl border cursor-pointer transition-all hover:border-primary-container ${
                        activeSpotlightTask?.id === task.id ? "border-primary-container ring-1 ring-primary-container/20" : "border-outline-border"
                      } space-y-2.5`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTaskCheck(task.id);
                          }}
                          className="mt-0.5 w-4 h-4 rounded border border-primary-container/50 bg-primary-container/10 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Check className="w-2.5 h-2.5 text-primary-fixed-dim" />
                        </button>
                        <span className="text-xs font-bold text-text-primary leading-snug">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1.5 border-t border-outline-border/40">
                        <span className="font-mono">{formatDueDate(task.dueDate)}</span>
                        {task.channel && (
                          <span className="font-semibold uppercase text-primary-fixed-dim">#{task.channel}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {inProgressList.length === 0 && (
                    <p className="text-center py-8 text-[11px] text-text-secondary">Nenhuma em andamento.</p>
                  )}
                </div>
              </div>

              {/* Column: Done */}
              <div className="bg-[#1c2028] rounded-xl p-4 border border-outline-border flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between pb-1.5 border-b border-outline-border/45 shrink-0">
                  <span className="text-[11px] font-bold text-success-sober uppercase tracking-wider">
                    Concluídas ({doneList.length})
                  </span>
                </div>
                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1">
                  {doneList.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="bg-surface-card/60 p-3.5 rounded-xl border border-outline-border/30 opacity-60 space-y-2.5 cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 w-4 h-4 rounded bg-success-sober text-[#0f131c] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 font-bold" />
                        </div>
                        <span className="text-xs font-medium text-text-secondary line-through leading-snug">
                          {task.title}
                        </span>
                      </div>
                    </div>
                  ))}
                  {doneList.length === 0 && (
                    <p className="text-center py-8 text-[11px] text-text-secondary">Nenhuma concluída.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* C) AUTOMAÇÕES VIEW */}
          {activeTab === "automations" && (
            <div className="space-y-6">
              <div className="bg-surface-card border border-outline-border p-6 sm:p-7 rounded-xl space-y-5">
                <div>
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary-fixed-dim" />
                    <span>Modelos de Automação do Cofre</span>
                  </h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Ative as regras inteligentes que automatizam o fluxo de marketing no seu Obsidian em segundo plano.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
                  {friendlyAutomationTemplates.map((template, idx) => {
                    const rule = automationRules.find(r => r.id === template.id) || {
                      id: template.id,
                      name: template.name,
                      enabled: true,
                      executionCount: 12 + idx * 5,
                    };

                    return (
                      <div
                        key={template.id}
                        className="p-5 rounded-xl border border-outline-border bg-[#1c2028] flex flex-col justify-between space-y-4 hover:border-primary-container/60 transition-all"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${template.color}`}>
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
                              <div className="w-7 h-3.5 bg-outline-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-[#0f131c] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-container"></div>
                            </label>
                          </div>

                          <h3 className="text-xs font-bold text-text-primary leading-snug">
                            {template.name}
                          </h3>

                          <p className="text-[11px] text-text-secondary leading-relaxed">
                            {template.result}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-outline-border/40 flex items-center justify-between text-[11px] text-text-secondary">
                          <span className="text-[10px] font-mono">{template.frequency}</span>
                          <button
                            onClick={() => onRunRuleNow(rule.id)}
                            disabled={apiConfig.connectionStatus !== "connected"}
                            className="px-2.5 py-1 bg-surface-card hover:bg-surface-elevated text-text-primary font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-outline-border disabled:opacity-50 disabled:cursor-not-allowed"
                            title={apiConfig.connectionStatus !== "connected" ? "Conecte o cofre do Obsidian para executar" : "Executar agora"}
                          >
                            <Play className="w-2.5 h-2.5 text-primary-fixed-dim" />
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

        {/* Right Area: Spotlight & Notes */}
        {activeTab !== "automations" && (
          <div className="xl:col-span-1 flex flex-col gap-4">
            {/* Spotlight Card */}
            {activeSpotlightTask ? (
              <div className="bg-surface-card border border-outline-border rounded-xl overflow-hidden relative shadow-md">
                {/* Accent Header Bar based on priority */}
                {(() => {
                  let barColor = "bg-[#334155]";
                  if (activeSpotlightTask.priority === "urgent") barColor = "bg-error-sober";
                  else if (activeSpotlightTask.priority === "high") barColor = "bg-warning-sober";
                  else if (activeSpotlightTask.priority === "medium") barColor = "bg-primary-container";

                  return <div className={`h-1.5 w-full ${barColor}`} />;
                })()}

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
                    <span className="font-semibold text-[10px] uppercase tracking-wider text-text-secondary">
                      Spotlight: Próxima Ação
                    </span>
                  </div>

                  <h3 className="text-base font-black text-text-primary mb-2.5 leading-snug">
                    {activeSpotlightTask.title}
                  </h3>

                  <p className="text-xs text-text-secondary mb-6 leading-relaxed">
                    {activeSpotlightTask.description ||
                      "Esta tarefa foi sincronizada do seu cofre Obsidian e está pronta para execução tática rápida."}
                  </p>

                  {/* Context Details Block */}
                  <div className="bg-[#1c2028] border border-outline-border rounded-xl p-3.5 mb-6 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary font-medium">Projeto / Canal</span>
                      <span className="text-text-primary font-bold">
                        {activeSpotlightTask.channel || "Geral"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary font-medium">Prazo</span>
                      <span className="text-text-primary font-mono font-bold">
                        {formatDueDate(activeSpotlightTask.dueDate, activeSpotlightTask.dueTime)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-outline-border/40">
                      <span className="text-text-secondary font-medium">Fonte PKM</span>
                      {activeSpotlightTask.obsidianFilePath ? (
                        <a
                          href={buildObsidianOpenUri(apiConfig.vaultName, activeSpotlightTask.obsidianFilePath)}
                          className="font-mono text-primary-fixed-dim hover:underline flex items-center gap-1 text-[11px]"
                        >
                          [[{activeSpotlightTask.obsidianFilePath.split("/").pop()?.replace(".md", "")}]]
                          <ExternalLink className="w-3 h-3 text-primary-fixed-dim" />
                        </a>
                      ) : (
                        <span className="text-text-secondary font-mono italic">[[Inbox/Notas]]</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {activeSpotlightTask.status !== "done" ? (
                      <>
                        <button
                          onClick={() => handleTaskCheck(activeSpotlightTask.id)}
                          className="w-full bg-primary-container hover:bg-blue-600 text-white font-bold py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2 cursor-pointer text-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Concluir Agora</span>
                        </button>

                        <button
                          onClick={() => handleDeferTaskToTomorrow(activeSpotlightTask)}
                          className="w-full bg-transparent border border-outline-border text-text-secondary hover:text-text-primary hover:bg-surface-elevated font-semibold py-2.5 rounded-lg transition-colors flex justify-center items-center gap-2 cursor-pointer text-xs"
                        >
                          <Clock className="w-4 h-4" />
                          <span>Adiar para Amanhã</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-center py-2 bg-success-sober/10 border border-success-sober/30 rounded-lg">
                        <span className="text-xs font-bold text-success-sober flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Tarefa Concluída! 🎉
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface-card border border-outline-border p-6 rounded-xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary-container/10 border border-primary-container/20 flex items-center justify-center mx-auto">
                  <CheckSquare className="w-5 h-5 text-primary-fixed-dim" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Tudo em dia! ✨</h4>
                  <p className="text-xs text-text-secondary mt-1">
                    Crie tarefas para gerenciar sua rotina de marketing de forma tática.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Notes Card */}
            <div className="bg-surface-card border border-outline-border rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Notas Rápidas (Persistente)</span>
                <Clock className="w-3.5 h-3.5 text-text-secondary" />
              </div>

              <textarea
                value={quickNotes}
                onChange={handleNotesChange}
                placeholder="Rascunho rápido..."
                className="w-full p-3 bg-[#1c2028] border border-outline-border rounded-xl font-mono text-xs text-text-secondary leading-relaxed outline-none focus:border-primary-container h-32 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
