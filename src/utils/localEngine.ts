import type {
  MarketingChannelContent,
  MarketingReminder,
  MarketingTask,
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

function addLocalDays(base: Date, days: number): string {
  const date = new Date(base);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
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
 * It never supplies commercial numbers, prices, deadlines, product attributes
 * or promises that are not explicitly represented by notes marked OFICIAL.
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

  const now = new Date();
  const today = localDateKey(now);
  const selectedChannels = channels.length > 0 ? channels : ["Canal pendente"];
  const officialNotes = contextNotesList.filter((note) => note.frontmatter?.status === "OFICIAL");
  const hasConfirmedBase = officialNotes.length > 0;
  const knowledgeRefs = officialNotes.slice(0, 5).map((note) => `[[${note.title}]]`);
  const evidenceLabel = hasConfirmedBase
    ? knowledgeRefs.join(", ")
    : "PENDENTE: nenhuma nota OFICIAL foi selecionada como base";
  const targetAudience = audience.trim() || "PENDENTE: público-alvo não informado";
  const targetTone = tone.trim() || "PENDENTE: tom de voz não informado";
  const objectiveText = objective.trim() || "PENDENTE: objetivo não informado";

  const channelsContent: MarketingChannelContent[] = selectedChannels.map((channel, index) => {
    const safeChannel = channel || "Canal pendente";
    const publishDate = addLocalDays(now, index + 1);

    return {
      channel: safeChannel,
      title: `${campaignName} — ${safeChannel}`,
      copy: hasConfirmedBase
        ? [
            `Campanha: ${campaignName}.`,
            `Objetivo: ${objectiveText}.`,
            `Público: ${targetAudience}.`,
            `Base confirmada para consulta: ${evidenceLabel}.`,
            "Use no texto final somente promessas, números, prazos, preços, diferenciais e características explicitamente confirmados nessas notas.",
          ].join("\n\n")
        : [
            `Campanha: ${campaignName}.`,
            `Objetivo: ${objectiveText}.`,
            `Público: ${targetAudience}.`,
            "PENDENTE: a base selecionada não contém notas marcadas como OFICIAL.",
            "Não publicar alegações comerciais, números, preços, prazos ou características de produto até validar a informação no Vault.",
          ].join("\n\n"),
      callToAction: hasConfirmedBase
        ? "Definir CTA final após revisar a oferta confirmada na base oficial."
        : "PENDENTE: validar oferta e CTA antes da publicação.",
      hashtagsOrKeywords: [
        "marketing",
        normalizeTag(campaignName) || "campanha",
        normalizeTag(safeChannel) || "canal",
        hasConfirmedBase ? "base-confirmada" : "pendente-validacao",
      ],
      suggestedPublishDate: publishDate,
      mediaType: "single_image",
    };
  });

  const firstDueDate = addLocalDays(now, 1);
  const secondDueDate = addLocalDays(now, 2);
  const campaignSlug = normalizeTag(campaignName) || "campanha";

  const tasks: MarketingTask[] = [
    {
      id: `task-local-${campaignSlug}-validar-${today}`,
      title: `Validar fatos e oferta da campanha ${campaignName}`,
      description: hasConfirmedBase
        ? `Revisar ${evidenceLabel} e marcar o que está CONFIRMADO, HIPÓTESE ou PENDENTE antes da publicação.`
        : "Adicionar notas OFICIAL à base e validar oferta, público, diferenciais e restrições antes de produzir a peça final.",
      channel: "Planejamento",
      priority: hasConfirmedBase ? "high" : "urgent",
      status: "todo",
      dueDate: firstDueDate,
      dueTime: "10:00",
      reminderDate: firstDueDate,
      reminderTime: "09:00",
      obsidianTaskString: `- [ ] Validar fatos e oferta da campanha ${campaignName} 📅 ${firstDueDate} ⏰ 10:00 #marketing #validacao`,
      tags: ["marketing", "validacao", hasConfirmedBase ? "base-confirmada" : "pendente"],
      isReminderActive: true,
    },
    {
      id: `task-local-${campaignSlug}-produzir-${today}`,
      title: `Produzir conteúdo da campanha ${campaignName}`,
      description: `Produzir as peças para ${selectedChannels.join(", ")} usando apenas informações confirmadas na base.`,
      channel: selectedChannels[0],
      priority: "high",
      status: "todo",
      dueDate: secondDueDate,
      dueTime: "14:00",
      reminderDate: secondDueDate,
      reminderTime: "13:00",
      obsidianTaskString: `- [ ] Produzir conteúdo da campanha ${campaignName} 📅 ${secondDueDate} ⏰ 14:00 #marketing #conteudo`,
      tags: ["marketing", "conteudo", campaignSlug],
      isReminderActive: true,
    },
  ];

  const reminders: MarketingReminder[] = tasks.map((task, index) => ({
    id: `rem-local-${campaignSlug}-${index + 1}-${today}`,
    taskId: task.id,
    taskTitle: task.title,
    channel: task.channel,
    triggerDate: task.reminderDate || task.dueDate,
    triggerTime: task.reminderTime || task.dueTime || "09:00",
    status: "pending",
    obsidianReminderString: `- [ ] ${task.title} (@${task.reminderDate || task.dueDate} ${task.reminderTime || task.dueTime || "09:00"})`,
  }));

  const frontmatterStatus = hasConfirmedBase ? "OFICIAL" : "PENDENTE";
  const approval = hasConfirmedBase ? "Gestor de Marketing" : "";
  const customBlock = customInstructions?.trim()
    ? `\n## Instruções adicionais\n${customInstructions.trim()}\n`
    : "";

  const obsidianMarkdownNote = `---
id: "camp_${campaignSlug}_${today}"
tipo: "Plano de Campanha"
status: "${frontmatterStatus}"
owner: "Gestor de Marketing Nisti Print"
created_at: "${today}"
updated_at: "${today}"
confidencialidade: "Interno"
nicho: "${targetAudience.replace(/"/g, "'")}"
canal: "${selectedChannels.join(", ").replace(/"/g, "'")}"
projeto: "${campaignName.replace(/"/g, "'")}"
tags:
  - campanha
  - marketing
  - ${hasConfirmedBase ? "base-confirmada" : "pendente-validacao"}
origem: "Motor Local Grounded"
approved_by: "${approval}"
---

# ${campaignName}

> [!summary] Estado epistemológico
> - **Status**: ${frontmatterStatus}
> - **Objetivo**: ${objectiveText}
> - **Público-alvo**: ${targetAudience}
> - **Tom de voz**: ${targetTone}
> - **Base utilizada**: ${evidenceLabel}

> [!warning] Regra de segurança de conteúdo
> O Motor Local não deve inventar preços, prazos, métricas, características, diferenciais ou promessas. Qualquer informação não confirmada na base permanece **PENDENTE**.
${customBlock}
## Conteúdos por canal

${channelsContent
  .map(
    (content) => `### ${content.channel}\n**Data sugerida:** ${content.suggestedPublishDate}\n\n${content.copy}\n\n**CTA:** ${content.callToAction}`
  )
  .join("\n\n---\n\n")}

## Tarefas
${tasks.map((task) => task.obsidianTaskString).join("\n")}
`;

  return {
    summary: hasConfirmedBase
      ? `Campanha '${campaignName}' estruturada localmente com rastreabilidade para notas OFICIAL.`
      : `Campanha '${campaignName}' criada como PENDENTE porque ainda não há base OFICIAL suficiente para afirmar fatos comerciais.`,
    strategy: `Objetivo: ${objectiveText}. Público: ${targetAudience}. Base: ${evidenceLabel}.`,
    channelsContent,
    tasks,
    reminders,
    obsidianMarkdownNote,
    usedEngine: "Motor Local Grounded (0 tokens)",
    epistemicStatus: hasConfirmedBase ? "CONFIRMADO" : "PENDENTE",
  };
}

/** Extract explicit Markdown tasks without inventing task content from the note. */
export function extractLocalTasksFromNote(input: LocalExtractionInput) {
  const { noteTitle, noteContent } = input;
  const lines = noteContent.split("\n");
  const extractedTasks: any[] = [];
  const suggestedReminders: any[] = [];
  const now = new Date();

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- [ ]") && !trimmed.startsWith("- [x]")) return;

    const rest = trimmed.slice(5).trim();
    const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    const dueDate = dateMatch ? dateMatch[1] : addLocalDays(now, 1);
    const timeMatch = rest.match(/⏰\s*(\d{1,2}:\d{2})/);
    const dueTime = timeMatch ? timeMatch[1] : "14:00";
    const reminderMatch = rest.match(/\(@(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\)/);
    const reminderDate = reminderMatch ? reminderMatch[1] : dueDate;
    const reminderTime = reminderMatch ? reminderMatch[2] : "10:00";

    let priority = "medium";
    if (rest.includes("🔺") || rest.toLowerCase().includes("urgente")) priority = "urgent";
    else if (rest.includes("⏫") || rest.toLowerCase().includes("alta")) priority = "high";
    else if (rest.includes("🔽") || rest.toLowerCase().includes("baixa")) priority = "low";

    const cleanTitle = rest
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/, "")
      .replace(/⏰\s*\d{1,2}:\d{2}/, "")
      .replace(/\(@\d{4}-\d{2}-\d{2}\s*\d{1,2}:\d{2}\)/, "")
      .replace(/[🔺⏫🔼🔽]/g, "")
      .replace(/#[a-zA-Z0-9_\-\/]+/g, "")
      .trim();

    if (!cleanTitle) return;

    extractedTasks.push({
      title: cleanTitle,
      channel: "Geral",
      priority,
      dueDate,
      dueTime,
      obsidianTaskString: trimmed,
      reminderDate,
      reminderTime,
      category: "Planejamento",
    });

    suggestedReminders.push({
      title: cleanTitle,
      triggerDate: reminderDate,
      triggerTime: reminderTime,
      obsidianReminderString: `- [ ] ${cleanTitle} (@${reminderDate} ${reminderTime})`,
    });
  });

  return {
    extractedTasks,
    suggestedReminders,
    summaryInsights:
      extractedTasks.length > 0
        ? `Extraídas ${extractedTasks.length} ações explícitas e ${suggestedReminders.length} lembretes a partir de [[${noteTitle}]].`
        : `Nenhuma tarefa explícita foi encontrada em [[${noteTitle}]]. O Motor Local não criou ações por inferência.`,
    usedEngine: "Motor Local Grounded (0 tokens)",
  };
}

/** Audit structure and only suggest campaigns when an official note supports a theme. */
export function analyzeLocalVault(notes: ObsidianNote[]): VaultAuditInsight {
  let score = 50;
  const knowledgeGaps: VaultAuditInsight["knowledgeGaps"] = [];
  const suggestedCampaigns: VaultAuditInsight["suggestedCampaigns"] = [];

  const officialNotes = notes.filter((note) => note.frontmatter?.status === "OFICIAL");
  const inFolder = (folder: string) => officialNotes.filter((note) => normalizeTaxonomyFolder(note.folder) === folder);

  const strategyNotes = inFolder("01_Estrategia");
  const productNotes = inFolder("02_Produtos");
  const contentNotes = inFolder("03_Conteudos");
  const campaignNotes = inFolder("04_Campanhas");
  const learningNotes = inFolder("08_Aprendizados");

  if (strategyNotes.length > 0) score += 12;
  else knowledgeGaps.push({ topic: "Brand Voice e Público", recommendation: "Crie uma nota OFICIAL em 01_Estrategia com público, posicionamento e tom de voz confirmados.", urgency: "alta" });

  if (productNotes.length > 0) score += 12;
  else knowledgeGaps.push({ topic: "Produtos e Oferta", recommendation: "Documente em 02_Produtos somente especificações, preços, prazos e diferenciais confirmados.", urgency: "alta" });

  if (contentNotes.length > 0) score += 10;
  else knowledgeGaps.push({ topic: "Playbook de Conteúdo", recommendation: "Adicione modelos e diretrizes aprovadas em 03_Conteudos.", urgency: "media" });

  if (campaignNotes.length > 0) score += 10;
  else knowledgeGaps.push({ topic: "Histórico de Campanhas", recommendation: "Registre planos e campanhas executadas em 04_Campanhas.", urgency: "media" });

  if (learningNotes.length > 0) score += 6;
  else knowledgeGaps.push({ topic: "Aprendizados e Resultados", recommendation: "Registre resultados reais e aprendizados em 08_Aprendizados.", urgency: "baixa" });

  score = Math.min(100, Math.max(20, score));

  if (productNotes.length > 0 && strategyNotes.length > 0) {
    suggestedCampaigns.push({
      title: `Campanha baseada em ${productNotes[0].title}`,
      rationale: `Há base OFICIAL de produto ([[${productNotes[0].title}]]) e estratégia ([[${strategyNotes[0].title}]]). Validar a oferta e transformar esses dados confirmados em campanha.`,
      recommendedChannels: [],
      estimatedEffort: "PENDENTE: definir após briefing",
    });
  }

  if (contentNotes.length > 0 && learningNotes.length > 0) {
    suggestedCampaigns.push({
      title: `Reaproveitamento orientado por ${learningNotes[0].title}`,
      rationale: `Cruzar o aprendizado OFICIAL [[${learningNotes[0].title}]] com o playbook [[${contentNotes[0].title}]] antes de definir formato e canal.`,
      recommendedChannels: [],
      estimatedEffort: "PENDENTE: definir após briefing",
    });
  }

  const automatedWorkflowRecommendations = [
    "Sincronizar tarefas confirmadas na Daily Note do Obsidian.",
    "Classificar novas informações como CONFIRMADO, HIPÓTESE ou PENDENTE antes de usá-las em conteúdo.",
    "Registrar resultados reais em 08_Aprendizados para melhorar próximas decisões.",
  ];

  const scoreAnalysis = `O cofre possui ${notes.length} notas, sendo ${officialNotes.length} marcadas como OFICIAL. A maturidade estrutural calculada é ${score}/100.`;

  return {
    readinessScore: score,
    scoreAnalysis,
    knowledgeGaps,
    suggestedCampaigns,
    automatedWorkflowRecommendations,
  };
}
