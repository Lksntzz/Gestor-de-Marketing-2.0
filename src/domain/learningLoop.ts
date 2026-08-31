import type { LearningInsight, PostHistoryItem } from "../types";

export interface ChannelPerformanceSummary {
  channel: string;
  totalPosts: number;
  totalReach: number | null;
  totalClicksOrLeads: number | null;
  averageCtr: number | null;
  averageConversionRate: number | null;
  formatsUsed: string[];
}

export interface FormatPerformanceSummary {
  format: string;
  totalPosts: number;
  totalReach: number | null;
  totalClicksOrLeads: number | null;
  averageCtr: number | null;
  averageConversionRate: number | null;
  channelsUsed: string[];
}

export interface EpistemicHypothesis {
  id: string;
  statement: string;
  category: "formato" | "canal" | "copy" | "oferta" | "audiência";
  status: "HIPÓTESE" | "CONFIRMADO" | "REFUTADO";
  evidenceNotes: string[];
  supportingMetricsCount: number;
  ruleOfThumb?: string;
  actionableRecommendation?: string;
  evaluatedAt: string;
}

function finiteMetric(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateSum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0);
}

export function computeChannelAnalytics(postHistory: PostHistoryItem[]): ChannelPerformanceSummary[] {
  const channelGroups = new Map<string, PostHistoryItem[]>();

  for (const item of postHistory) {
    const ch = (item.channel || "Não especificado").trim();
    if (!channelGroups.has(ch)) {
      channelGroups.set(ch, []);
    }
    channelGroups.get(ch)!.push(item);
  }

  const summaries: ChannelPerformanceSummary[] = [];

  for (const [channel, items] of channelGroups.entries()) {
    const reachList: number[] = [];
    const leadsList: number[] = [];
    const ctrList: number[] = [];
    const convList: number[] = [];
    const formats = new Set<string>();

    for (const item of items) {
      if (item.format) formats.add(item.format);
      const r = finiteMetric(item.metrics?.reach);
      const l = finiteMetric(item.metrics?.clicksOrLeads);
      const ctr = finiteMetric(item.metrics?.ctrPercent);
      const conv = finiteMetric(item.metrics?.conversionRatePercent);

      if (r !== null) reachList.push(r);
      if (l !== null) leadsList.push(l);
      if (ctr !== null) ctrList.push(ctr);
      if (conv !== null) convList.push(conv);
    }

    summaries.push({
      channel,
      totalPosts: items.length,
      totalReach: calculateSum(reachList),
      totalClicksOrLeads: calculateSum(leadsList),
      averageCtr: calculateAverage(ctrList),
      averageConversionRate: calculateAverage(convList),
      formatsUsed: Array.from(formats),
    });
  }

  return summaries.sort((a, b) => b.totalPosts - a.totalPosts);
}

export function computeFormatAnalytics(postHistory: PostHistoryItem[]): FormatPerformanceSummary[] {
  const formatGroups = new Map<string, PostHistoryItem[]>();

  for (const item of postHistory) {
    const fmt = (item.format || "Padrão").trim();
    if (!formatGroups.has(fmt)) {
      formatGroups.set(fmt, []);
    }
    formatGroups.get(fmt)!.push(item);
  }

  const summaries: FormatPerformanceSummary[] = [];

  for (const [format, items] of formatGroups.entries()) {
    const reachList: number[] = [];
    const leadsList: number[] = [];
    const ctrList: number[] = [];
    const convList: number[] = [];
    const channels = new Set<string>();

    for (const item of items) {
      if (item.channel) channels.add(item.channel);
      const r = finiteMetric(item.metrics?.reach);
      const l = finiteMetric(item.metrics?.clicksOrLeads);
      const ctr = finiteMetric(item.metrics?.ctrPercent);
      const conv = finiteMetric(item.metrics?.conversionRatePercent);

      if (r !== null) reachList.push(r);
      if (l !== null) leadsList.push(l);
      if (ctr !== null) ctrList.push(ctr);
      if (conv !== null) convList.push(conv);
    }

    summaries.push({
      format,
      totalPosts: items.length,
      totalReach: calculateSum(reachList),
      totalClicksOrLeads: calculateSum(leadsList),
      averageCtr: calculateAverage(ctrList),
      averageConversionRate: calculateAverage(convList),
      channelsUsed: Array.from(channels),
    });
  }

  return summaries.sort((a, b) => b.totalPosts - a.totalPosts);
}

export function exportLearningsToMarkdown(
  learnings: LearningInsight[],
  postHistory: PostHistoryItem[]
): string {
  const channelData = computeChannelAnalytics(postHistory);
  const formatData = computeFormatAnalytics(postHistory);

  let md = `---
tipo: "Relatório de Inteligência & Aprendizado"
data: "${new Date().toISOString().split("T")[0]}"
total_publicacoes_medidas: ${postHistory.length}
total_regras_aprendidas: ${learnings.length}
tags:
  - "metricas"
  - "aprendizado"
  - "inteligencia"
  - "marketing"
---

# 📈 Relatório de Desempenho & Aprendizados Epistêmicos

**Data de Consolidação:** ${new Date().toLocaleDateString("pt-BR")}  
**Total de Resultados Analisados:** ${postHistory.length} publicações  
**Regras Canônicas Validadas:** ${learnings.filter((l) => l.verdict === "CONFIRMADO").length}  

---

## 📊 Desempenho por Canal

| Canal | Publicações | Alcance Total | Leads/Cliques | CTR Médio | Conv. Média |
| :--- | :---: | :---: | :---: | :---: | :---: |
`;

  channelData.forEach((ch) => {
    const reach = ch.totalReach !== null ? ch.totalReach.toLocaleString("pt-BR") : "—";
    const leads = ch.totalClicksOrLeads !== null ? ch.totalClicksOrLeads.toLocaleString("pt-BR") : "—";
    const ctr = ch.averageCtr !== null ? `${ch.averageCtr.toFixed(1)}%` : "—";
    const conv = ch.averageConversionRate !== null ? `${ch.averageConversionRate.toFixed(1)}%` : "—";
    md += `| **${ch.channel}** | ${ch.totalPosts} | ${reach} | ${leads} | ${ctr} | ${conv} |\n`;
  });

  md += `\n---

## 🎭 Desempenho por Formato de Conteúdo

| Formato | Publicações | Alcance Total | Leads/Cliques | CTR Médio | Conv. Média |
| :--- | :---: | :---: | :---: | :---: | :---: |
`;

  formatData.forEach((fmt) => {
    const reach = fmt.totalReach !== null ? fmt.totalReach.toLocaleString("pt-BR") : "—";
    const leads = fmt.totalClicksOrLeads !== null ? fmt.totalClicksOrLeads.toLocaleString("pt-BR") : "—";
    const ctr = fmt.averageCtr !== null ? `${fmt.averageCtr.toFixed(1)}%` : "—";
    const conv = fmt.averageConversionRate !== null ? `${fmt.averageConversionRate.toFixed(1)}%` : "—";
    md += `| **${fmt.format}** | ${fmt.totalPosts} | ${reach} | ${leads} | ${ctr} | ${conv} |\n`;
  });

  md += `\n---

## 🧠 Base de Aprendizados Epistêmicos (Regras Validadas)

`;

  if (learnings.length === 0) {
    md += `*Nenhuma regra consolidada ainda. Registre aprendizados baseados em evidências no painel de Inteligência.*\n`;
  } else {
    learnings.forEach((learning, idx) => {
      md += `### ${idx + 1}. [${learning.verdict}] ${learning.title}\n`;
      md += `- **Categoria:** ${learning.category.toUpperCase()}\n`;
      md += `- **Regra Prática:** ${learning.ruleOfThumb}\n`;
      md += `- **Evidência Medida:** ${learning.evidenceData}\n`;
      md += `- **Próxima Ação:** ${learning.suggestedAction}\n`;
      if (learning.dateCreated) md += `- **Data de Registro:** ${learning.dateCreated}\n`;
      md += `\n`;
    });
  }

  md += `\n---\n*Gerado automaticamente pelo Nisti Marketing Hub — Gestor de Marketing 2.0*`;

  return md;
}

export function formatCanonicalLearningNote(learning: LearningInsight): {
  title: string;
  folder: string;
  content: string;
} {
  const safeTitle = learning.title.replace(/[/\\?%*:|"<>]/g, "-").trim();
  const folder = "00_Base_Conhecimento/Aprendizados";
  const dateStr = learning.dateCreated || new Date().toISOString().split("T")[0];

  const content = `---
tipo: "Aprendizado Canônico"
status: "${learning.verdict === "CONFIRMADO" ? "OFICIAL" : "EM_VALIDACAO"}"
epistemic_status: "${learning.verdict}"
categoria: "${learning.category}"
veredicto: "${learning.verdict}"
data_validacao: "${dateStr}"
tags:
  - "base-conhecimento"
  - "aprendizado"
  - "regra-canonica"
---

# 💡 Regra Canônica: ${learning.title}

> **Veredicto Epistêmico:** \`${learning.verdict}\`  
> **Categoria:** \`${learning.category.toUpperCase()}\`  
> **Data:** ${dateStr}

---

## 📌 Regra Prática (Diretriz de Execução)
${learning.ruleOfThumb}

---

## 🔍 Evidência Factual Observada
${learning.evidenceData}

---

## 🚀 Próxima Ação Recomendada
${learning.suggestedAction}

---
*Esta nota alimenta diretamente o RAG do Nisti Marketing Hub para que futuras gerações criativas apliquem este conhecimento comprovado.*
`;

  return {
    title: safeTitle,
    folder,
    content,
  };
}
