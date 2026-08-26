import {
  EmotionalDriver,
  NicheSegment,
  PostHistoryItem,
  LearningInsight,
  DailyRoutineSlot,
} from "../types";

export const DEFAULT_EMOTIONAL_DRIVERS: EmotionalDriver[] = [
  {
    id: "alivio_praticidade",
    name: "Alívio, Ordem & Tiragens Acessíveis",
    emoji: "✨",
    tagline: "A paz de poder imprimir produtos com alta qualidade a partir de pequenas tiragens.",
    colorClass: "from-emerald-500/10 to-teal-500/10 border-emerald-200 text-emerald-950",
    psychologicalTrigger: "Alívio de risco: Redução de barreiras de entrada e facilidade operacional.",
    sampleHooks: [
      "Como lançar seu produto sem capital travado em estoque.",
    ],
    bestFormats: ["Carrossel", "Vídeo de produto", "Reels"],
    historicalAvgCtr: "Alto engajamento",
  },
  {
    id: "curiosidade",
    name: "Curiosidade & Bastidores",
    emoji: "🔍",
    tagline: "Revelação de processos, acabamentos e testes práticos.",
    colorClass: "from-amber-500/10 to-orange-500/10 border-amber-200 text-amber-950",
    psychologicalTrigger: "Curiosidade: Demonstrar o processo gera alto encantamento.",
    sampleHooks: [
      "O segredo por trás do acabamento de alta durabilidade.",
    ],
    bestFormats: ["Vídeo curto", "Carrossel de processo", "Stories"],
    historicalAvgCtr: "Alta retenção",
  },
  {
    id: "ambicao_crescimento",
    name: "Ambição, Lucro & Resultados",
    emoji: "📈",
    tagline: "Estratégias de alto retorno e valor percebido.",
    colorClass: "from-purple-500/10 to-indigo-500/10 border-purple-200 text-purple-950",
    psychologicalTrigger: "Visão de retorno comercial e posicionamento premium.",
    sampleHooks: [
      "Como estruturar seu catálogo para maximizar margens.",
    ],
    bestFormats: ["Carrossel analítico", "Estudo de caso"],
    historicalAvgCtr: "Alta conversão",
  },
  {
    id: "confianca_autoridade",
    name: "Confiança, Prova & Qualidade",
    emoji: "🛡️",
    tagline: "Garantia de fidelidade, pontualidade e prova social.",
    colorClass: "from-blue-500/10 to-cyan-500/10 border-blue-200 text-blue-950",
    psychologicalTrigger: "Mitigação de risco e garantia de prazo e entrega.",
    sampleHooks: [
      "Por que a qualidade de acabamento impacta a retenção de clientes.",
    ],
    bestFormats: ["Guia prático", "Depoimentos", "Comparativos"],
    historicalAvgCtr: "Leads qualificados",
  },
  {
    id: "urgencia_acao",
    name: "Urgência & Oportunidade",
    emoji: "⏳",
    tagline: "Prazos, sazonalidade e chamadas para ação direta.",
    colorClass: "from-orange-500/10 to-red-500/10 border-orange-200 text-orange-950",
    psychologicalTrigger: "Escassez de tempo ou janela de oportunidade sazonal.",
    sampleHooks: [
      "Últimos dias para garantir sua janela de planejamento.",
    ],
    bestFormats: ["Email Marketing", "Stories diretos", "Mensagem de fechamento"],
    historicalAvgCtr: "Ação imediata",
  },
];

export const DEFAULT_NICHES: NicheSegment[] = [];

export const DEFAULT_POST_HISTORY: PostHistoryItem[] = [];

export const DEFAULT_LEARNING_INSIGHTS: LearningInsight[] = [];

export const DEFAULT_WEEKLY_ROUTINE: DailyRoutineSlot[] = [];
