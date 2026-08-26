import type {
  MarketingChannelContent,
  MarketingReminder,
  MarketingTask,
} from "../types";
import { localDateKey } from "./reliability";
import type { LocalCampaignInput, LocalExtractionInput } from "./localEngineLegacy";

export type { LocalCampaignInput, LocalExtractionInput };
export { extractLocalTasksFromNote, analyzeLocalVault } from "./localEngineLegacy";

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
 *
 * The legacy engine contained hard-coded commercial claims that could be
 * presented as facts even when the Vault did not support them. This wrapper
 * intentionally generates only planning/copy structure from user input and
 * references to notes marked OFICIAL. Missing business facts stay PENDENTE.
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
            "Antes de publicar, mantenha no texto final somente promessas, números, prazos, preços, diferenciais e características explicitamente confirmados nessas notas.",
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
