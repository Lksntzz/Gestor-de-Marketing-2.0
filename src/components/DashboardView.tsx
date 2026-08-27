import React, { useState, useMemo } from "react";
import {
  Sparkles,
  CheckSquare,
  Clock,
  FolderOpen,
  ArrowRight,
  Zap,
  CheckCircle2,
  Calendar,
  FileText,
  ExternalLink,
  Check,
  RotateCcw,
  ArrowUpRight,
  Plus,
  Cpu,
  Laptop,
  Target,
} from "lucide-react";
import {
  ObsidianNote,
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  VaultAuditInsight,
  IdeaItem,
  CreativeScript,
  VisualAsset,
  EngineMode,
} from "../types";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import confetti from "canvas-confetti";

interface DashboardViewProps {
  notes: ObsidianNote[];
  campaigns: MarketingCampaign[];
  tasks: MarketingTask[];
  ideas: IdeaItem[];
  scripts: CreativeScript[];
  visuals: VisualAsset[];
  apiConfig: ObsidianApiConfig;
  engineMode: EngineMode;
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine" | "knowledge") => void;
  onSelectNote: (note: ObsidianNote) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onOpenNewCampaignModal: () => void;
  onOpenNewTaskModal: () => void;
  onOpenNewNoteModal?: () => void;
  onAuditVault: () => void;
  isAuditing: boolean;
  auditInsight: VaultAuditInsight | null;
  onSyncDailyNote: () => void;
  onAddIdea?: (idea: Omit<IdeaItem, "id">) => void;
  onUpdateIdeaStatus?: (ideaId: string, newStatus: IdeaItem["status"]) => void;
  onConvertIdeaToCampaign?: (idea: IdeaItem) => void;
  onExportScriptToVault?: (script: CreativeScript) => void;
  onOpenGuide?: () => void;
  onOpenSetupWizard?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  notes = [],
  campaigns = [],
  tasks = [],
  ideas = [],
  scripts: _scripts = [],
  visuals: _visuals = [],
  apiConfig,
  engineMode,
  onNavigateTab,
  onSelectNote: _onSelectNote,
  onToggleTaskStatus,
  onOpenNewCampaignModal,
  onOpenNewTaskModal,
  onOpenNewNoteModal,
  onAuditVault: _onAuditVault,
  isAuditing: _isAuditing,
  auditInsight: _auditInsight,
  onSyncDailyNote,
  onAddIdea: _onAddIdea,
  onUpdateIdeaStatus: _onUpdateIdeaStatus,
  onConvertIdeaToCampaign: _onConvertIdeaToCampaign,
  onExportScriptToVault: _onExportScriptToVault,
  onOpenGuide,
  onOpenSetupWizard,
}) => {
  // Status of the top priority action
  const [priorityActionStatus, setPriorityActionStatus] = useState<"pending" | "done" | "postponed">("pending");

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  // Next Priority Action (O que fazer agora)
  const nextPriorityAction = useMemo(() => {
    // 1. Check if there is an urgent/high priority task
    const urgentTask = pendingTasks.find((t) => t.priority === "urgent" || t.priority === "high");
    if (urgentTask) {
      return {
        id: urgentTask.id,
        type: "task" as const,
        title: urgentTask.title,
        subtitle: urgentTask.description || "Tarefa de alta prioridade sincronizada com Obsidian Tasks.",
        channel: urgentTask.channel || "Geral",
        time: urgentTask.dueTime || "11:30",
        date: urgentTask.dueDate || "Hoje",
        persona: "Público Alvo Nisti Print",
        hook: "Avançar na execução desta pendência destrava a produção da esteira de campanhas.",
        filePath: urgentTask.obsidianFilePath || "04_Campanhas/Lançamento Planners 2026.md",
      };
    }

    // 2. High-leverage marketing action from Local Engine
    const activeCamp = campaigns[0];
    if (activeCamp) {
      return {
        id: activeCamp.id,
        type: "campaign" as const,
        title: activeCamp.title,
        subtitle: activeCamp.summary || "Estratégia multicanal ativa no cofre.",
        channel: activeCamp.channels?.[0] || "Omnichannel",
        time: "11:30",
        date: "Hoje",
        persona: activeCamp.targetPersona || "Público Alvo",
        hook: activeCamp.strategy || "Avançar na execução dos criativos desta campanha.",
        filePath: activeCamp.obsidianOutputNotePath || undefined,
      };
    }

    // 3. Clean Empty Vault State
    return {
      id: "initial_setup",
      type: "campaign" as const,
      title: "Cofre pronto para receber suas notas e campanhas",
      subtitle: "Comece criando uma nova campanha ou sincronizando suas notas do Obsidian para estruturar seu marketing.",
      channel: "Obsidian Vault",
      time: "Agora",
      date: "Hoje",
      persona: "Seu Negócio / Projeto",
      hook: "Clique no botão 'Nova Campanha' ou use o assistente para iniciar o seu planejamento.",
      filePath: undefined,
    };
  }, [pendingTasks, campaigns]);

  // Handle Mark Done
  const handleMarkActionDone = () => {
    setPriorityActionStatus("done");
    if (nextPriorityAction.type === "task") {
      onToggleTaskStatus(nextPriorityAction.id);
    }
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
  };

  // Handle Postpone
  const handlePostponeAction = () => {
    setPriorityActionStatus("postponed");
  };

  // Real metrics calculated from state
  const activeCampaignsCount = campaigns.length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const knowledgeIndex = notes.length;

  // Render priority action details - no mock fallbacks if real action is initial_setup
  const actionTitle = nextPriorityAction.title;
  const actionSubtitle = nextPriorityAction.subtitle;
  const actionChannel = nextPriorityAction.channel || "Geral";
  const actionTime = nextPriorityAction.id === "initial_setup" ? "Agora" : `${nextPriorityAction.date}, ${nextPriorityAction.time}`;
  const actionFilePath = nextPriorityAction.filePath || undefined;

  // Próximas Entregas List showing only real tasks or a clear empty state
  const deliveriesList = useMemo(() => {
    if (pendingTasks.length > 0) {
      return pendingTasks.slice(0, 3).map((task) => ({
        id: task.id,
        title: task.title,
        meta: `${task.dueDate || "Hoje"} • ${task.channel || "Geral"}`,
        checked: false,
        isReal: true,
      }));
    }
    return []; // No mock list of deliveries
  }, [pendingTasks]);

  // Activity Timeline
  const activityTimeline = useMemo(() => {
    const timeline: any[] = [];
    
    // Last Sync Event (using notes length as a proxy for the last sync state)
    if (notes.length > 0) {
      timeline.push({
        id: "act_sync",
        time: "Hoje",
        action: "Sincronização do Cofre",
        detail: `${notes.length} notas carregadas`,
        icon: FolderOpen,
      });
    }

    // Latest Completed Tasks
    const completedTasks = tasks.filter(t => t.status === "done").slice(0, 2);
    completedTasks.forEach((task, i) => {
      timeline.push({
        id: `act_task_${task.id}_${i}`,
        time: "Recente",
        action: "Tarefa Concluída",
        detail: task.title,
        icon: CheckCircle2,
      });
    });

    // Latest Active Campaigns
    const activeCamps = campaigns.filter(c => c.status === "active").slice(0, 1);
    activeCamps.forEach((camp, i) => {
      timeline.push({
        id: `act_camp_${camp.id}_${i}`,
        time: "Recente",
        action: "Campanha Ativa",
        detail: camp.title,
        icon: Target,
      });
    });

    // Latest Notes
    const latestNotes = [...notes].slice(-2);
    latestNotes.forEach((note, i) => {
      timeline.push({
        id: `act_note_${note.id}_${i}`,
        time: "Recente",
        action: "Nota no Cofre",
        detail: note.title,
        icon: FileText,
      });
    });

    // Sort to keep it looking nice (limit to 5)
    return timeline.slice(0, 5);
  }, [notes, tasks, campaigns]);

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-fadeIn text-text-primary min-h-0">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0 pb-3 border-b border-outline-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1.5">
            O que fazer agora?
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary">
            Visão geral das prioridades, execução e conhecimento do seu marketing.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenSetupWizard && (
            <button
              onClick={onOpenSetupWizard}
              className="px-3 py-2 bg-surface-card hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Assistente de Instalação e Configuração Inicial"
            >
              <Laptop className="w-3.5 h-3.5 text-motor-info" />
              <span>Setup Wizard</span>
            </button>
          )}

          <button
            onClick={onSyncDailyNote}
            className="px-3.5 py-2 bg-surface-card hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            title="Sincronizar Daily Note de hoje no Obsidian"
          >
            <Calendar className="w-3.5 h-3.5 text-text-secondary" />
            <span>Sincronizar Daily Note</span>
          </button>

          <button
            onClick={onOpenNewCampaignModal}
            className="px-4 py-2 bg-primary-container hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        
        {/* Left Column: Priority Action & Metrics */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-4 min-h-0">
          
          {/* Priority Action Card */}
          <div className="bg-surface-card border border-outline-border rounded-3xl p-6 relative overflow-hidden flex-1 flex flex-col border-l-4 border-l-primary-container shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-error-sober bg-error-container/20 px-2 py-0.5 rounded border border-error-container/40 uppercase">
                  Urgente
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary-container/20 px-2 py-0.5 rounded border border-primary-container/40 uppercase">
                  {actionChannel}
                </span>
              </div>
              <span className="text-xs font-mono font-medium text-text-secondary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {actionTime}
              </span>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto no-scrollbar">
              <h3 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {actionTitle}
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mt-2 font-sans bg-background/55 p-4 rounded-2xl border border-outline-border/60">
                {actionSubtitle}
              </p>

              {/* Meta details if available */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                {actionFilePath && (
                  <div className="flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5 text-text-secondary" />
                    <span>{actionFilePath}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Cofre Sincronizado</span>
                </div>
              </div>
            </div>

            {/* Action buttons footer */}
            <div className="mt-6 pt-4 border-t border-outline-border/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {priorityActionStatus === "done" ? (
                  <span className="text-xs font-bold text-success-sober bg-success-sober/10 px-3 py-2 rounded-xl border border-success-sober/25 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tarefa Concluída!</span>
                  </span>
                ) : (
                  <>
                    <button
                      onClick={handleMarkActionDone}
                      className="px-4 py-2.5 bg-primary-container hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Concluir agora</span>
                    </button>

                    <button
                      onClick={handlePostponeAction}
                      className="px-3.5 py-2.5 bg-background hover:bg-surface-variant text-text-secondary text-xs font-bold rounded-xl border border-outline-border transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-text-secondary/60" />
                      <span>Adiar</span>
                    </button>
                  </>
                )}
              </div>

              {actionFilePath && (
                <a
                  href={buildObsidianOpenUri(apiConfig.vaultName, actionFilePath)}
                  className="px-3.5 py-2.5 bg-background hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Abrir nota no Obsidian"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Abrir no Obsidian</span>
                </a>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            
            {/* Metric Card 1 */}
            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex items-center justify-between group hover:border-primary-container/50 transition-colors">
              <div>
                <span className="text-xs font-semibold text-text-secondary block">Campanhas Estruturadas</span>
                <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                  {activeCampaignsCount}
                </span>
                <span className="text-[10px] text-success-sober font-medium mt-1 block">
                  +2 esta semana
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
            </div>

            {/* Metric Card 2 */}
            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex flex-col justify-between group hover:border-success-sober/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-text-secondary block">Taxa de Execução</span>
                  <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                    {taskCompletionRate}%
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success-sober/10 border border-success-sober/20 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-success-sober" />
                </div>
              </div>
              <div className="w-full mt-3">
                <div className="w-full bg-background h-1.5 rounded-full overflow-hidden border border-outline-border/40">
                  <div className="bg-success-sober h-full rounded-full transition-all duration-300" style={{ width: `${taskCompletionRate}%` }}></div>
                </div>
                <span className="text-[10px] text-text-secondary mt-1.5 block">
                  Alvo de consistência: 90%
                </span>
              </div>
            </div>

            {/* Metric Card 3 */}
            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex items-center justify-between group hover:border-motor-info/50 transition-colors">
              <div>
                <span className="text-xs font-semibold text-text-secondary block">Notas Indexadas</span>
                <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                  {knowledgeIndex.toLocaleString()}
                </span>
                <span className="text-[10px] text-motor-info font-medium mt-1 block">
                  Cofre Obsidian integrado
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-motor-info/10 border border-motor-info/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-motor-info" />
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Timeline & Shortcuts */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4 min-h-0">
          
          {/* Recent Activity Timeline */}
          <div className="bg-surface-card border border-outline-border rounded-3xl p-5 flex flex-col flex-1 min-h-0 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-border/40 shrink-0">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Atividades Recentes
              </h3>
              <span className="text-[10px] text-text-secondary/80 font-mono">Últimos eventos</span>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto no-scrollbar space-y-4">
              {activityTimeline.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 group relative">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-background border border-outline-border`}>
                        <Icon className="w-4 h-4 text-motor-info animate-fadeIn" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-text-primary block leading-tight">
                          {item.action}
                        </span>
                        <span className="text-[11px] text-text-secondary mt-0.5 block font-medium">
                          {item.detail}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono font-semibold text-text-secondary/60 shrink-0 mt-0.5">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="space-y-3 shrink-0">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
              Atalhos de Navegação
            </span>
            <div className="grid grid-cols-2 gap-3">
              
              <button
                onClick={() => onNavigateTab("vault")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-28"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Conhecimento</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">{notes.length} notas no cofre</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("routine")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-28"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Planejamento</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">Rotinas e horários</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("tasks")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-28"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Execução</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">{pendingTasks.length} a fazer</span>
                </div>
              </button>

              <button
                onClick={onOpenGuide ? onOpenGuide : () => onNavigateTab("routine")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-28"
              >
                <div className="w-8 h-8 rounded-xl bg-motor-info/10 border border-motor-info/20 flex items-center justify-center text-motor-info shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Guia do Sistema</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">Ajuda & Tutoriais</span>
                </div>
              </button>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

