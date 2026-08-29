import React, { useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  Plus,
  Settings,
} from "lucide-react";
import type {
  MarketingCampaign,
  MarketingTask,
  ObsidianApiConfig,
  ObsidianNote,
} from "../types";
import type { AppViewId } from "../navigation/productNavigation";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import {
  buildDashboardBlockers,
  computeDashboardMetrics,
  selectPriorityAction,
  type DashboardActionTone,
} from "../utils/dashboardIntelligence";

interface DashboardViewProps {
  notes: ObsidianNote[];
  campaigns: MarketingCampaign[];
  tasks: MarketingTask[];
  apiConfig: ObsidianApiConfig;
  onNavigateTab: (tab: AppViewId) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onOpenSetupWizard?: () => void;
  /** Transitional compatibility while App.tsx still passes audited legacy props. */
  [legacyProp: string]: unknown;
}

const actionToneClass: Record<DashboardActionTone, string> = {
  urgent: "text-error-sober bg-error-container/20 border-error-container/40",
  high: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  normal: "text-primary bg-primary-container/15 border-primary-container/30",
  info: "text-motor-info bg-motor-info/10 border-motor-info/25",
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  notes,
  campaigns,
  tasks,
  apiConfig,
  onNavigateTab,
  onToggleTaskStatus,
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

  const blockers = useMemo(
    () => buildDashboardBlockers(notes, apiConfig),
    [notes, apiConfig.connectionStatus],
  );

  const openBaseConfiguration = () => {
    if (onOpenSetupWizard) {
      onOpenSetupWizard();
      return;
    }
    onNavigateTab("vault");
  };

  const handlePriorityAction = () => {
    if (priorityAction.kind === "task") {
      onToggleTaskStatus(priorityAction.id);
      return;
    }
    if (priorityAction.kind === "campaign") {
      onNavigateTab("campaigns");
      return;
    }
    if (priorityAction.kind === "connect-obsidian") {
      openBaseConfiguration();
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
          ? (onOpenSetupWizard ? "Configurar Base" : "Abrir Base")
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

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto no-scrollbar text-text-primary">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-5 pb-6">
        <header className="flex items-start justify-between gap-4 pb-3 border-b border-outline-border">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">O que fazer agora?</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Uma prioridade por vez, baseada somente no que está registrado no Nisti e na Base.
            </p>
          </div>
          {blockers.length > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase tracking-wide">
              <AlertCircle className="w-3.5 h-3.5" />
              {blockers.length} {blockers.length === 1 ? "bloqueio" : "bloqueios"}
            </span>
          )}
        </header>

        <section className="bg-surface-card border border-outline-border rounded-3xl p-5 sm:p-6 border-l-4 border-l-primary-container shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0 flex-1">
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

              <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight mt-4">
                {priorityAction.title}
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mt-2 max-w-3xl">
                {priorityAction.subtitle}
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-secondary">
                {priorityAction.scheduleLabel && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {priorityAction.scheduleLabel}
                  </span>
                )}
                {priorityAction.filePath && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{priorityAction.filePath}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-outline-border/60 flex flex-wrap items-center gap-2">
            <button
              onClick={handlePriorityAction}
              className="px-4 py-2.5 bg-primary-container hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <PrimaryActionIcon className="w-3.5 h-3.5" />
              {primaryActionLabel}
            </button>

            {priorityAction.filePath && apiConfig.connectionStatus === "connected" && (
              <a
                href={buildObsidianOpenUri(apiConfig.vaultName, priorityAction.filePath)}
                className="px-3.5 py-2.5 bg-background hover:bg-surface-variant text-text-primary border border-outline-border rounded-xl transition-all text-xs font-bold flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-text-secondary" />
                Abrir no Obsidian
              </a>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-8 bg-surface-card border border-outline-border rounded-3xl p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-text-primary">Esta semana</h2>
              <p className="text-[11px] text-text-secondary mt-1">Somente tarefas com datas realmente registradas.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-2xl border border-outline-border bg-background/50 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">A vencer</span>
                <strong className="text-2xl font-black text-text-primary block mt-1">{metrics.dueThisWeekCount}</strong>
                <span className="text-[10px] text-text-secondary">até domingo</span>
              </div>

              <div className={`rounded-2xl border p-4 ${metrics.overdueTasksCount > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-outline-border bg-background/50"}`}>
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Atrasadas</span>
                <strong className={`text-2xl font-black block mt-1 ${metrics.overdueTasksCount > 0 ? "text-amber-300" : "text-text-primary"}`}>{metrics.overdueTasksCount}</strong>
                <span className="text-[10px] text-text-secondary">pendências vencidas</span>
              </div>

              <div className="rounded-2xl border border-outline-border bg-background/50 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Concluídas</span>
                <strong className="text-2xl font-black text-text-primary block mt-1">{metrics.completedThisWeekCount}</strong>
                <span className="text-[10px] text-text-secondary">nesta semana</span>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab("tasks")}
              className="mt-4 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1.5"
            >
              Ver execução
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </section>

          <section className="lg:col-span-4 bg-surface-card border border-outline-border rounded-3xl p-5 shadow-sm">
            <h2 className="text-sm font-black text-text-primary">Bloqueios</h2>
            <p className="text-[11px] text-text-secondary mt-1">Só aparece o que impede contexto ou operação confiável.</p>

            {blockers.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-text-primary">Sem bloqueios estruturais</div>
                  <div className="text-[10px] text-text-secondary mt-1">A Base está disponível para o fluxo atual.</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {blockers.map((blocker) => (
                  <div key={blocker.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-text-primary">{blocker.title}</div>
                        <div className="text-[10px] text-text-secondary mt-1 leading-relaxed">{blocker.detail}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => blocker.destination === "settings" ? openBaseConfiguration() : onNavigateTab("knowledge")}
                      className="mt-3 text-[10px] font-black text-amber-300 hover:underline"
                    >
                      {blocker.destination === "settings" ? (onOpenSetupWizard ? "Configurar Base" : "Abrir Base") : "Adicionar fonte"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
