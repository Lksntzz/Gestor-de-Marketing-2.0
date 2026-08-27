import React, { useMemo } from "react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";
import {
  EmotionalDriver,
  EmotionalDriverKey,
  NicheSegment,
  NicheSegmentKey,
  PostHistoryItem,
  LearningInsight,
  DailyRoutineSlot,
  ObsidianApiConfig,
  EngineMode,
  ObsidianNote,
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

function channelLabel(format?: string): string {
  if (format === "newsletter") return "Email";
  if (format === "reels_video") return "Reels / TikTok";
  if (format === "artigo_blog") return "Blog";
  if (format === "thread_post") return "Social / Thread";
  if (format === "carrossel") return "Instagram / LinkedIn";
  return "Canal a definir";
}

function formatLabel(format?: string): string {
  if (format === "reels_video") return "Vídeo curto";
  if (format === "artigo_blog") return "Artigo";
  if (format === "thread_post") return "Thread";
  if (format === "newsletter") return "Newsletter";
  if (format === "carrossel") return "Carrossel";
  return format || "Formato pendente";
}

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  emotionalDrivers = [],
  niches = [],
  postHistory = [],
  learnings = [],
  weeklyRoutine = [],
  engineMode,
  onCreateCampaignFromSuggestion,
  onSyncRoutineToDailyNotes,
  showToast,
}) => {
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const currentDayName = dayNames[new Date().getDay()] || "Hoje";

  const todayRoutine = useMemo(
    () => weeklyRoutine.find((slot) => (slot.dayOfWeek || "").toLowerCase().startsWith(currentDayName.toLowerCase().slice(0, 3))) || null,
    [weeklyRoutine, currentDayName]
  );

  const topLearning = useMemo(() => {
    if (!learnings.length) return null;
    return learnings.find((item) => item.verdict === "VENCEDOR") || learnings[0];
  }, [learnings]);

  const metrics = useMemo(() => {
    const impressions = postHistory.reduce((sum, item) => sum + (item.metrics?.impressions || 0), 0);
    const saves = postHistory.reduce((sum, item) => sum + (item.metrics?.saves || 0), 0);
    const leads = postHistory.reduce((sum, item) => sum + (item.metrics?.clicksOrLeads || 0), 0);
    const avgCtr = postHistory.length
      ? postHistory.reduce((sum, item) => sum + (item.metrics?.ctrPercent || 0), 0) / postHistory.length
      : 0;
    return { impressions, saves, leads, avgCtr };
  }, [postHistory]);

  const nicheId = (todayRoutine?.primaryNiche || niches[0]?.id) as NicheSegmentKey | undefined;
  const emotionId = (todayRoutine?.primaryEmotion || emotionalDrivers[0]?.id) as EmotionalDriverKey | undefined;
  const canGenerate = Boolean(todayRoutine && nicheId && emotionId);

  const handleGenerate = () => {
    if (!todayRoutine || !nicheId || !emotionId) {
      showToast("info", "Planejamento pendente", "Cadastre uma rotina, nicho e gatilho antes de gerar campanha.");
      return;
    }
    onCreateCampaignFromSuggestion({
      title: todayRoutine.focusTheme || `Conteúdo de ${todayRoutine.dayOfWeek}`,
      niche: nicheId,
      emotion: emotionId,
      format: todayRoutine.recommendedFormat || "carrossel",
      hook: todayRoutine.suggestedHookPattern || "",
    });
  };

  return (
    <div className="h-[calc(100vh-7.5rem)] md:h-[calc(100vh-5rem)] overflow-y-auto pr-1 pb-6">
      <div className="max-w-[1440px] mx-auto space-y-5">
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-purple-700">Planejamento semanal</div>
            <h1 className="text-2xl font-black text-stone-950 mt-1">Marketing com agenda clara</h1>
            <p className="text-xs text-stone-500 mt-1">A rotina mostra somente o que está configurado ou aprendido com dados reais.</p>
          </div>
          <button onClick={onSyncRoutineToDailyNotes} className="h-9 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 inline mr-1.5" />Sincronizar semana no Obsidian
          </button>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-7 rounded-2xl bg-white border border-stone-200 p-5 min-h-[230px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">Hoje • {currentDayName}</div>
                <h2 className="text-sm font-black text-stone-950 mt-0.5">Próximo conteúdo planejado</h2>
              </div>
              <Clock3 className="w-4 h-4 text-stone-400" />
            </div>

            {todayRoutine ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-800 text-[10px] font-bold">{todayRoutine.optimalTime || "Horário pendente"}</span>
                  <span className="px-2 py-1 rounded-lg bg-stone-100 text-stone-700 text-[10px] font-bold">{formatLabel(todayRoutine.recommendedFormat)}</span>
                  <span className="px-2 py-1 rounded-lg bg-stone-100 text-stone-700 text-[10px] font-bold">{channelLabel(todayRoutine.recommendedFormat)}</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-950">{todayRoutine.focusTheme || "Tema ainda não definido"}</h3>
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">{todayRoutine.suggestedHookPattern || "Nenhum gancho validado foi configurado para este slot."}</p>
                </div>
                <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2">
                  <button onClick={handleGenerate} disabled={!canGenerate} className="h-9 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold disabled:opacity-40"><Sparkles className="w-3.5 h-3.5 inline mr-1.5" />Gerar campanha</button>
                  <span className="h-9 px-3 rounded-xl border border-stone-200 text-[10px] font-semibold text-stone-500 flex items-center">{engineMode === "local" ? "Motor Local" : "Gemini IA"}</span>
                </div>
              </div>
            ) : (
              <div className="h-36 rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-center p-5">
                <div>
                  <Calendar className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-800">Nenhum slot configurado para hoje.</p>
                  <p className="text-xs text-stone-500 mt-1">O sistema não cria recomendações fictícias.</p>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-5 rounded-2xl bg-white border border-stone-200 p-5 min-h-[230px]">
            <div className="flex items-center gap-2 mb-4"><Lightbulb className="w-4 h-4 text-amber-500" /><h2 className="text-sm font-black text-stone-950">Aprendizado aplicado</h2></div>
            {topLearning ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-stone-900">{topLearning.title}</h3>
                <p className="text-xs leading-relaxed text-stone-600">{topLearning.ruleOfThumb || "Aprendizado registrado sem regra resumida."}</p>
                <div className="rounded-xl bg-stone-50 border border-stone-100 p-3">
                  <div className="text-[9px] uppercase font-bold text-stone-400">Próxima ação sugerida pelo histórico</div>
                  <div className="text-[11px] font-semibold text-stone-700 mt-1">{topLearning.suggestedAction || "Revisar os resultados antes de repetir a estratégia."}</div>
                </div>
              </div>
            ) : (
              <div className="h-36 flex items-center justify-center text-center text-xs text-stone-500">Ainda não há aprendizado validado. Publique, meça e registre resultados antes de transformar padrões em regra.</div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div><div className="text-[10px] uppercase tracking-wider font-bold text-stone-500">Agenda</div><h2 className="text-sm font-black text-stone-950 mt-0.5">Semana</h2></div>
            <span className="text-[10px] font-semibold text-stone-500">{weeklyRoutine.length} slots configurados</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {weeklyRoutine.map((slot) => {
              const isToday = (slot.dayOfWeek || "").toLowerCase().startsWith(currentDayName.toLowerCase().slice(0, 3));
              return (
                <div key={slot.id} className={`min-h-28 rounded-xl border p-3 flex flex-col justify-between ${isToday ? "border-purple-300 bg-purple-50" : "border-stone-200 bg-white"}`}>
                  <div>
                    <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-stone-800">{slot.dayOfWeek}</span>{isToday && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}</div>
                    <div className="text-[10px] text-stone-400 mt-1">{slot.optimalTime || "--:--"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-stone-800 line-clamp-2">{slot.focusTheme || "Tema pendente"}</div>
                    <div className="text-[9px] text-stone-500 mt-1">{formatLabel(slot.recommendedFormat)}</div>
                  </div>
                </div>
              );
            })}
            {!weeklyRoutine.length && <div className="lg:col-span-7 h-24 rounded-xl border border-dashed border-stone-200 flex items-center justify-center text-xs text-stone-500">A agenda semanal ainda está vazia.</div>}
          </div>
        </section>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            { label: "Alcance registrado", value: metrics.impressions.toLocaleString("pt-BR"), icon: Target },
            { label: "CTR médio", value: `${metrics.avgCtr.toFixed(1)}%`, icon: ArrowRight },
            { label: "Salvamentos", value: metrics.saves.toLocaleString("pt-BR"), icon: CheckCircle2 },
            { label: "Leads / cliques", value: metrics.leads.toLocaleString("pt-BR"), icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="h-24 rounded-2xl bg-white border border-stone-200 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-wider font-bold text-stone-500">{item.label}</span><Icon className="w-3.5 h-3.5 text-purple-600" /></div>
                <div className="text-xl font-black text-stone-950">{item.value}</div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};
