import React, { useMemo } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock3,
  FileText,
  FolderOpen,
  Sparkles,
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

function compactText(note: ObsidianNote): string {
  const declared = note.frontmatter?.summary;
  if (typeof declared === "string" && declared.trim()) return declared.trim();
  const cleaned = (note.content || "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 180) || "Sem resumo disponível.";
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  notes = [],
  campaigns = [],
  tasks = [],
  apiConfig,
  engineMode,
  onNavigateTab,
  onSelectNote,
  onToggleTaskStatus,
  onOpenNewCampaignModal,
  onSyncDailyNote,
  onOpenSetupWizard,
}) => {
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);
  const completion = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const folders = useMemo(() => new Set(notes.map((n) => n.folder || "Raiz")).size, [notes]);

  const priorityTask = useMemo(() => {
    return (
      pendingTasks.find((t) => t.priority === "urgent") ||
      pendingTasks.find((t) => t.priority === "high") ||
      pendingTasks[0] ||
      null
    );
  }, [pendingTasks]);

  const recentKnowledge = useMemo(
    () => [...notes].sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified))).slice(0, 4),
    [notes]
  );

  const recentCampaigns = useMemo(() => campaigns.slice(0, 3), [campaigns]);
  const connected = apiConfig.connectionStatus === "connected";

  return (
    <div className="h-[calc(100vh-7.5rem)] md:h-[calc(100vh-5rem)] overflow-y-auto pr-1 pb-6">
      <div className="max-w-[1440px] mx-auto space-y-5">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-stone-400"}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                {connected ? `${apiConfig.vaultName || "Obsidian"} sincronizado` : "Obsidian desconectado"}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-stone-950">O que precisa avançar hoje?</h1>
            <p className="text-xs text-stone-500 mt-1">Prioridades, conhecimento novo e execução em uma única visão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onOpenSetupWizard && (
              <button onClick={onOpenSetupWizard} className="h-9 px-3 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700">Configuração</button>
            )}
            <button onClick={onSyncDailyNote} disabled={!connected} className="h-9 px-3 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700 disabled:opacity-40">
              <Calendar className="w-3.5 h-3.5 inline mr-1.5" />Daily Note
            </button>
            <button onClick={onOpenNewCampaignModal} className="h-9 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />Nova campanha
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Conhecimento", value: notes.length, detail: `${folders} pastas`, icon: FolderOpen },
            { label: "Pendências", value: pendingTasks.length, detail: `${completion}% concluído`, icon: CheckSquare },
            { label: "Campanhas", value: campaigns.length, detail: `${campaigns.filter((c) => c.status === "active").length} ativas`, icon: Target },
            { label: "Motor", value: engineMode === "local" ? "Local" : "IA", detail: engineMode === "local" ? "sem consumo de API" : "Gemini conectado", icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="h-28 rounded-2xl bg-white border border-stone-200 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">{item.label}</span>
                  <Icon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-black text-stone-950">{item.value}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">{item.detail}</div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          <div className="xl:col-span-7 rounded-2xl bg-white border border-stone-200 p-5 min-h-[230px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-purple-700">Prioridade</div>
                <h2 className="text-sm font-black text-stone-950 mt-0.5">Próxima ação</h2>
              </div>
              <Clock3 className="w-4 h-4 text-stone-400" />
            </div>

            {priorityTask ? (
              <div className="h-[160px] flex flex-col justify-between">
                <div>
                  <div className="flex gap-2 mb-2">
                    <span className="px-2 py-1 rounded-lg bg-stone-100 text-[10px] font-bold uppercase text-stone-600">{priorityTask.priority}</span>
                    {priorityTask.channel && <span className="px-2 py-1 rounded-lg bg-purple-50 text-[10px] font-bold text-purple-700">{priorityTask.channel}</span>}
                  </div>
                  <h3 className="text-lg font-black text-stone-950">{priorityTask.title}</h3>
                  <p className="text-xs text-stone-600 mt-2 line-clamp-3">{priorityTask.description || "Tarefa pendente aguardando execução."}</p>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
                  <button onClick={() => onToggleTaskStatus(priorityTask.id)} className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />Concluir
                  </button>
                  <button onClick={() => onNavigateTab("tasks")} className="h-9 px-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-700">Abrir execução</button>
                </div>
              </div>
            ) : (
              <div className="h-[160px] rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-center p-5">
                <div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-800">Nenhuma tarefa pendente.</p>
                  <p className="text-xs text-stone-500 mt-1">O sistema não vai inventar uma prioridade sem dados.</p>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-5 rounded-2xl bg-white border border-stone-200 p-5 min-h-[230px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">Base de conhecimento</div>
                <h2 className="text-sm font-black text-stone-950 mt-0.5">Informações recentes</h2>
              </div>
              <button onClick={() => onNavigateTab("vault")} className="text-[10px] font-bold text-purple-700 flex items-center gap-1">Ver cofre <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="space-y-2">
              {recentKnowledge.length ? recentKnowledge.map((note) => (
                <button
                  key={note.path}
                  onClick={() => onSelectNote(note)}
                  className="w-full h-12 rounded-xl hover:bg-stone-50 border border-transparent hover:border-stone-200 px-2.5 flex items-center gap-2.5 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><FileText className="w-3.5 h-3.5 text-purple-700" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-stone-900 truncate">{note.title}</div>
                    <div className="text-[10px] text-stone-500 truncate">{compactText(note)}</div>
                  </div>
                </button>
              )) : (
                <div className="h-36 flex items-center justify-center text-xs text-stone-500">Conecte o Obsidian para carregar conhecimento.</div>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-stone-950">Campanhas recentes</h2>
              <button onClick={() => onNavigateTab("campaigns")} className="text-[10px] font-bold text-purple-700">Abrir resultados</button>
            </div>
            <div className="space-y-2">
              {recentCampaigns.length ? recentCampaigns.map((campaign) => (
                <div key={campaign.id} className="h-14 px-3 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-stone-900 truncate">{campaign.title}</div>
                    <div className="text-[10px] text-stone-500 truncate">{campaign.summary || campaign.objective}</div>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-stone-500 shrink-0">{campaign.status}</span>
                </div>
              )) : <div className="h-20 flex items-center justify-center text-xs text-stone-500">Nenhuma campanha criada.</div>}
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-stone-200 p-5">
            <h2 className="text-sm font-black text-stone-950 mb-3">Navegação rápida</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Cofre", tab: "vault" as const, icon: FolderOpen },
                { label: "Planejar", tab: "routine" as const, icon: Calendar },
                { label: "Executar", tab: "tasks" as const, icon: CheckSquare },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} onClick={() => onNavigateTab(item.tab)} className="h-20 rounded-xl border border-stone-200 hover:border-purple-300 bg-white flex flex-col items-center justify-center gap-2">
                    <Icon className="w-4 h-4 text-purple-700" />
                    <span className="text-[10px] font-bold text-stone-700">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
