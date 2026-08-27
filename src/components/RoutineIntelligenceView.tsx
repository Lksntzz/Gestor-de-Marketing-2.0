import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type {
  DailyRoutineSlot,
  EmotionalDriver,
  EmotionalDriverKey,
  EngineMode,
  LearningInsight,
  MarketingCampaign,
  MarketingTask,
  NicheSegment,
  NicheSegmentKey,
  ObsidianApiConfig,
  ObsidianNote,
  PostHistoryItem,
} from "../types";
import { APP_STATE_CHANGED_EVENT } from "../hooks/usePersistentState";
import { AppStateSchemas } from "../domain/appStateSchemas";
import { APP_STATE_KEYS, StorageManager } from "../services/storage/StorageManager";
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { buildPlanningSnapshot } from "../utils/planningIntelligence";

interface RoutineIntelligenceViewProps {
  emotionalDrivers: EmotionalDriver[];
  niches: NicheSegment[];
  postHistory: PostHistoryItem[];
  learnings: LearningInsight[];
  weeklyRoutine: DailyRoutineSlot[];
  apiConfig: ObsidianApiConfig;
  engineMode: EngineMode;
  notes: ObsidianNote[];
  onAddPostHistory: (post: Omit<PostHistoryItem, "id">) => void;
  onAddLearning: (learning: Omit<LearningInsight, "id">) => void;
  onUpdateRoutineSlot: (slotId: string, updated: Partial<DailyRoutineSlot>) => void;
  onAddRoutineSlot?: (slot: Omit<DailyRoutineSlot, "id">) => void;
  onCreateCampaignFromSuggestion: (data: {
    title: string;
    niche: NicheSegmentKey;
    emotion: EmotionalDriverKey;
    format: string;
    hook: string;
  }) => void;
  onSyncRoutineToDailyNotes: () => void | Promise<void>;
  showToast: (type: "success" | "warning" | "info", title: string, message: string) => void;
}

const storage = StorageManager.getInstance();
const DAY_ORDER: DailyRoutineSlot["dayOfWeek"][] = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDateTime(value?: string): string {
  if (!value) return "Sem sincronização registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function routineStatusLabel(status: DailyRoutineSlot["status"]): string {
  if (status === "publicado") return "Publicado";
  if (status === "agendado") return "Agendado";
  if (status === "em-producao") return "Em produção";
  return "Planejando";
}

function loadTasks(): MarketingTask[] {
  return storage.loadAppState(APP_STATE_KEYS.TASKS, [], AppStateSchemas.tasks);
}

function loadCampaigns(): MarketingCampaign[] {
  return storage.loadAppState(APP_STATE_KEYS.CAMPAIGNS, [], AppStateSchemas.campaigns);
}

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  emotionalDrivers = [],
  niches = [],
  postHistory = [],
  learnings = [],
  weeklyRoutine = [],
  apiConfig,
  engineMode,
  notes = [],
  onAddLearning,
  onUpdateRoutineSlot,
  onAddRoutineSlot,
  onCreateCampaignFromSuggestion,
  onSyncRoutineToDailyNotes,
  showToast,
}) => {
  const [liveTasks, setLiveTasks] = useState<MarketingTask[]>(() => loadTasks());
  const [liveCampaigns, setLiveCampaigns] = useState<MarketingCampaign[]>(() => loadCampaigns());
  const [isSyncingPlan, setIsSyncingPlan] = useState(false);
  const [isAddLearningOpen, setIsAddLearningOpen] = useState(false);
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);

  const [learningTitle, setLearningTitle] = useState("");
  const [learningCategory, setLearningCategory] = useState<LearningInsight["category"]>("formato");
  const [learningVerdict, setLearningVerdict] = useState<LearningInsight["verdict"]>("EM_TESTE");
  const [learningRule, setLearningRule] = useState("");
  const [learningEvidence, setLearningEvidence] = useState("");
  const [learningAction, setLearningAction] = useState("");

  const [slotTitle, setSlotTitle] = useState("");
  const [slotDay, setSlotDay] = useState<DailyRoutineSlot["dayOfWeek"] | "">("");
  const [slotTime, setSlotTime] = useState("");
  const [slotFormat, setSlotFormat] = useState<DailyRoutineSlot["recommendedFormat"] | "">("");
  const [slotNiche, setSlotNiche] = useState<NicheSegmentKey | "">("");
  const [slotEmotion, setSlotEmotion] = useState<EmotionalDriverKey | "">("");
  const [slotHook, setSlotHook] = useState("");
  const [slotAction, setSlotAction] = useState("");

  useEffect(() => {
    const refresh = (event?: Event) => {
      const key = (event as CustomEvent<{ key?: string }> | undefined)?.detail?.key;
      if (!key || key === APP_STATE_KEYS.TASKS) setLiveTasks(loadTasks());
      if (!key || key === APP_STATE_KEYS.CAMPAIGNS) setLiveCampaigns(loadCampaigns());
    };

    refresh();
    window.addEventListener(APP_STATE_CHANGED_EVENT, refresh as EventListener);
    return () => window.removeEventListener(APP_STATE_CHANGED_EVENT, refresh as EventListener);
  }, []);

  const snapshot = useMemo(
    () => buildPlanningSnapshot({
      tasks: liveTasks,
      campaigns: liveCampaigns,
      weeklyRoutine,
      notes,
      postHistory,
      learnings,
    }),
    [liveTasks, liveCampaigns, weeklyRoutine, notes, postHistory, learnings]
  );

  const orderedRoutine = useMemo(
    () => weeklyRoutine.slice().sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)),
    [weeklyRoutine]
  );

  const nicheName = (id: NicheSegmentKey) => niches.find((item) => item.id === id)?.name || id;

  const handleToggleRoutineStatus = (slot: DailyRoutineSlot) => {
    const nextStatus = slot.status === "publicado" ? "planejando" : "publicado";
    onUpdateRoutineSlot(slot.id, { status: nextStatus });
    showToast(
      "info",
      nextStatus === "publicado" ? "Pauta marcada como publicada" : "Pauta reaberta",
      nextStatus === "publicado"
        ? "Somente o status da pauta foi alterado. Nenhuma métrica de resultado foi criada automaticamente."
        : "A pauta voltou ao planejamento sem alterar o histórico de resultados."
    );
  };

  const handleSyncPlan = async () => {
    if (apiConfig.connectionStatus !== "connected") {
      showToast("warning", "Obsidian desconectado", "Conecte o Vault antes de sincronizar o planejamento semanal.");
      return;
    }
    setIsSyncingPlan(true);
    try {
      await Promise.resolve(onSyncRoutineToDailyNotes());
    } finally {
      setIsSyncingPlan(false);
    }
  };

  const handleAddLearning = (event: React.FormEvent) => {
    event.preventDefault();
    if (!learningTitle.trim() || !learningRule.trim() || !learningEvidence.trim() || !learningAction.trim()) {
      showToast("warning", "Aprendizado incompleto", "Título, regra, evidência e ação são obrigatórios para evitar aprendizado sem base.");
      return;
    }

    onAddLearning({
      title: learningTitle.trim(),
      category: learningCategory,
      verdict: learningVerdict,
      ruleOfThumb: learningRule.trim(),
      evidenceData: learningEvidence.trim(),
      suggestedAction: learningAction.trim(),
      dateCreated: new Date().toISOString().slice(0, 10),
    });
    setLearningTitle("");
    setLearningRule("");
    setLearningEvidence("");
    setLearningAction("");
    setIsAddLearningOpen(false);
    showToast("success", "Aprendizado registrado", "O aprendizado foi salvo com evidência explícita e ação recomendada.");
  };

  const handleAddSlot = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onAddRoutineSlot) return;
    if (!slotTitle.trim() || !slotDay || !slotFormat || !slotNiche || !slotEmotion) {
      showToast("warning", "Pauta incompleta", "Tema, dia, formato, nicho e gatilho emocional precisam ser escolhidos explicitamente.");
      return;
    }

    onAddRoutineSlot({
      dayOfWeek: slotDay,
      focusTheme: slotTitle.trim(),
      primaryEmotion: slotEmotion,
      primaryNiche: slotNiche,
      recommendedFormat: slotFormat,
      optimalTime: slotTime.trim(),
      suggestedHookPattern: slotHook.trim(),
      plannedAction: slotAction.trim(),
      status: "planejando",
    });

    setSlotTitle("");
    setSlotDay("");
    setSlotTime("");
    setSlotFormat("");
    setSlotNiche("");
    setSlotEmotion("");
    setSlotHook("");
    setSlotAction("");
    setIsAddSlotOpen(false);
    showToast("success", "Pauta adicionada", "A pauta entrou na semana apenas com os campos informados.");
  };

  const planningReadyForSlot = niches.length > 0 && emotionalDrivers.length > 0;

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-4 font-sans">
      <header className="shrink-0 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 pb-3 border-b border-outline-border">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-pink-500">
            <Target className="w-3.5 h-3.5" />
            Planejamento fundamentado
          </div>
          <h1 className="text-2xl font-black text-text-primary mt-1">Planejamento</h1>
          <p className="text-xs text-text-secondary mt-1 max-w-3xl">
            Prioridades, semana, pautas e aprendizados são derivados somente dos registros atuais. O planejamento não fabrica métricas, horários, desempenho ou fatos comerciais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`px-3 py-2 rounded-xl border text-[11px] font-bold ${apiConfig.connectionStatus === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {apiConfig.connectionStatus === "connected" ? "Obsidian conectado" : "Obsidian bloqueado"}
          </div>
          <div className="px-3 py-2 rounded-xl border border-outline-border bg-surface-container-low text-[11px] text-text-secondary">
            Motor: <strong className="text-text-primary">{engineMode === "local" ? "Local" : "Gemini"}</strong>
          </div>
          <button
            type="button"
            onClick={handleSyncPlan}
            disabled={isSyncingPlan || apiConfig.connectionStatus !== "connected"}
            className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-2"
          >
            {isSyncingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar semana
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto xl:overflow-hidden no-scrollbar">
        <div className="xl:col-span-7 flex flex-col gap-4 min-h-0">
          <section className="bg-surface-card border border-outline-border rounded-xl p-5 shrink-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-black text-pink-400">Próximo passo</span>
                <h2 className="text-lg font-black text-text-primary mt-1">O que fazer agora</h2>
              </div>
              <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black ${snapshot.nextAction.urgency === "overdue" ? "border-red-500/30 bg-red-500/10 text-red-300" : snapshot.nextAction.urgency === "today" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-outline-border bg-surface-container-low text-text-secondary"}`}>
                {snapshot.nextAction.sourceLabel}
              </span>
            </div>
            <div className="rounded-xl border border-outline-border bg-surface-container-low p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                  {snapshot.nextAction.urgency === "overdue" ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <Sparkles className="w-5 h-5 text-pink-400" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-text-primary">{snapshot.nextAction.title}</h3>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">{snapshot.nextAction.detail}</p>
                  <p className="text-[10px] text-text-secondary/70 mt-3">Fonte da prioridade: {snapshot.nextAction.sourceLabel}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {[
              ["Abertas", snapshot.openTasks.length, "tarefas"],
              ["Vencidas", snapshot.overdueTasks.length, "tarefas"],
              ["Campanhas", snapshot.openCampaigns.length, "abertas"],
              ["Base confirmada", snapshot.confirmedKnowledgeCount, "fontes"],
            ].map(([label, value, suffix]) => (
              <div key={String(label)} className="bg-surface-card border border-outline-border rounded-xl p-4 min-h-[92px]">
                <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">{label}</span>
                <div className="text-2xl font-black text-text-primary mt-2">{value}</div>
                <span className="text-[10px] text-text-secondary">{suffix}</span>
              </div>
            ))}
          </section>

          <section className="bg-surface-card border border-outline-border rounded-xl p-5 flex-1 min-h-[280px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase tracking-widest font-black text-text-secondary">Semana</span>
                <h2 className="text-base font-black text-text-primary mt-1">Pautas registradas</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSlotOpen(true)}
                disabled={!onAddRoutineSlot || !planningReadyForSlot}
                title={!planningReadyForSlot ? "Cadastre ao menos um nicho e um gatilho emocional antes de criar pautas neste modelo." : "Adicionar pauta"}
                className="px-3 py-2 rounded-xl border border-outline-border bg-surface-container-low text-xs font-bold text-text-primary disabled:opacity-40 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar pauta
              </button>
            </div>

            {!planningReadyForSlot && (
              <div className="mb-3 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-200">
                A criação de pauta exige que nichos e gatilhos emocionais existam na base. O sistema não seleciona esses valores por conta própria.
              </div>
            )}

            <div className="space-y-2 overflow-y-auto no-scrollbar pr-1">
              {orderedRoutine.length === 0 ? (
                <div className="h-36 flex items-center justify-center text-center text-xs text-text-secondary">
                  Nenhuma pauta semanal registrada.
                </div>
              ) : orderedRoutine.map((slot) => (
                <div key={slot.id} className="p-3 rounded-xl border border-outline-border bg-surface-container-low flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleRoutineStatus(slot)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${slot.status === "publicado" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-outline-border text-text-secondary"}`}
                    title={slot.status === "publicado" ? "Reabrir pauta" : "Marcar como publicada"}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs text-text-primary truncate">{slot.focusTheme}</strong>
                      <span className="text-[9px] px-2 py-0.5 rounded-md border border-outline-border text-text-secondary">{routineStatusLabel(slot.status)}</span>
                    </div>
                    <p className="text-[10px] text-text-secondary mt-1">
                      {slot.dayOfWeek}{slot.optimalTime ? ` • ${slot.optimalTime}` : ""} • {slot.recommendedFormat} • {nicheName(slot.primaryNiche)}
                    </p>
                  </div>
                  {slot.status !== "publicado" && (
                    <button
                      type="button"
                      onClick={() => onCreateCampaignFromSuggestion({
                        title: slot.focusTheme,
                        niche: slot.primaryNiche,
                        emotion: slot.primaryEmotion,
                        format: slot.recommendedFormat,
                        hook: slot.suggestedHookPattern,
                      })}
                      className="px-2.5 py-1.5 rounded-lg border border-outline-border text-[10px] font-bold text-text-primary hover:border-pink-500/40 flex items-center gap-1"
                    >
                      Briefing <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="xl:col-span-5 flex flex-col gap-4 min-h-0">
          <section className="bg-surface-card border border-outline-border rounded-xl p-5 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-pink-400" />
              <h2 className="text-sm font-black text-text-primary">Hoje e esta semana</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3">
                <strong className="text-lg text-text-primary block">{snapshot.todayTasks.length}</strong>
                <span className="text-[9px] text-text-secondary uppercase">Hoje</span>
              </div>
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3">
                <strong className="text-lg text-text-primary block">{snapshot.weekTasks.length}</strong>
                <span className="text-[9px] text-text-secondary uppercase">Semana</span>
              </div>
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3">
                <strong className="text-lg text-text-primary block">{snapshot.pendingKnowledge.length}</strong>
                <span className="text-[9px] text-text-secondary uppercase">Revisões</span>
              </div>
            </div>
            <p className="text-[10px] text-text-secondary mt-3 flex items-center gap-1.5">
              <Clock3 className="w-3 h-3" /> Última sincronização: {formatDateTime(apiConfig.lastSyncTime)}
            </p>
          </section>

          {snapshot.openCampaigns.length > 0 && (
            <section className="bg-surface-card border border-outline-border rounded-xl p-5 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-pink-400" />
                <h2 className="text-sm font-black text-text-primary">Campanhas abertas</h2>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
                {snapshot.openCampaigns.slice(0, 4).map((campaign) => (
                  <div key={campaign.id} className="rounded-xl border border-outline-border bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-xs text-text-primary truncate">{campaign.title}</strong>
                      <span className="text-[9px] text-text-secondary uppercase">{campaign.status}</span>
                    </div>
                    {(campaign.startDate || campaign.endDate) && (
                      <p className="text-[10px] text-text-secondary mt-1">
                        {campaign.startDate || "Sem início"}{campaign.endDate ? ` → ${campaign.endDate}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-surface-card border border-outline-border rounded-xl p-5 shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-pink-400" />
              <div>
                <h2 className="text-sm font-black text-text-primary">Resultados registrados</h2>
                <p className="text-[10px] text-text-secondary">Sem projeções ou tendências simuladas</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3"><span className="text-[9px] text-text-secondary uppercase">Publicações</span><strong className="block text-lg text-text-primary mt-1">{snapshot.performance.publishedItems}</strong></div>
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3"><span className="text-[9px] text-text-secondary uppercase">Alcance</span><strong className="block text-lg text-text-primary mt-1">{formatNumber(snapshot.performance.reach)}</strong></div>
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3"><span className="text-[9px] text-text-secondary uppercase">Leads/cliques</span><strong className="block text-lg text-text-primary mt-1">{formatNumber(snapshot.performance.leads)}</strong></div>
              <div className="rounded-xl bg-surface-container-low border border-outline-border p-3"><span className="text-[9px] text-text-secondary uppercase">CTR médio</span><strong className="block text-lg text-text-primary mt-1">{snapshot.performance.averageCtr === null ? "—" : `${snapshot.performance.averageCtr.toFixed(1)}%`}</strong></div>
            </div>
          </section>

          <section className="bg-surface-card border border-outline-border rounded-xl p-5 flex-1 min-h-[240px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <div>
                  <h2 className="text-sm font-black text-text-primary">Aprendizados</h2>
                  <p className="text-[10px] text-text-secondary">Cada regra precisa ter evidência registrada</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsAddLearningOpen(true)} className="w-8 h-8 rounded-lg border border-outline-border bg-surface-container-low text-text-primary flex items-center justify-center" title="Registrar aprendizado">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto no-scrollbar pr-1">
              {learnings.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-center text-xs text-text-secondary">Nenhum aprendizado registrado com evidência.</div>
              ) : learnings.map((learning) => (
                <div key={learning.id} className="p-3 rounded-xl border border-outline-border bg-surface-container-low">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs text-text-primary">{learning.title}</strong>
                    <span className="text-[9px] px-2 py-0.5 rounded-md border border-outline-border text-text-secondary">{learning.verdict.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-[11px] text-text-primary mt-2 leading-relaxed">{learning.ruleOfThumb}</p>
                  <p className="text-[10px] text-text-secondary mt-2"><strong>Evidência:</strong> {learning.evidenceData}</p>
                  <p className="text-[10px] text-text-secondary mt-1"><strong>Próxima ação:</strong> {learning.suggestedAction}</p>
                </div>
              ))}
            </div>
          </section>

          {snapshot.pendingKnowledge[0] && (
            <a
              href={buildObsidianOpenUri(apiConfig.vaultName, snapshot.pendingKnowledge[0].path)}
              className="shrink-0 p-3 rounded-xl border border-amber-500/25 bg-amber-500/10 flex items-center gap-3 text-left"
            >
              <FileText className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] uppercase tracking-wider font-black text-amber-300">Revisão de conhecimento</span>
                <p className="text-xs text-text-primary truncate mt-0.5">{snapshot.pendingKnowledge[0].title}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-300" />
            </a>
          )}
        </div>
      </div>

      {isAddLearningOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddLearning} className="w-full max-w-xl rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div><span className="text-[10px] text-pink-400 uppercase tracking-widest font-black">Evidência obrigatória</span><h2 className="text-lg font-black text-text-primary mt-1">Registrar aprendizado</h2></div>
              <button type="button" onClick={() => setIsAddLearningOpen(false)} className="w-8 h-8 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={learningTitle} onChange={(e) => setLearningTitle(e.target.value)} placeholder="Título do aprendizado" className="col-span-2 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <select value={learningCategory} onChange={(e) => setLearningCategory(e.target.value as LearningInsight["category"])} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="formato">Formato</option><option value="horario">Horário</option><option value="nicho">Nicho</option><option value="emocao">Emoção</option><option value="copywriting">Copywriting</option></select>
              <select value={learningVerdict} onChange={(e) => setLearningVerdict(e.target.value as LearningInsight["verdict"])} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="EM_TESTE">Em teste</option><option value="VENCEDOR">Vencedor</option><option value="ALTO_IMPACTO">Alto impacto</option><option value="A_EVITAR">A evitar</option></select>
              <textarea value={learningRule} onChange={(e) => setLearningRule(e.target.value)} placeholder="Regra observada" className="col-span-2 h-20 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none" />
              <textarea value={learningEvidence} onChange={(e) => setLearningEvidence(e.target.value)} placeholder="Evidência real: campanha, publicação, métrica, nota ou experimento" className="col-span-2 h-20 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none" />
              <textarea value={learningAction} onChange={(e) => setLearningAction(e.target.value)} placeholder="Ação que deve ser testada/aplicada a partir dessa evidência" className="col-span-2 h-20 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setIsAddLearningOpen(false)} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-primary">Cancelar</button><button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-black">Salvar aprendizado</button></div>
          </form>
        </div>
      )}

      {isAddSlotOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddSlot} className="w-full max-w-2xl rounded-2xl border border-outline-border bg-surface-card p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div><span className="text-[10px] text-pink-400 uppercase tracking-widest font-black">Sem preenchimento automático</span><h2 className="text-lg font-black text-text-primary mt-1">Adicionar pauta à semana</h2></div>
              <button type="button" onClick={() => setIsAddSlotOpen(false)} className="w-8 h-8 rounded-lg border border-outline-border flex items-center justify-center text-text-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="Tema da pauta" className="md:col-span-2 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <select value={slotDay} onChange={(e) => setSlotDay(e.target.value as DailyRoutineSlot["dayOfWeek"])} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="">Escolha o dia</option>{DAY_ORDER.map((day) => <option key={day} value={day}>{day}</option>)}</select>
              <input value={slotTime} onChange={(e) => setSlotTime(e.target.value)} type="time" className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <select value={slotFormat} onChange={(e) => setSlotFormat(e.target.value as DailyRoutineSlot["recommendedFormat"])} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="">Escolha o formato</option><option value="carrossel">Carrossel</option><option value="reels_video">Reels / vídeo</option><option value="artigo_blog">Artigo</option><option value="newsletter">Newsletter</option><option value="thread_post">Thread / post</option></select>
              <select value={slotNiche} onChange={(e) => setSlotNiche(e.target.value as NicheSegmentKey)} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="">Escolha o nicho</option>{niches.map((niche) => <option key={niche.id} value={niche.id}>{niche.name}</option>)}</select>
              <select value={slotEmotion} onChange={(e) => setSlotEmotion(e.target.value as EmotionalDriverKey)} className="bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none"><option value="">Escolha o gatilho</option>{emotionalDrivers.map((emotion) => <option key={emotion.id} value={emotion.id}>{emotion.name}</option>)}</select>
              <input value={slotHook} onChange={(e) => setSlotHook(e.target.value)} placeholder="Gancho (opcional)" className="md:col-span-2 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none" />
              <textarea value={slotAction} onChange={(e) => setSlotAction(e.target.value)} placeholder="Ação planejada (opcional)" className="md:col-span-2 h-20 bg-surface-container-lowest border border-outline-border rounded-xl px-3 py-2 text-xs text-text-primary outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setIsAddSlotOpen(false)} className="px-4 py-2 rounded-xl border border-outline-border text-xs font-bold text-text-primary">Cancelar</button><button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-black">Adicionar pauta</button></div>
          </form>
        </div>
      )}
    </div>
  );
};
