import React, { useMemo } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  FlaskConical,
  Lightbulb,
  Megaphone,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  DailyRoutineSlot,
  EmotionalDriver,
  EmotionalDriverKey,
  EngineMode,
  LearningInsight,
  NicheSegment,
  NicheSegmentKey,
  ObsidianApiConfig,
  ObsidianNote,
  PostHistoryItem,
} from "../types";

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
  onCreateCampaignFromSuggestion: (data: {
    title: string;
    niche: NicheSegmentKey;
    emotion: EmotionalDriverKey;
    format: string;
    hook: string;
  }) => void;
  onSyncRoutineToDailyNotes: () => void;
  showToast: (type: "success" | "warning" | "info", title: string, message: string) => void;
}

const DAYS: DailyRoutineSlot["dayOfWeek"][] = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

const FORMAT_LABELS: Record<string, string> = {
  carrossel: "Carrossel",
  reels_video: "Reels / Vídeo",
  artigo_blog: "Artigo",
  newsletter: "Newsletter",
  thread_post: "Thread",
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  emotionalDrivers,
  niches,
  postHistory,
  learnings,
  weeklyRoutine,
  apiConfig,
  engineMode,
  notes,
  onUpdateRoutineSlot,
  onCreateCampaignFromSuggestion,
  onSyncRoutineToDailyNotes,
  showToast,
}) => {
  const currentDay = DAYS[(new Date().getDay() + 6) % 7];

  const nextRecommendation = useMemo(() => {
    if (!weeklyRoutine.length) return null;
    return (
      weeklyRoutine.find((slot) => slot.dayOfWeek === currentDay && slot.status !== "publicado") ||
      weeklyRoutine.find((slot) => slot.status !== "publicado") ||
      weeklyRoutine[0]
    );
  }, [weeklyRoutine, currentDay]);

  const performance = useMemo(() => {
    const totalReach = postHistory.reduce((sum, item) => sum + (item.metrics?.reach || item.metrics?.impressions || 0), 0);
    const avgCtr = postHistory.length
      ? postHistory.reduce((sum, item) => sum + (item.metrics?.ctrPercent || 0), 0) / postHistory.length
      : 0;
    const totalSaves = postHistory.reduce((sum, item) => sum + (item.metrics?.saves || 0), 0);
    const totalLeads = postHistory.reduce((sum, item) => sum + (item.metrics?.clicksOrLeads || 0), 0);
    return { totalReach, avgCtr, totalSaves, totalLeads };
  }, [postHistory]);

  const validatedLearnings = useMemo(
    () => learnings.filter((item) => item.verdict !== "EM_TESTE").slice(0, 3),
    [learnings]
  );

  const formatName = (format?: string) => FORMAT_LABELS[String(format || "")] || String(format || "Formato não definido");

  const handlePublish = () => {
    if (!nextRecommendation) return;
    onUpdateRoutineSlot(nextRecommendation.id, { status: "publicado" });
    showToast("success", "Planejamento Atualizado", "A ação foi marcada como publicada no planejamento. Nenhuma publicação externa foi executada.");
  };

  const handleGenerateCampaign = () => {
    if (!nextRecommendation) return;
    onCreateCampaignFromSuggestion({
      title: nextRecommendation.plannedAction || nextRecommendation.focusTheme || "Campanha baseada no planejamento",
      niche: nextRecommendation.primaryNiche,
      emotion: nextRecommendation.primaryEmotion,
      format: nextRecommendation.recommendedFormat,
      hook: nextRecommendation.suggestedHookPattern || "",
    });
  };

  const handleDefer = () => {
    if (!nextRecommendation) return;
    onUpdateRoutineSlot(nextRecommendation.id, { status: "planejando" });
    showToast("info", "Ação Adiada", "O item voltou para planejamento e permanece disponível na rotina semanal.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f131c] text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 px-6 py-7 font-sans overflow-y-auto">
      <div className="max-w-[1600px] mx-auto space-y-7">
        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#b4c5ff]" /> Próxima Recomendação
            </h1>
            <span className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2.5 py-1 border rounded-sm ${nextRecommendation ? "text-violet-200 bg-violet-950/60 border-violet-600" : "text-slate-500 border-[#334155]"}`}>
              {nextRecommendation ? "Prioridade" : "Sem dados"}
            </span>
          </div>

          <div className="bg-[#182234] border border-[#334155] border-l-4 border-l-violet-600 rounded-sm p-5 md:p-6">
            {nextRecommendation ? (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-6">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-violet-300">
                    {nextRecommendation.focusTheme || "Planejamento semanal"} • {formatName(nextRecommendation.recommendedFormat)}
                  </p>
                  <h2 className="text-2xl font-semibold mt-1 text-slate-50">
                    {nextRecommendation.plannedAction || nextRecommendation.focusTheme}
                  </h2>
                  <div className="mt-5 bg-[#0f131c] border border-[#263140] p-4 text-sm text-slate-300 leading-6">
                    <strong className="text-slate-100">Gancho:</strong>{" "}
                    {nextRecommendation.suggestedHookPattern || "Nenhum gancho registrado para este item."}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-slate-400 font-mono">
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> {nextRecommendation.dayOfWeek}, {nextRecommendation.optimalTime || "horário pendente"}</span>
                    <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {formatName(nextRecommendation.recommendedFormat)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 content-start">
                  <button onClick={handlePublish} className="col-span-2 h-10 bg-[#2563eb] hover:bg-blue-500 text-xs font-semibold flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Marcar Publicado</button>
                  <button onClick={handleGenerateCampaign} className="col-span-2 h-10 bg-[#111827] border border-[#475569] hover:bg-[#263140] text-xs font-semibold flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Gerar Campanha</button>
                  <button onClick={() => onSyncRoutineToDailyNotes()} className="h-9 bg-[#111827] border border-[#334155] hover:bg-[#263140] text-xs font-semibold">Nota</button>
                  <button onClick={handleDefer} className="h-9 bg-[#111827] border border-[#334155] hover:bg-[#263140] text-xs font-semibold flex items-center justify-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Adiar</button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <CalendarDays className="w-9 h-9 mx-auto text-slate-600" />
                <h2 className="text-lg font-semibold mt-3">Nenhuma recomendação validada para esta semana</h2>
                <p className="text-sm text-slate-500 mt-2">Adicione ou sincronize a rotina. O sistema não inventa uma pauta quando não há dados registrados.</p>
                <button onClick={onSyncRoutineToDailyNotes} className="mt-4 h-9 px-4 bg-[#2563eb] hover:bg-blue-500 text-xs font-semibold">Sincronizar Planejamento</button>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-semibold flex items-center gap-2"><CalendarDays className="w-5 h-5 text-slate-400" /> Execução da Rotina Semanal</h2>
            <span className="text-xs text-slate-500 font-mono">Semana atual</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            {DAYS.map((day) => {
              const daySlots = weeklyRoutine.filter((slot) => slot.dayOfWeek === day);
              return (
                <div key={day} className={`min-h-[250px] border rounded-sm ${day === currentDay ? "border-[#64748b] bg-[#151b27]" : "border-[#263140] bg-[#11161f]"}`}>
                  <div className={`h-10 px-3 flex items-center justify-center border-b text-[10px] font-bold uppercase tracking-[0.1em] ${day === currentDay ? "text-[#b4c5ff] border-[#475569] bg-[#1c2434]" : "text-slate-500 border-[#263140]"}`}>{day.slice(0, 3)}</div>
                  <div className="p-2 space-y-2">
                    {daySlots.length ? daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => onUpdateRoutineSlot(slot.id, { status: slot.status === "publicado" ? "planejando" : "em-producao" })}
                        className={`w-full min-h-[62px] text-left p-2 border rounded-sm transition-colors ${slot.status === "publicado" ? "border-emerald-600/70 bg-emerald-950/20" : slot.status === "em-producao" ? "border-blue-500/70 bg-[#182234]" : slot.status === "agendado" ? "border-amber-600/70 bg-amber-950/10" : "border-[#475569] bg-[#182234] hover:border-[#64748b]"}`}
                      >
                        <div className="text-[10px] font-mono text-[#b4c5ff]">{slot.optimalTime || "--:--"}</div>
                        <div className="text-xs font-medium text-slate-200 mt-1 leading-4">{slot.plannedAction || slot.focusTheme}</div>
                        <div className="text-[9px] text-slate-500 mt-1 uppercase">{slot.status.replace("-", " ")}</div>
                      </button>
                    )) : <div className="h-[170px] flex items-center justify-center text-[11px] text-slate-700 text-center px-3">Sem ação planejada</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold flex items-center gap-2"><FlaskConical className="w-5 h-5 text-violet-300" /> Aprendizados Validados</h2>
              <span className="text-xs text-slate-500">{learnings.length} registrados</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {validatedLearnings.length ? validatedLearnings.slice(0, 2).map((item) => (
                <div key={item.id} className="min-h-[180px] bg-[#182234] border border-[#334155] rounded-sm p-4 flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-1 bg-violet-950/50 text-violet-300 text-[10px] font-bold uppercase">{item.category}</span>
                    <span className="text-[10px] text-slate-500">{item.verdict.replaceAll("_", " ")}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 mt-4">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-5 mt-2">{item.ruleOfThumb}</p>
                  <p className="text-[10px] text-slate-600 mt-auto pt-4">{item.evidenceData || item.suggestedAction}</p>
                </div>
              )) : (
                <div className="md:col-span-2 min-h-[180px] bg-[#111827] border border-[#263140] flex items-center justify-center text-center p-6 text-sm text-slate-500">
                  Nenhum aprendizado validado ainda. Resultados reais devem ser registrados antes de criar regras de decisão.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-cyan-400" /> Histórico de Performance</h2>
              <span className={`text-[10px] font-mono ${apiConfig.connectionStatus === "connected" ? "text-emerald-400" : "text-slate-600"}`}>● {apiConfig.connectionStatus === "connected" ? "Sync ativo" : "Sem sync"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PerformanceCard label="Alcance Total" value={compactNumber(performance.totalReach)} />
              <PerformanceCard label="CTR Médio" value={`${performance.avgCtr.toFixed(1)}%`} />
              <PerformanceCard label="Salvamentos" value={compactNumber(performance.totalSaves)} />
              <PerformanceCard label="Leads / Cliques" value={compactNumber(performance.totalLeads)} />
            </div>
          </section>
        </div>

        <footer className="border-t border-[#1f2937] pt-3 flex flex-wrap items-center gap-5 text-[10px] font-mono uppercase tracking-[0.1em] text-slate-600">
          <span>Motor: {engineMode === "local" ? "Local" : "Gemini"}</span>
          <span>{weeklyRoutine.length} itens planejados</span>
          <span>{postHistory.length} resultados registrados</span>
          <span>{notes.length} notas no contexto</span>
          <span>{niches.length} nichos • {emotionalDrivers.length} drivers</span>
        </footer>
      </div>
    </div>
  );
};

const PerformanceCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-h-[95px] bg-[#111827] border border-[#334155] rounded-sm p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="text-3xl font-semibold text-slate-100 mt-2">{value}</p>
    <p className="text-[10px] text-slate-600 mt-1">Histórico registrado</p>
  </div>
);
