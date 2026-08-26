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
  Laptop,
  ShieldCheck,
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
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "tasks" | "automations" | "routine") => void;
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
  onOpenNewTaskModal: _onOpenNewTaskModal,
  onOpenNewNoteModal: _onOpenNewNoteModal,
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

    // 2. Default high-leverage marketing action from Local Engine for Nisti Print
    const activeCamp = campaigns[0];
    return {
      id: "strategic_action_1",
      type: "campaign" as const,
      title: activeCamp?.title || "Lançamento Linha Planners & Devocionais 2026",
      subtitle: activeCamp?.summary || "Campanha focada em quebrar a objeção de lote mínimo e destacar acabamento Soft Touch.",
      channel: "Instagram & WhatsApp",
      time: "11:30",
      date: "Hoje",
      persona: "Empreendedoras de Papelaria & Ministérios",
      hook: "Você já desenhou a coleção de planners mais linda do ano, mas a gráfica pediu 500 peças para rodar? Na Nisti Print seu projeto ganha vida a partir de 10 unidades com laminação Soft Touch e wire-o bronze.",
      filePath: "01_Estrategia/Brand Voice & Posicionamento Nisti Print.md",
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

  // MAXIMUM 3 KPIS WITH REAL DATA
  const kpis = useMemo(() => {
    const taskCompletionRate = tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 100;

    return [
      {
        id: "campaigns",
        label: "Campanhas Estruturadas",
        value: `${campaigns.length}`,
        sub: `${campaigns.length} ${campaigns.length === 1 ? "estratégia ativa" : "estratégias ativas"}`,
        trend: "positive",
        badge: "Em Andamento",
        hint: "Planos multicanais gerados",
      },
      {
        id: "execution",
        label: "Taxa de Execução",
        value: `${taskCompletionRate}%`,
        sub: `${completedTasks.length} de ${tasks.length} concluídas`,
        trend: "positive",
        badge: pendingTasks.length === 0 ? "100% Concluído" : "No Prazo",
        hint: "Aderência às rotinas e prazos",
      },
      {
        id: "knowledge",
        label: "Conhecimento Indexado",
        value: `${notes.length} notas`,
        sub: "100% Markdown local",
        trend: "neutral",
        badge: "0 Tokens",
        hint: "Base pronta no cofre Obsidian",
      },
    ];
  }, [campaigns, tasks, completedTasks, pendingTasks, notes]);

  // Chronological Activity Timeline (Últimas Ações do Cérebro)
  const activityTimeline = useMemo(() => {
    const items = [
      {
        id: "1",
        time: "Agora",
        action: "Motor Local sincronizado",
        detail: `${notes.length} notas no cofre e ${ideas.length} ideias indexadas`,
        icon: Zap,
        color: "text-purple-600 bg-purple-50",
      },
      {
        id: "2",
        time: "Hoje",
        action: "Daily Note de Marketing",
        detail: "Sincronização de tarefas com formato oficial Obsidian Tasks (- [ ])",
        icon: Calendar,
        color: "text-emerald-600 bg-emerald-50",
      },
      {
        id: "3",
        time: "Recomendado",
        action: "Slot de Conteúdo Prioritário",
        detail: "Publicação sobre acabamento Soft Touch e lote a partir de 10 unidades",
        icon: Sparkles,
        color: "text-amber-600 bg-amber-50",
      },
      {
        id: "4",
        time: "Base",
        action: "Taxonomia Oficial Nisti Print",
        detail: "10 pastas padrão estruturadas com frontmatter YAML e tags",
        icon: FileText,
        color: "text-stone-600 bg-stone-100",
      },
    ];
    return items;
  }, [notes, ideas]);

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-8 pb-20 animate-fadeIn">
      
      {/* 1. HEADER MINIMALISTA: BOAS-VINDAS & RESPOSTA DIRETA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200 uppercase tracking-wider">
              {engineMode === "local" ? "⚡ Motor Local Ativo" : "✨ Gemini IA Conectado"}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              Sincronização Contínua
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight mt-1">
            O que fazer agora?
          </h1>
          <p className="text-xs text-stone-500">
            Sua visão centralizada de prioridades, métricas essenciais e histórico recente.
          </p>
        </div>

        {/* Quick Sync & Create Shortcuts */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          {onOpenSetupWizard && (
            <button
              onClick={onOpenSetupWizard}
              className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold rounded-xl transition-all border border-purple-200 flex items-center gap-1.5 cursor-pointer"
              title="Assistente de Instalação e Configuração Inicial"
            >
              <Laptop className="w-3.5 h-3.5 text-purple-700" />
              <span>Instalador & Setup</span>
            </button>
          )}

          <button
            onClick={onSyncDailyNote}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-all border border-stone-200/80 flex items-center gap-1.5 cursor-pointer"
            title="Sincronizar Daily Note de hoje no Obsidian"
          >
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span>Sincronizar Daily</span>
          </button>

          <button
            onClick={onOpenNewCampaignModal}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Nova Campanha</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Recommended Actions and Impact Metrics */}
        <div className="lg:col-span-2 space-y-8">
          {/* 2. CARD PRINCIPAL: "O QUE FAZER AGORA" (AÇÃO PRIORITÁRIA DE ALTO IMPACTO) */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs space-y-6 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                  Ação Recomendada de Hoje
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg self-start sm:self-auto border border-stone-200/70">
                ⏰ {nextPriorityAction.time} • #{nextPriorityAction.channel}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                  {nextPriorityAction.persona}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-150">
                  Alta Conversão
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-stone-900 leading-snug">
                {nextPriorityAction.title}
              </h2>

              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans bg-stone-50/70 p-4 rounded-2xl border border-stone-150/80">
                <strong>Gancho sugerido:</strong> "{nextPriorityAction.hook}"
              </p>
            </div>

            {/* Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-150">
              <div className="flex items-center gap-2">
                {priorityActionStatus === "done" ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ação concluída com sucesso!</span>
                  </span>
                ) : (
                  <>
                    <button
                      onClick={handleMarkActionDone}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Concluir Agora</span>
                    </button>

                    <button
                      onClick={handlePostponeAction}
                      className="px-3.5 py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold rounded-xl border border-stone-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
                      <span>Adiar Slot</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenNewCampaignModal}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gerar no Assistente IA</span>
                </button>

                {nextPriorityAction.filePath && (
                  <a
                    href={buildObsidianOpenUri(apiConfig.vaultName, nextPriorityAction.filePath)}
                    className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                    title="Abrir nota de origem no Obsidian"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 3. KPIS ESSENCIAIS COM TENDÊNCIAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Métricas de Impacto
              </span>
              <span className="text-xs text-stone-400">Tempo real</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-3xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      {kpi.badge}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-2xl font-black text-stone-900 tracking-tight">
                      {kpi.value}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-500 font-medium">
                    {kpi.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Activities and Shortcuts */}
        <div className="space-y-8">
          {/* 4. TIMELINE LINEAR DAS ÚLTIMAS AÇÕES & ATIVIDADES DO CÉREBRO */}
          <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                  Atividades Recentes
                </h2>
              </div>
              <span className="text-xs text-stone-400">Últimos eventos</span>
            </div>

            <div className="divide-y divide-stone-100">
              {activityTimeline.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="py-3.5 flex items-start justify-between gap-3 group">
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-stone-900 block leading-tight">
                          {item.action}
                        </span>
                        <span className="text-[11px] text-stone-500 mt-0.5 block">
                          {item.detail}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-stone-400 shrink-0">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. ATALHOS RÁPIDOS PARA OS PILARES (CONHECIMENTO, PLANEJAMENTO, EXECUÇÃO) */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
              Atalhos de Navegação
            </span>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => onNavigateTab("vault")}
                className="p-4 rounded-2xl bg-white border border-stone-200/80 hover:border-purple-300 text-left transition-all group shadow-3xs cursor-pointer flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Conhecimento</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">{notes.length} notas no cofre</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-450 group-hover:translate-x-0.5 group-hover:text-purple-600 transition-all" />
              </button>

              <button
                onClick={() => onNavigateTab("routine")}
                className="p-4 rounded-2xl bg-white border border-stone-200/80 hover:border-purple-300 text-left transition-all group shadow-3xs cursor-pointer flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Planejamento</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">Rotina e horários ideais</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-450 group-hover:translate-x-0.5 group-hover:text-purple-600 transition-all" />
              </button>

              <button
                onClick={() => onNavigateTab("tasks")}
                className="p-4 rounded-2xl bg-white border border-stone-200/80 hover:border-purple-300 text-left transition-all group shadow-3xs cursor-pointer flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Execução</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">{pendingTasks.length} tarefas a fazer</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-450 group-hover:translate-x-0.5 group-hover:text-purple-600 transition-all" />
              </button>

              {onOpenGuide && (
                <button
                  onClick={onOpenGuide}
                  className="p-4 rounded-2xl bg-linear-to-br from-purple-50 to-stone-50 border border-purple-200 hover:border-purple-300 text-left transition-all group shadow-3xs cursor-pointer flex items-center justify-between w-full mt-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-purple-950 block">Guia do Sistema</span>
                      <span className="text-[10px] text-purple-700 block mt-0.5">Instalação Local, Obsidian & Hot Swap</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-600 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
