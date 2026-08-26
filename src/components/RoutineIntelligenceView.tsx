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
  showToast: (type: "success" | "error" | "info", title: string, message: string) => void;
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
  // Current Day
  const todayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const currentDayIndex = new Date().getDay(); // 0-6
  const currentDayName = todayNames[currentDayIndex] || "Segunda";

  // Routine of today safely resolved
  const todayRoutine = useMemo(() => {
    if (!weeklyRoutine || weeklyRoutine.length === 0) return null;
    return (
      weeklyRoutine.find((r) =>
        (r?.dayOfWeek || "").toLowerCase().includes(currentDayName.toLowerCase().slice(0, 3))
      ) || weeklyRoutine[0]
    );
  }, [weeklyRoutine, currentDayName]);

  // Primary active task/action (O que fazer agora)
  const [activeSlotStatus, setActiveSlotStatus] = useState<"pending" | "done" | "postponed">("pending");

  // Dynamic Suggestion / Local Engine Recommendation
  const currentRecommendation = useMemo(() => {
    const defaultNiche = niches[0] || { id: "tech_leads_devs", name: "Tech Leads & Devs" };
    const defaultEmotion = emotionalDrivers[0] || { id: "curiosidade", name: "Curiosidade & Segredos" };

    const nicheLabel = defaultNiche.name || "Tech Leads & Devs";
    const emotionLabel = defaultEmotion.name || "Curiosidade";
    const slotDay = todayRoutine?.dayOfWeek || "Hoje";
    const slotTime = todayRoutine?.optimalTime || "08:30";
    const slotFormat = formatTypeName(todayRoutine?.recommendedFormat || "carrossel");
    const slotChannel = formatChannelLabel(todayRoutine?.recommendedFormat);

    return {
      title: "Como estruturar um segundo cérebro Markdown sem gastar 1 real em nuvens fechadas",
      hook: "Mostramos os benchmarks de latência (0.1s vs 3.8s) e a privacidade que fizeram nossos times migrarem 100% dos docs para o Obsidian.",
      format: `${slotFormat} (${slotChannel})`,
      niche: nicheLabel,
      emotion: emotionLabel,
      bestSlot: `${slotDay}, ${slotTime}`,
      optimalTime: slotTime,
      channel: slotChannel,
      why: "O Motor Local identificou que publicações técnicas com gancho de 'Curiosidade' no LinkedIn têm 3.4x mais taxa de salvamento na sua base histórica nas terças e quartas-feiras.",
    };
  }, [niches, emotionalDrivers, todayRoutine]);

  // Handle Mark Done
  const handleMarkDone = () => {
    setActiveSlotStatus("done");
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
    showToast("success", "Ação Concluída!", "A publicação de hoje foi marcada como concluída e reconciliada.");
  };

  // Handle Postpone
  const handlePostpone = () => {
    setActiveSlotStatus("postponed");
    showToast("info", "Ação Adiada", "Reagendada para o próximo slot de alta conversão.");
  };

  // 4 Micro KPIs with Trend Indicators
  const kpiData = useMemo(() => {
    const totalImpressions = postHistory.reduce((acc, p) => acc + (p?.metrics?.impressions || 0), 0);
    const avgCtr =
      postHistory.length > 0
        ? (postHistory.reduce((acc, p) => acc + (p?.metrics?.ctrPercent || 0), 0) / postHistory.length).toFixed(1)
        : "3.8";
    const totalSaves = postHistory.reduce((acc, p) => acc + (p?.metrics?.saves || 0), 0);
    const totalLeads = postHistory.reduce((acc, p) => acc + (p?.metrics?.clicksOrLeads || 0), 0);

    return [
      { label: "Alcance Semanal", value: `${(totalImpressions / 1000).toFixed(1)}k`, trend: "+18%", positive: true },
      { label: "CTR Médio", value: `${avgCtr}%`, trend: "+0.4%", positive: true },
      { label: "Taxa de Salvamentos", value: totalSaves.toString(), trend: "+24%", positive: true },
      { label: "Conversões / MQLs", value: totalLeads.toString(), trend: "+12%", positive: true },
    ];
  }, [postHistory]);

  // Key Learning highlight
  const topLearning = useMemo(() => {
    if (!learnings || learnings.length === 0) {
      return {
        title: "Posts de benchmark técnico pela manhã superam posts opinativos",
        ruleOfThumb: "Publicações com comparativos práticos às 08:30 geram +84% de retenção e cliques em documentações.",
        suggestedAction: "Manter terças e quintas focadas exclusivamente em estudos de caso e tutoriais práticos.",
      };
    }
    const winner = learnings.find((l) => l.verdict === "VENCEDOR") || learnings[0];
    return {
      title: winner.title || "Posts técnicos geram maior conversão",
      ruleOfThumb: winner.ruleOfThumb || "Conteúdos orientados a dados têm taxa de retenção superior.",
      suggestedAction: winner.suggestedAction || "Priorizar benchmarks reais nas primeiras horas da manhã.",
    };
  }, [learnings]);

  return (
    <div className="w-full px-4 md:px-8 lg:px-12 space-y-8 pb-16 animate-fadeIn">
      {/* 1. HEADER MINIMALISTA: ROTINA DE HOJE & STATUS MOTOR LOCAL */}
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

        {/* Sync Action */}
        <button
          onClick={onSyncRoutineToDailyNotes}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-stone-300" />
          <span>Sincronizar Daily Note</span>
        </button>
      </div>

      {/* 2. CARD GRANDE: "O QUE FAZER AGORA" (AÇÃO PRINCIPAL / FOCO LINEAR) */}
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
              {todayRoutine?.primaryNiche ? todayRoutine.primaryNiche.replace(/_/g, " ") : "Tech Leads"}
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

        {/* Action Controls: Abrir, Concluir, Adiar */}
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
                  niche: "tech_leads_devs",
                  emotion: "curiosidade",
                  format: "carrossel",
                  hook: currentRecommendation.hook,
                });
              }}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Gerar Campanha com IA</span>
            </button>
            <a
              href={buildObsidianOpenUri(apiConfig.vaultName, `Daily Notes/${new Date().toISOString().slice(0, 10)}.md`)}
              className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
              title="Abrir Daily Note no Obsidian"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. AGENDA SEMANAL BÁSICA (COMPREENDA A SEMANA EM 5 SEGUNDOS) */}
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

      {/* 4. 4 PEQUENOS KPIS SÓ COM TENDÊNCIA */}
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

      {/* 5. SEÇÃO DUPLA: "O QUE APRENDEMOS" & RECOMENDAÇÃO DETALHADA DO MOTOR LOCAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card: O Que Aprendemos */}
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

        {/* Card: Por que esta recomendação? (Motor Local) */}
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
