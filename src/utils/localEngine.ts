import type {
  MarketingChannelContent,
  ObsidianNote,
  VaultAuditInsight,
} from "../types";
import { normalizeTaxonomyFolder } from "../domain/taxonomy";
import { localDateKey } from "./reliability";

export interface LocalCampaignInput {
  campaignName: string;
  objective: string;
  channels: string[];
  audience: string;
  tone: string;
  contextNotesList: ObsidianNote[];
  customInstructions?: string;
}

export interface LocalExtractionInput {
  noteTitle: string;
  noteContent: string;
}

function normalizeTag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * Grounded local campaign generator.
 * It may structure a plan, but it never invents commercial facts or scheduling.
 * Every generated campaign remains EM REVISÃO until a human explicitly approves it.
 *
 * Structured MarketingTask objects are deliberately NOT returned here. The legacy
 * App handler used to fill missing dates, hours, priorities and reminders with
 * defaults. Suggestions remain Markdown-only until a human registers them.
 */
export function generateLocalCampaign(input: LocalCampaignInput) {
  const {
    campaignName,
    objective,
    channels,
    audience,
    tone,
    contextNotesList,
    customInstructions,
  } = input;

  const today = localDateKey();
  const selectedChannels = channels.filter(Boolean);
  const officialNotes = contextNotesList.filter((note) => note.frontmatter?.status === "OFICIAL");
  const hasConfirmedBase = officialNotes.length > 0;
  const knowledgeRefs = officialNotes.slice(0, 5).map((note) => `[[${note.title}]]`);
  const evidenceLabel = hasConfirmedBase
    ? knowledgeRefs.join(", ")
    : "PENDENTE: nenhuma nota OFICIAL foi selecionada como base";
  const targetAudience = audience.trim() || "PENDENTE: público-alvo não informado";
  const targetTone = tone.trim() || "PENDENTE: tom de voz não informado";
  const objectiveText = objective.trim() || "PENDENTE: objetivo não informado";

  const channelsContent: MarketingChannelContent[] = selectedChannels.map((channel) => ({
    channel,
    title: `${campaignName} — ${channel}`,
    copy: hasConfirmedBase
      ? [
          `Campanha: ${campaignName}.`,
          `Objetivo informado: ${objectiveText}.`,
          `Público informado: ${targetAudience}.`,
          `Base OFICIAL disponível para consulta: ${evidenceLabel}.`,
          "Rascunho: usar no texto final somente promessas, números, prazos, preços, diferenciais e características explicitamente confirmados nessas notas.",
        ].join("\n\n")
      : [
          `Campanha: ${campaignName}.`,
          `Objetivo informado: ${objectiveText}.`,
          `Público informado: ${targetAudience}.`,
          "PENDENTE: a base selecionada não contém notas OFICIAL.",
          "Não publicar alegações comerciais, números, preços, prazos ou características de produto até validar a informação no Vault.",
        ].join("\n\n"),
    callToAction: "PENDENTE: definir CTA depois de validar oferta e objetivo.",
    hashtagsOrKeywords: [
      normalizeTag(campaignName) || "campanha",
      normalizeTag(channel) || "canal",
      hasConfirmedBase ? "base-confirmada" : "pendente-validacao",
    ],
  }));

  const campaignSlug = normalizeTag(campaignName) || "campanha";
  const taskSuggestions = [
    `- [ ] Validar fatos e oferta da campanha ${campaignName} #revisao #pendente`,
    `- [ ] Produzir conteúdo da campanha ${campaignName} #conteudo #pendente-agendamento`,
  ];

  const customBlock = customInstructions?.trim()
    ? `\n## Instruções adicionais informadas\n${customInstructions.trim()}\n`
    : "";

  const obsidianMarkdownNote = `---
id: "camp_${campaignSlug}_${today}"
tipo: "Plano de Campanha"
status: "EM REVISÃO"
epistemic_status: "${hasConfirmedBase ? "HIPÓTESE" : "PENDENTE"}"
owner: "Nisti Marketing"
created_at: "${today}"
updated_at: "${today}"
confidencialidade: "Interno"
nicho: "${targetAudience.replace(/"/g, "'")}"
canal: "${selectedChannels.join(", ").replace(/"/g, "'")}"
projeto: "${campaignName.replace(/"/g, "'")}"
tags:
  - campanha
  - revisao
  - ${hasConfirmedBase ? "base-confirmada" : "pendente-validacao"}
origem: "Motor Local Grounded"
approved_by: ""
---

# ${campaignName}

> [!summary] Estado epistemológico
> - **Status editorial**: EM REVISÃO
> - **Status epistemológico**: ${hasConfirmedBase ? "HIPÓTESE" : "PENDENTE"}
> - **Objetivo informado**: ${objectiveText}
> - **Público informado**: ${targetAudience}
> - **Tom informado**: ${targetTone}
> - **Base OFICIAL consultável**: ${evidenceLabel}

> [!warning] Regra de segurança de conteúdo
> O Motor Local não inventa preços, prazos, datas de publicação, métricas, características, diferenciais ou promessas. A existência de notas OFICIAL como fonte não torna o plano gerado automaticamente OFICIAL.
${customBlock}
## Conteúdos por canal

${channelsContent.length
  ? channelsContent.map((content) => `### ${content.channel}\n${content.copy}\n\n**CTA:** ${content.callToAction}`).join("\n\n---\n\n")
  : "PENDENTE: nenhum canal definido."}

## Checklist sugerido — requer registro humano antes de virar tarefa
${taskSuggestions.join("\n")}
`;

  return {
    summary: hasConfirmedBase
      ? `Campanha '${campaignName}' estruturada como HIPÓTESE com rastreabilidade para notas OFICIAL.`
      : `Campanha '${campaignName}' mantida como PENDENTE porque não há base OFICIAL selecionada.`,
    strategy: `Objetivo informado: ${objectiveText}. Público informado: ${targetAudience}. Base: ${evidenceLabel}.`,
    channelsContent,
    tasks: [],
    taskSuggestions,
    reminders: [],
    obsidianMarkdownNote,
    usedEngine: "Motor Local Grounded (0 tokens)",
    epistemicStatus: hasConfirmedBase ? "HIPÓTESE" : "PENDENTE",
  };
}

/**
 * Reads explicit Markdown task lines, but does not promote them to MarketingTask.
 * The former App import path completed missing operational fields with defaults.
 * Candidates are now returned for a future review UI; nothing is auto-created.
 */
export function extractLocalTasksFromNote(input: LocalExtractionInput) {
  const { noteTitle, noteContent } = input;
  const lines = noteContent.split("\n");
  const reviewCandidates: Array<{
    title: string;
    priority?: "low" | "medium" | "high" | "urgent";
    dueDate?: string;
    dueTime?: string;
    reminderDate?: string;
    reminderTime?: string;
    obsidianTaskString: string;
  }> = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- [ ]") && !trimmed.startsWith("- [x]") && !trimmed.startsWith("- [X]")) return;

    const rest = trimmed.slice(5).trim();
    const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    const timeMatch = rest.match(/⏰\s*(\d{1,2}:\d{2})/);
    const reminderMatch = rest.match(/\(@(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\)/);

    let priority: "low" | "medium" | "high" | "urgent" | undefined;
    if (rest.includes("🔺") || rest.toLowerCase().includes("urgente")) priority = "urgent";
    else if (rest.includes("⏫") || rest.toLowerCase().includes("alta")) priority = "high";
    else if (rest.includes("🔼") || rest.toLowerCase().includes("média") || rest.toLowerCase().includes("media")) priority = "medium";
    else if (rest.includes("🔽") || rest.toLowerCase().includes("baixa")) priority = "low";

    const cleanTitle = rest
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/, "")
      .replace(/⏰\s*\d{1,2}:\d{2}/, "")
      .replace(/\(@\d{4}-\d{2}-\d{2}\s*\d{1,2}:\d{2}\)/, "")
      .replace(/[🔺⏫🔼🔽]/g, "")
      .replace(/#[a-zA-Z0-9_\-\/]+/g, "")
      .trim();

    if (!cleanTitle) return;

    reviewCandidates.push({
      title: cleanTitle,
      priority,
      dueDate: dateMatch?.[1],
      dueTime: timeMatch?.[1],
      reminderDate: reminderMatch?.[1],
      reminderTime: reminderMatch?.[2],
      obsidianTaskString: trimmed,
    });
  });

  return {
    extractedTasks: undefined,
    suggestedReminders: [],
    reviewCandidates,
    summaryInsights:
      reviewCandidates.length > 0
        ? `${reviewCandidates.length} candidato(s) de tarefa encontrado(s) em [[${noteTitle}]]. Nenhum foi criado automaticamente; prioridade, prazo e lembrete precisam ser revisados antes do registro.`
        : `Nenhuma tarefa explícita foi encontrada em [[${noteTitle}]]. O Motor Local não criou ações por inferência.`,
    usedEngine: "Motor Local Grounded (0 tokens)",
  };
}

/**
 * Structural audit. The score is transparent: each of five knowledge pillars
 * contributes exactly 20 points only when at least one OFICIAL note exists there.
 * This is not a marketing-performance score.
 */
export function analyzeLocalVault(notes: ObsidianNote[]): VaultAuditInsight {
  const knowledgeGaps: VaultAuditInsight["knowledgeGaps"] = [];
  const suggestedCampaigns: VaultAuditInsight["suggestedCampaigns"] = [];

  const officialNotes = notes.filter((note) => note.frontmatter?.status === "OFICIAL");
  const inFolder = (folder: string) => officialNotes.filter((note) => normalizeTaxonomyFolder(note.folder) === folder);

  const strategyNotes = inFolder("01_Estrategia");
  const productNotes = inFolder("02_Produtos");
  const contentNotes = inFolder("03_Conteudos");
  const campaignNotes = inFolder("04_Campanhas");
  const learningNotes = inFolder("08_Aprendizados");

  const pillars = [strategyNotes, productNotes, contentNotes, campaignNotes, learningNotes];
  const coveredPillars = pillars.filter((group) => group.length > 0).length;
  const score = coveredPillars * 20;

  if (strategyNotes.length === 0) knowledgeGaps.push({ topic: "Estratégia", recommendation: "Criar uma nota OFICIAL em 01_Estrategia com posicionamento, público e tom de voz confirmados.", urgency: "alta" });
  if (productNotes.length === 0) knowledgeGaps.push({ topic: "Produtos e Oferta", recommendation: "Documentar em 02_Produtos somente especificações, preços, prazos e diferenciais confirmados.", urgency: "alta" });
  if (contentNotes.length === 0) knowledgeGaps.push({ topic: "Conteúdo", recommendation: "Adicionar modelos ou diretrizes aprovadas em 03_Conteudos.", urgency: "media" });
  if (campaignNotes.length === 0) knowledgeGaps.push({ topic: "Campanhas", recommendation: "Registrar planos e campanhas realmente executadas em 04_Campanhas.", urgency: "media" });
  if (learningNotes.length === 0) knowledgeGaps.push({ topic: "Aprendizados", recommendation: "Registrar resultados reais e aprendizados em 08_Aprendizados.", urgency: "baixa" });

  if (productNotes.length > 0 && strategyNotes.length > 0) {
    suggestedCampaigns.push({
      title: `Hipótese de campanha baseada em ${productNotes[0].title}`,
      rationale: `Existe uma fonte OFICIAL de produto ([[${productNotes[0].title}]]) e uma de estratégia ([[${strategyNotes[0].title}]]). A hipótese ainda exige briefing e aprovação humana.`,
      recommendedChannels: [],
      estimatedEffort: "PENDENTE",
    });
  }

  if (contentNotes.length > 0 && learningNotes.length > 0) {
    suggestedCampaigns.push({
      title: `Hipótese de reaproveitamento baseada em ${learningNotes[0].title}`,
      rationale: `Existe um aprendizado OFICIAL [[${learningNotes[0].title}]] e uma referência OFICIAL de conteúdo [[${contentNotes[0].title}]]. Formato, canal e esforço permanecem PENDENTES.`,
      recommendedChannels: [],
      estimatedEffort: "PENDENTE",
    });
  }

  const automatedWorkflowRecommendations = [
    "Classificar novas informações como CONFIRMADO, HIPÓTESE ou PENDENTE antes de usá-las em conteúdo.",
    "Registrar resultados reais em 08_Aprendizados antes de derivar novos aprendizados.",
  ];

  const scoreAnalysis = notes.length === 0
    ? "Vault sem notas. Prontidão estrutural: 0/100."
    : `Prontidão estrutural: ${score}/100. ${coveredPillars} de 5 pilares possuem ao menos uma nota OFICIAL. O indicador não mede performance de marketing.`;

  return {
    readinessScore: score,
    scoreAnalysis,
    knowledgeGaps,
    suggestedCampaigns,
    automatedWorkflowRecommendations,
  };
}