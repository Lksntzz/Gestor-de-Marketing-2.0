import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Zap,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Check,
  ExternalLink,
  Lightbulb,
  RotateCcw,
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
import { buildObsidianOpenUri } from "../utils/obsidianUri";
import { localDateKey } from "../utils/reliability";
import confetti from "canvas-confetti";

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

const formatChannelLabel = (format?: string) => {
  switch (format) {
    case "carrossel":
      return "LinkedIn / Insta";
    case "newsletter":
      return "Email Newsletter";
    case "reels_video":
      return "Reels / TikTok";
    case "artigo_blog":
      return "Blog SEO / Medium";
    case "thread_post":
      return "Twitter / X";
    default:
      return "LinkedIn";
  }
};

const formatTypeName = (format?: string) => {
  switch (format) {
    case "carrossel":
      return "Carrossel";
    case "newsletter":
      return "Newsletter";
    case "reels_video":
      return "Vídeo Curto / Reels";
    case "artigo_blog":
      return "Artigo";
    case "thread_post":
      return "Thread";
    default:
      return format || "Post";
  }
};

export const RoutineIntelligenceView: React.FC<RoutineIntelligenceViewProps> = ({
  emotionalDrivers = [],
  niches = [],
  postHistory = [],
  learnings = [],
  weeklyRoutine = [],
  apiConfig,
  engineMode,
  notes: _notes,
  onAddPostHistory: _onAddPostHistory,
  onAddLearning: _onAddLearning,
  onUpdateRoutineSlot: _onUpdateRoutineSlot,
  onCreateCampaignFromSuggestion,
  onSyncRoutineToDailyNotes,
  showToast,
}) => {
  const todayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const currentDayIndex = new Date().getDay();
  const currentDayName = todayNames[currentDayIndex] || "Segunda";

  const todayRoutine = useMemo(() => {
    if (!weeklyRoutine || weeklyRoutine.length === 0) return null;
    return (
      weeklyRoutine.find((r) =>
        (r?.dayOfWeek || "").toLowerCase().includes(currentDayName.toLowerCase().slice(0, 3))
      ) || weeklyRoutine[0]
    );
  }, [weeklyRoutine, currentDayName]);

  const [activeSlotStatus, setActiveSlotStatus] = useState<"pending" | "done" | "postponed">("pending");

  const currentRecommendation = useMemo(() => {
    const defaultNiche = niches[0] || { id: "empreendedoras_papelaria", name: "Empreendedoras de Papelaria" };
    const defaultEmotion = emotionalDrivers[0] || { id: "alivio_praticidade", name: "Alívio & Tiragens Acessíveis" };

    const nicheLabel = defaultNiche.name || "Empreendedoras de Papelaria";
    const emotionLabel = defaultEmotion.name || "Alívio & Praticidade";
    const slotDay = todayRoutine?.dayOfWeek || "Hoje";
    const slotTime = todayRoutine?.optimalTime || "11:30";
    const slotFormat = formatTypeName(todayRoutine?.recommendedFormat || "carrossel");
    const slotChannel = formatChannelLabel(todayRoutine?.recommendedFormat);

    return {
      title: "O Fim dos Pedidos Mínimos Abusivos: Planners a partir de 10 unidades",
      hook: "Você já desenhou a coleção de planners mais linda do ano, mas a gráfica tradicional pediu 500 peças para rodar? Na Nisti Print seu projeto ganha vida a partir de 10 unidades com laminação Soft Touch e wire-o bronze.",
      format: `${slotFormat} (${slotChannel})`,
      niche: nicheLabel,
      nicheId: (todayRoutine?.primaryNiche as NicheSegmentKey) || (defaultNiche.id as NicheSegmentKey),
      emotion: emotionLabel,
      emotionId: (todayRoutine?.primaryEmotion as EmotionalDriverKey) || (defaultEmotion.id as EmotionalDriverKey),
      bestSlot: `${slotDay}, ${slotTime}`,
      optimalTime: slotTime,
      channel: slotChannel,
      why: "O Motor Local prioriza o padrão configurado na rotina e os aprendizados registrados no histórico para sugerir o próximo conteúdo.",
    };
  }, [niches, emotionalDrivers, todayRoutine]);

  const handleMarkDone = () => {
    setActiveSlotStatus("done");
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
    showToast("success", "Ação Concluída!", "A publicação de hoje foi marcada como concluída e reconciliada.");
  };

  const handlePostpone = () => {
    setActiveSlotStatus("postponed");
    showToast("info", "Ação Adiada", "Reagendada para o próximo slot de alta conversão.");
  };

  const kpiData = useMemo(() => {
    const totalImpressions = postHistory.reduce((acc, p) => acc + (p?.metrics?.impressions || 0), 0);
    const avgCtr =
      postHistory.length > 0
        ? (postHistory.reduce((acc, p) => acc + (p?.metrics?.ctrPercent || 0), 0) / postHistory.length).toFixed(1)
        : "0.0";
    const totalSaves = postHistory.reduce((acc, p) => acc + (p?.metrics?.saves || 0), 0);
    const totalLeads = postHistory.reduce((acc, p) => acc + (p?.metrics?.clicksOrLeads || 0), 0);

    return [
      { label: "Alcance Acumulado", value: `${(totalImpressions / 1000).toFixed(1)}k`, trend: "histórico", positive: true },
      { label: "CTR Médio", value: `${avgCtr}%`, trend: "histórico", positive: true },
      { label: "Salvamentos", value: totalSaves.toString(), trend: "histórico", positive: true },
      { label: "Conversões / MQLs", value: totalLeads.toString(), trend: "histórico", positive: true },
    ];
  }, [postHistory]);

  const topLearning = useMemo(() => {
    if (!learnings || learnings.length === 0) {
      return {
        title: "Ainda não há aprendizado validado no histórico",
        ruleOfThumb: "Registre resultados reais de publicação antes de transformar padrões em regras de decisão.",
        suggestedAction: "Publicar, medir e salvar o aprendizado observado.",
      };
    }
    const winner = learnings.find((l) => l.verdict === "VENCEDOR") || learnings[0];
    return {
      title: winner.title || "Aprendizado registrado",
      ruleOfThumb: winner.ruleOfThumb || "Use somente evidências registradas na base para orientar a próxima decisão.",
      suggestedAction: winner.suggestedAction || "Revisar os resultados antes de repetir a estratégia.",
    };
  }, [learnings]);

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-8 pb-16 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-150 uppercase tracking-wider">
              {engineMode === "local" ? "⚡ Motor Local Ativo" : "✨ Assistente IA"}
            </span>
            <span className="text-xs text-stone-400 font-medium">
              Hoje é {currentDayName}
            </span>
          </div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight mt-1">
            Assistente Inteligente de Planejamento
          </h1>
          <p className="text-xs text-stone-500">
            Saiba exatamente <strong>o que publicar</strong> e <strong>quando publicar</strong> em menos de 5 segundos.
          </p>
        </div>

        <button
          onClick={onSyncRoutineToDailyNotes}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-stone-300" />
          <span>Sincronizar Daily Note</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              O que fazer agora • Próxima Ação Recomendada
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            ⏰ {todayRoutine?.optimalTime || "08:30"} • {formatChannelLabel(todayRoutine?.recommendedFormat)}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-700">
              {todayRoutine?.focusTheme || "Autoridade Técnica"}
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-700">
              {todayRoutine?.primaryNiche ? todayRoutine.primaryNiche.replace(/_/g, " ") : "Geral"}
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-150">
              {formatTypeName(todayRoutine?.recommendedFormat)}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-stone-900 leading-snug">
            {currentRecommendation.title}
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-sans bg-stone-50/70 p-4 rounded-2xl border border-stone-150/80">
            <strong>Gancho sugerido:</strong> "{currentRecommendation.hook}"
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-150">
          <div className="flex items-center gap-2">
            {activeSlotStatus === "done" ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Publicação de hoje concluída!</span>
              </span>
            ) : (
              <>
                <button
                  onClick={handleMarkDone}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir Publicação</span>
                </button>
                <button
                  onClick={handlePostpone}
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
              onClick={() => {
                onCreateCampaignFromSuggestion({
                  title: currentRecommendation.title,
                  niche: currentRecommendation.nicheId,
                  emotion: currentRecommendation.emotionId,
                  format: todayRoutine?.recommendedFormat || "carrossel",
                  hook: currentRecommendation.hook,
                });
              }}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Gerar Campanha com IA</span>
            </button>
            <a
              href={buildObsidianOpenUri(apiConfig.vaultName, `00_Inbox/Daily-${localDateKey()}.md`)}
              className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
              title="Abrir Daily Note no Obsidian"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Agenda Semanal Simplificada
          </span>
          <span className="text-xs text-stone-400">{weeklyRoutine.length} slots programados</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {weeklyRoutine.map((slot) => {
            const isToday = (slot?.dayOfWeek || "").toLowerCase().includes(currentDayName.toLowerCase().slice(0, 3));
            return (
              <div
                key={slot.id}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isToday
                    ? "bg-purple-50/70 border-purple-300 shadow-3xs ring-1 ring-purple-300/50"
                    : "bg-white border-stone-200/80 hover:border-stone-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isToday ? "text-purple-900" : "text-stone-700"}`}>
                      {(slot?.dayOfWeek || "Slot").slice(0, 3)}
                    </span>
                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-stone-400 mt-0.5">{slot?.optimalTime || "08:30"}</p>
                </div>

                <div className="mt-4 pt-2 border-t border-stone-100">
                  <span className="text-[10px] font-bold text-stone-900 block truncate">
                    {formatChannelLabel(slot?.recommendedFormat)}
                  </span>
                  <span className="text-[9px] text-stone-500 block truncate">
                    {formatTypeName(slot?.recommendedFormat)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-stone-200/80 space-y-1 shadow-3xs">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
              {kpi.label}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-black text-stone-900">{kpi.value}</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <ArrowUpRight className="w-2.5 h-2.5" />
                {kpi.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-3xs space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
              O que aprendemos com o histórico
            </span>
          </div>
          <h3 className="text-xs font-bold text-stone-900">
            {topLearning.title}
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            {topLearning.ruleOfThumb}
          </p>
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px]">
            <span className="text-stone-400">Regra de ouro:</span>
            <span className="font-bold text-purple-700 truncate ml-2">{topLearning.suggestedAction}</span>
          </div>
        </div>

        <div className="bg-stone-900 text-stone-200 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Explicação do Motor Local</span>
            </span>
            <span className="text-[9px] font-mono text-stone-400">0 Tokens • Heurística</span>
          </div>
          <h3 className="text-xs font-bold text-white">
            Por que publicar {currentRecommendation.format} hoje?
          </h3>
          <p className="text-xs text-stone-300 leading-relaxed font-sans">
            {currentRecommendation.why}
          </p>
          <div className="pt-2 border-t border-stone-800 text-[10px] text-stone-400 flex items-center justify-between">
            <span>Canal ideal: {currentRecommendation.channel}</span>
            <span className="text-purple-300 font-bold">Horário de pico: {currentRecommendation.optimalTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
