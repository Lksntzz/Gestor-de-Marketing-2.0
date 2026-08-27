import React, { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  FileText,
  Folder,
  FolderTree,
  Hash,
  LibraryBig,
  Map,
  Megaphone,
  MoreHorizontal,
  Play,
  Sparkles,
  Zap,
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

type PriorityAction = {
  id: string;
  kind: "task" | "campaign" | "setup";
  title: string;
  description: string;
  channel: string;
  dueLabel: string;
  tags: string[];
  filePath?: string;
};

function formatActivityTime(value?: string): string {
  if (!value) return "Agora";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000));
  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;
  return parsed.toLocaleDateString("pt-BR");
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  notes = [],
  campaigns = [],
  tasks = [],
  ideas = [],
  apiConfig,
  engineMode,
  onNavigateTab,
  onToggleTaskStatus,
  onOpenNewCampaignModal,
  onSyncDailyNote,
  onOpenGuide,
}) => {
  const [priorityActionStatus, setPriorityActionStatus] = useState<"pending" | "done" | "postponed">("pending");

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "done"), [tasks]);

  const priorityAction = useMemo<PriorityAction>(() => {
    const urgentTask = pendingTasks
      .slice()
      .sort((a, b) => {
        const rank = { urgent: 4, high: 3, medium: 2, low: 1 };
        return rank[b.priority] - rank[a.priority];
      })[0];

    if (urgentTask) {
      const tags = [urgentTask.channel, ...(urgentTask.tags || [])].filter(Boolean) as string[];
      return {
        id: urgentTask.id,
        kind: "task",
        title: urgentTask.title,
        description: urgentTask.description || "Tarefa pendente registrada no fluxo de execução.",
        channel: urgentTask.channel || "Execução",
        dueLabel: [urgentTask.dueDate || "Hoje", urgentTask.dueTime].filter(Boolean).join(", "),
        tags: tags.slice(0, 3),
        filePath: urgentTask.obsidianFilePath,
      };
    }

    const activeCampaign = campaigns.find((campaign) => campaign.status === "active") || campaigns[0];
    if (activeCampaign) {
      return {
        id: activeCampaign.id,
        kind: "campaign",
        title: activeCampaign.title,
        description: activeCampaign.summary || activeCampaign.strategy || "Campanha disponível para revisão e continuidade.",
        channel: activeCampaign.channels?.[0] || "Planejamento",
        dueLabel: activeCampaign.endDate ? `Até ${activeCampaign.endDate}` : "Em andamento",
        tags: (activeCampaign.channels || []).slice(0, 3),
        filePath: activeCampaign.obsidianOutputNotePath,
      };
    }

    if (apiConfig.connectionStatus !== "connected") {
      return {
        id: "connect-obsidian",
        kind: "setup",
        title: "Conectar o Obsidian para liberar a base de conhecimento",
        description: "O sistema precisa validar a conexão e sincronizar o Vault antes de usar o conhecimento do Obsidian.",
        channel: "Configuração",
        dueLabel: "Agora",
        tags: ["Obsidian", "Sincronização"],
      };
    }

    return {
      id: "sync-vault",
      kind: "setup",
      title: "Sincronizar o Vault e iniciar o planejamento",
      description: notes.length > 0
        ? "A base está conectada. Sincronize a Daily Note ou abra o planejamento para definir a próxima ação."
        : "O Vault está conectado, mas ainda não há notas indexadas no painel.",
      channel: "Conhecimento",
      dueLabel: "Agora",
      tags: ["Vault", "Base de conhecimento"],
    };
  }, [pendingTasks, campaigns, apiConfig.connectionStatus, notes.length]);

  const executionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const recentActivities = useMemo(() => {
    const activity: Array<{ id: string; title: string; meta: string; dotClass: string; timestamp?: string }> = [];

    if (apiConfig.lastSyncTime) {
      activity.push({
        id: "obsidian-sync",
        title: "Vault sincronizado",
        meta: "Obsidian",
        dotClass: "bg-emerald-400",
        timestamp: apiConfig.lastSyncTime,
      });
    }

    const latestNote = notes
      .slice()
      .sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")))[0];
    if (latestNote) {
      activity.push({
        id: `note-${latestNote.id}`,
        title: `Nota atualizada: ${latestNote.title}`,
        meta: latestNote.folder || "Cofre",
        dotClass: "bg-cyan-400",
        timestamp: latestNote.lastModified,
      });
    }

    const latestCampaign = campaigns
      .slice()
      .sort((a, b) => String(b.createdDate || "").localeCompare(String(a.createdDate || "")))[0];
    if (latestCampaign) {
      activity.push({
        id: `campaign-${latestCampaign.id}`,
        title: `Campanha: ${latestCampaign.title}`,
        meta: "Planejamento",
        dotClass: "bg-blue-500",
        timestamp: latestCampaign.createdDate,
      });
    }

    const latestCompleted = tasks
      .filter((task) => task.completedAt)
      .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")))[0];
    if (latestCompleted) {
      activity.push({
        id: `task-${latestCompleted.id}`,
        title: `Tarefa concluída: ${latestCompleted.title}`,
        meta: "Execução",
        dotClass: "bg-slate-500",
        timestamp: latestCompleted.completedAt,
      });
    }

    if (activity.length === 0) {
      activity.push({
        id: "empty",
        title: "Nenhuma atividade registrada ainda",
        meta: "Os eventos reais aparecerão aqui após o uso do sistema.",
        dotClass: "bg-slate-600",
      });
    }

    return activity.slice(0, 4);
  }, [apiConfig.lastSyncTime, notes, campaigns, tasks]);

  const handleCompletePriority = () => {
    if (priorityAction.kind === "task") {
      onToggleTaskStatus(priorityAction.id);
    } else if (priorityAction.kind === "campaign") {
      onNavigateTab("campaigns");
    } else if (apiConfig.connectionStatus === "connected") {
      onSyncDailyNote();
    } else {
      onNavigateTab("vault");
    }
    setPriorityActionStatus("done");
    confetti({ particleCount: 28, spread: 55, origin: { y: 0.72 } });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-7 md:px-7 md:py-7 font-sans">
      <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-6">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-[32px] leading-tight font-bold tracking-tight text-slate-50">O que fazer agora?</h1>
            <p className="text-sm text-slate-400 mt-1">Visão geral das prioridades, execução e conhecimento</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSyncDailyNote}
              className="h-9 px-4 rounded-sm border border-[#334155] bg-[#182234] hover:bg-[#1f2d44] text-xs font-semibold text-slate-100 flex items-center gap-2 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Sincronizar Daily Note
            </button>
            <button
              type="button"
              onClick={onOpenNewCampaignModal}
              className="h-9 px-4 rounded-sm bg-[#2563eb] hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
            >
              <Megaphone className="w-4 h-4" />
              Nova Campanha
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
          <section className="col-span-12 xl:col-span-8 flex flex-col gap-6 min-h-0">
            <div className="bg-[#182234] border border-[#334155] border-l-4 border-l-[#2563eb] rounded-sm p-6 flex-1 min-h-[420px] flex flex-col shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm bg-red-950/70 text-red-200 text-[10px] font-bold uppercase tracking-[0.08em]">
                    <span className="w-2 h-2 border border-red-300 rotate-45" />
                    {priorityAction.kind === "task" ? "Prioridade" : priorityAction.kind === "campaign" ? "Campanha" : "Ação"}
                  </span>
                  <span className="px-2 py-1 rounded-sm bg-[#262a33] text-slate-400 text-[10px] font-bold uppercase tracking-[0.08em]">
                    {priorityAction.channel}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap">{priorityAction.dueLabel}</span>
              </div>

              <h2 className="text-xl md:text-[22px] leading-7 font-semibold text-slate-50">{priorityAction.title}</h2>
              <p className="text-sm leading-6 text-slate-400 mt-2 max-w-3xl">{priorityAction.description}</p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 text-xs text-slate-400 font-mono">
                {priorityAction.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> {tag}
                  </span>
                ))}
                {priorityAction.filePath && (
                  <span className="inline-flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" /> {priorityAction.filePath}
                  </span>
                )}
              </div>

              <div className="mt-auto pt-5 border-t border-[#334155] flex flex-wrap items-center gap-3">
                {priorityActionStatus === "done" ? (
                  <span className="inline-flex items-center gap-2 h-9 px-4 rounded-sm bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Ação encaminhada
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCompletePriority}
                      className="h-9 px-5 rounded-sm bg-[#2563eb] hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {priorityAction.kind === "task" ? "Concluir agora" : priorityAction.kind === "campaign" ? "Abrir campanha" : "Executar agora"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriorityActionStatus("postponed")}
                      className="h-9 px-5 rounded-sm bg-[#0f131c] border border-[#334155] hover:bg-[#1c2028] text-slate-200 text-xs font-semibold"
                    >
                      {priorityActionStatus === "postponed" ? "Adiado" : "Adiar"}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onNavigateTab(priorityAction.kind === "task" ? "tasks" : priorityAction.kind === "campaign" ? "campaigns" : "routine")}
                  className="sm:ml-auto h-9 px-4 rounded-sm bg-violet-500/10 border border-violet-400/30 text-violet-300 hover:bg-violet-500/20 text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Gerar/Abrir no Assistente
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              <MetricCard
                icon={<Megaphone className="w-5 h-5" />}
                value={String(campaigns.length)}
                label="Campanhas Estruturadas"
                hint={campaigns.length > 0 ? `${campaigns.filter((campaign) => campaign.status === "active").length} ativas` : "Nenhuma campanha ainda"}
                hintClass="text-emerald-400"
              />
              <MetricCard
                icon={<Zap className="w-5 h-5" />}
                value={`${executionRate}%`}
                label="Taxa de Execução"
                hint={`${completedTasks.length}/${tasks.length} tarefas concluídas`}
                progress={executionRate}
                hintClass="text-amber-400"
              />
              <MetricCard
                icon={<FileText className="w-5 h-5" />}
                value={String(notes.length)}
                label="Notas Indexadas"
                hint={apiConfig.connectionStatus === "connected" ? "Obsidian conectado" : "Obsidian desconectado"}
                hintClass={apiConfig.connectionStatus === "connected" ? "text-emerald-400" : "text-slate-500"}
              />
            </div>
          </section>

          <aside className="col-span-12 xl:col-span-4 flex flex-col gap-6 min-h-0">
            <div className="bg-[#182234] border border-[#334155] rounded-sm p-5 flex-1 min-h-[360px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-100">Atividades Recentes</h3>
                <MoreHorizontal className="w-5 h-5 text-slate-500" />
              </div>

              <div className="relative border-l border-[#334155] pl-4 space-y-6 flex-1">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="relative">
                    <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#182234] ${activity.dotClass}`} />
                    <p className="text-xs font-medium text-slate-200">{activity.title}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                      {formatActivityTime(activity.timestamp)} • {activity.meta}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("tasks")}
                className="mt-4 pt-4 border-t border-[#334155] text-xs text-slate-400 hover:text-slate-200 transition-colors text-center"
              >
                Ver execução
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <Shortcut icon={<LibraryBig className="w-5 h-5" />} label="Conhecimento" onClick={() => onNavigateTab("vault")} />
              <Shortcut icon={<Map className="w-5 h-5" />} label="Planejamento" onClick={() => onNavigateTab("routine")} />
              <Shortcut icon={<Play className="w-5 h-5" />} label="Execução" onClick={() => onNavigateTab("tasks")} />
              <Shortcut icon={<Bot className="w-5 h-5" />} label="Guia do Sistema" onClick={() => onOpenGuide?.()} disabled={!onOpenGuide} />
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-[0.12em] text-slate-500 border-t border-[#1f2937] pt-3">
          <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> IA: {engineMode === "local" ? "Local" : "Gemini"}</span>
          <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${apiConfig.connectionStatus === "connected" ? "bg-emerald-400" : "bg-slate-600"}`} /> Obsidian: {apiConfig.connectionStatus === "connected" ? "Conectado" : "Desconectado"}</span>
          <span className="inline-flex items-center gap-1.5"><FolderTree className="w-3.5 h-3.5" /> {notes.length} notas</span>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> {ideas.length} ideias</span>
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
  hint: string;
  hintClass: string;
  progress?: number;
}> = ({ icon, value, label, hint, hintClass, progress }) => (
  <div className="bg-[#182234] border border-[#334155] rounded-sm p-5 min-h-[150px] flex flex-col justify-between hover:border-[#475569] transition-colors">
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-400">{icon}</span>
      <span className={`text-[10px] font-mono ${hintClass}`}>{hint}</span>
    </div>
    <div className="mt-5">
      <div className="text-xl font-semibold text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 w-full bg-[#262a33] rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  </div>
);

const Shortcut: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="min-h-[82px] bg-[#1c2028] hover:bg-[#262a33] disabled:opacity-50 border border-[#334155] rounded-sm p-4 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-100 transition-colors"
  >
    {icon}
    <span className="text-xs font-medium text-slate-200">{label}</span>
  </button>
);
