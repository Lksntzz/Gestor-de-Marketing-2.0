import React, { useMemo } from "react";
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
  Plus,
  Cpu,
  Settings,
  Target,
} from "lucide-react";
import type {
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
import {
  buildDashboardActivity,
  computeDashboardMetrics,
  selectPriorityAction,
  type DashboardActionTone,
  type DashboardActivityItem,
} from "../utils/dashboardIntelligence";
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
  onNavigateTab: (tab: "dashboard" | "vault" | "campaigns" | "editorial" | "tasks" | "automations" | "routine" | "knowledge") => void;
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

const actionToneClass: Record<DashboardActionTone, string> = {
  urgent: "text-error-sober bg-error-container/20 border-error-container/40",
  high: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  normal: "text-primary bg-primary-container/15 border-primary-container/30",
  info: "text-motor-info bg-motor-info/10 border-motor-info/25",
};

function activityIcon(kind: DashboardActivityItem["kind"]) {
  if (kind === "sync") return FolderOpen;
  if (kind === "task") return CheckCircle2;
  if (kind === "campaign") return Target;
  return FileText;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  notes = [],
  campaigns = [],
  tasks = [],
  ideas: _ideas = [],
  scripts: _scripts = [],
  visuals: _visuals = [],
  apiConfig,
  engineMode,
  onNavigateTab,
  onSelectNote: _onSelectNote,
  onToggleTaskStatus,
  onOpenNewCampaignModal: _onOpenNewCampaignModal,
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
  onOpenGuide: _onOpenGuide,
  onOpenSetupWizard,
}) => {
  const now = new Date();

  const priorityAction = useMemo(
    () => selectPriorityAction(notes, campaigns, tasks, apiConfig, now),
    [notes, campaigns, tasks, apiConfig.connectionStatus],
  );

  const metrics = useMemo(
    () => computeDashboardMetrics(notes, campaigns, tasks, apiConfig, now),
    [notes, campaigns, tasks, apiConfig.connectionStatus],
  );

  const activityTimeline = useMemo(
    () => buildDashboardActivity(notes, campaigns, tasks, apiConfig, now, 6),
    [notes, campaigns, tasks, apiConfig.connectionStatus, apiConfig.lastSyncTime],
  );

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);

  const handlePriorityAction = () => {
    if (priorityAction.kind === "task") {
      onToggleTaskStatus(priorityAction.id);
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
      return;
    }

    if (priorityAction.kind === "campaign") {
      onNavigateTab("campaigns");
      return;
    }

    if (priorityAction.kind === "connect-obsidian") {
      onOpenSetupWizard?.();
      return;
    }

    if (priorityAction.kind === "add-knowledge") {
      onNavigateTab("knowledge");
      return;
    }

    onNavigateTab("editorial");
  };

  const primaryActionLabel =
    priorityAction.kind === "task"
      ? "Concluir tarefa"
      : priorityAction.kind === "campaign"
        ? "Abrir campanha"
        : priorityAction.kind === "connect-obsidian"
          ? "Configurar Obsidian"
          : priorityAction.kind === "add-knowledge"
            ? "Adicionar fonte"
            : "Abrir planejamento";

  const PrimaryActionIcon =
    priorityAction.kind === "task"
      ? Check
      : priorityAction.kind === "connect-obsidian"
        ? Settings
        : priorityAction.kind === "add-knowledge"
          ? Plus
          : ArrowRight;

  const canRunPrimaryAction = priorityAction.kind !== "connect-obsidian" || Boolean(onOpenSetupWizard);
  const vaultConnected = apiConfig.connectionStatus === "connected";
  const engineLabel = engineMode === "local" ? "Motor Local" : "IA configurada";

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-fadeIn text-text-primary min-h-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0 pb-3 border-b border-outline-border">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-text-secondary bg-surface-card border border-outline-border rounded-full px-2.5 py-1 uppercase tracking-wide">
              <Cpu className="w-3 h-3" />
              {engineLabel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold rounded-full px-2.5 py-1 border uppercase tracking-wide ${
                vaultConnected
                  ? "text-success-sober bg-success-sober/10 border-success-sober/25"
                  : "text-text-secondary bg-surface-card border-outline-border"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${vaultConnected ? "bg-success-sober" : "bg-text-secondary/50"}`} />
              {vaultConnected ? "Obsidian conectado" : "Obsidian desconectado"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            O que fazer agora?
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Prioridades e sinais calculados apenas a partir dos dados registrados no Nisti e no cofre validado.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {vaultConnected ? (
            <button
              onClick={onSyncDailyNote}
              className="px-3.5 py-2 bg-surface-card hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
              title="Sincronizar a Daily Note de hoje no Obsidian"
            >
              <Calendar className="w-3.5 h-3.5 text-text-secondary" />
              <span>Sincronizar Daily</span>
            </button>
          ) : onOpenSetupWizard ? (
            <button
              onClick={onOpenSetupWizard}
              className="px-3.5 py-2 bg-surface-card hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Settings className="w-3.5 h-3.5 text-motor-info" />
              <span>Conectar Obsidian</span>
            </button>
          ) : null}

          <button
            onClick={() => onNavigateTab("knowledge")}
            className="px-4 py-2 bg-primary-container hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar fonte</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-4 min-h-0">
          <div className="bg-surface-card border border-outline-border rounded-3xl p-6 relative overflow-hidden flex-1 flex flex-col border-l-4 border-l-primary-container shadow-sm min-h-[300px]">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${actionToneClass[priorityAction.tone]}`}>
                  {priorityAction.badgeLabel}
                </span>
                {priorityAction.channel && (
                  <span className="text-[10px] font-bold text-primary bg-primary-container/15 px-2 py-0.5 rounded border border-primary-container/30 uppercase">
                    {priorityAction.channel}
                  </span>
                )}
              </div>

              {priorityAction.scheduleLabel && (
                <span className="text-xs font-mono font-medium text-text-secondary flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  {priorityAction.scheduleLabel}
                </span>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto no-scrollbar">
              <h3 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {priorityAction.title}
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mt-2 bg-background/55 p-4 rounded-2xl border border-outline-border/60">
                {priorityAction.subtitle}
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                {priorityAction.filePath && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{priorityAction.filePath}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{vaultConnected ? "Obsidian validado" : "Base de conhecimento bloqueada"}</span>
                </div>
                {apiConfig.lastSyncTime && vaultConnected && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Última sincronização registrada: {apiConfig.lastSyncTime}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-border/60 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handlePriorityAction}
                disabled={!canRunPrimaryAction}
                className="px-4 py-2.5 bg-primary-container hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <PrimaryActionIcon className="w-3.5 h-3.5" />
                <span>{primaryActionLabel}</span>
              </button>

              {priorityAction.filePath && vaultConnected && (
                <a
                  href={buildObsidianOpenUri(apiConfig.vaultName, priorityAction.filePath)}
                  className="px-3.5 py-2.5 bg-background hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Abrir a fonte correspondente no Obsidian"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                  <span>Abrir no Obsidian</span>
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex items-center justify-between group hover:border-primary-container/50 transition-colors min-h-28">
              <div>
                <span className="text-xs font-semibold text-text-secondary block">Campanhas estruturadas</span>
                <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                  {metrics.campaignsCount}
                </span>
                <span className="text-[10px] text-text-secondary font-medium mt-1 block">
                  {metrics.campaignsThisWeek > 0
                    ? `${metrics.campaignsThisWeek} ${metrics.campaignsThisWeek === 1 ? "criada" : "criadas"} nesta semana`
                    : "Nenhuma nova nesta semana"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
            </div>

            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex flex-col justify-between group hover:border-success-sober/50 transition-colors min-h-28">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-text-secondary block">Taxa de execução</span>
                  <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                    {metrics.taskCompletionRate}%
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success-sober/10 border border-success-sober/20 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-success-sober" />
                </div>
              </div>
              <div className="w-full mt-3">
                <div className="w-full bg-background h-1.5 rounded-full overflow-hidden border border-outline-border/40">
                  <div
                    className="bg-success-sober h-full rounded-full transition-all duration-300"
                    style={{ width: `${metrics.taskCompletionRate}%` }}
                  />
                </div>
                <span className="text-[10px] text-text-secondary mt-1.5 block">
                  {metrics.tasksCount > 0
                    ? `${metrics.completedTasksCount} de ${metrics.tasksCount} tarefas concluídas`
                    : "Sem tarefas registradas"}
                </span>
              </div>
            </div>

            <div className="bg-surface-card border border-outline-border rounded-2xl p-4 flex items-center justify-between group hover:border-motor-info/50 transition-colors min-h-28">
              <div>
                <span className="text-xs font-semibold text-text-secondary block">Notas indexadas</span>
                <span className="text-2xl font-black text-text-primary tracking-tight mt-1 block">
                  {metrics.notesCount.toLocaleString("pt-BR")}
                </span>
                <span className={`text-[10px] font-medium mt-1 block ${metrics.isVaultConnected ? "text-motor-info" : "text-text-secondary"}`}>
                  {metrics.isVaultConnected ? "Cofre conectado" : "Conexão com Obsidian necessária"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-motor-info/10 border border-motor-info/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-motor-info" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4 min-h-0">
          <div className="bg-surface-card border border-outline-border rounded-3xl p-5 flex flex-col flex-1 min-h-0 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-outline-border/40 shrink-0">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                Atividades recentes
              </h3>
              <span className="text-[10px] text-text-secondary/80 font-mono">Dados registrados</span>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto no-scrollbar space-y-4">
              {activityTimeline.length === 0 ? (
                <div className="h-full min-h-36 flex flex-col items-center justify-center text-center px-4">
                  <Clock className="w-6 h-6 text-text-secondary/40 mb-2" />
                  <p className="text-xs font-bold text-text-primary">Ainda não há eventos registrados</p>
                  <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">
                    Sincronizações, notas, campanhas e tarefas concluídas aparecerão aqui quando houver data real associada.
                  </p>
                </div>
              ) : (
                activityTimeline.map((item) => {
                  const Icon = activityIcon(item.kind);
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 group relative">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-background border border-outline-border">
                          <Icon className="w-4 h-4 text-motor-info" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-text-primary block leading-tight">
                            {item.action}
                          </span>
                          <span className="text-[11px] text-text-secondary mt-0.5 block font-medium truncate">
                            {item.detail}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-text-secondary/60 shrink-0 mt-0.5">
                        {item.timeLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3 shrink-0">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block">
              Atalhos
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigateTab("vault")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-24"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Base</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">{metrics.notesCount} fontes indexadas</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("knowledge")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-24"
              >
                <div className="w-8 h-8 rounded-xl bg-motor-info/10 border border-motor-info/20 flex items-center justify-center text-motor-info shrink-0 group-hover:scale-105 transition-transform">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Adicionar fonte</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">Arquivo, link ou texto</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("editorial")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-24"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Planejar</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">Campanhas e calendário</span>
                </div>
              </button>

              <button
                onClick={() => onNavigateTab("tasks")}
                className="p-3.5 bg-surface-card border border-outline-border hover:border-primary-container rounded-2xl text-left transition-all group cursor-pointer flex flex-col justify-between h-24"
              >
                <div className="w-8 h-8 rounded-xl bg-primary-container/10 border border-primary-container/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">Executar</span>
                  <span className="text-[9px] text-text-secondary block mt-0.5">{pendingTasks.length} pendentes</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
