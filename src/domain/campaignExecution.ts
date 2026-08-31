import type { EditorialItem, MarketingCampaign, MarketingTask, ObsidianNote } from "../types";
import { formatToObsidianTask } from "../utils/obsidianUri";

export interface CampaignPlanSummary {
  campaignId: string;
  campaignName: string;
  totalPieces: number;
  completedPieces: number;
  scheduledPieces: number;
  draftPieces: number;
  phases: {
    name: string;
    description: string;
    items: EditorialItem[];
  }[];
}

export function buildCampaignEditorialSummary(
  campaign: MarketingCampaign,
  editorialItems: EditorialItem[],
): CampaignPlanSummary {
  const campaignTitle = campaign.title || (campaign as any).name || "";
  const linkedItems = editorialItems.filter(
    (item) => item.campaignId === campaign.id || item.title.toLowerCase().includes(campaignTitle.toLowerCase())
  );

  const completed = linkedItems.filter((i) => i.status === "PUBLISHED").length;
  const scheduled = linkedItems.filter((i) => i.status === "SCHEDULED").length;
  const drafts = linkedItems.filter((i) => i.status === "DRAFT" || i.status === "IN_PRODUCTION" || i.status === "REVIEW").length;

  // Derive standard phases: Aquecimento (Pre-launch), Lançamento/Abertura, Sustentação/Pós
  const phases = [
    {
      name: "1. Aquecimento & Consciência",
      description: "Geração de demanda, identificação de dores e engajamento do público-alvo.",
      items: linkedItems.filter((i) => (i.objective || "").toLowerCase().includes("atrair") || (i.objective || "").toLowerCase().includes("consciência") || (i.objective || "").toLowerCase().includes("educar")),
    },
    {
      name: "2. Abertura & Conversão",
      description: "Apresentação da oferta, prova social, quebra de objeções e chamadas diretas.",
      items: linkedItems.filter((i) => (i.objective || "").toLowerCase().includes("converter") || (i.objective || "").toLowerCase().includes("vender") || (i.objective || "").toLowerCase().includes("conversão")),
    },
    {
      name: "3. Sustentação & Retenção",
      description: "Depoimentos, repetições de urgência e consolidação da autoridade de marca.",
      items: linkedItems.filter((i) => (i.objective || "").toLowerCase().includes("reter") || (i.objective || "").toLowerCase().includes("autoridade") || (i.objective || "").toLowerCase().includes("relacionamento")),
    },
  ];

  return {
    campaignId: campaign.id,
    campaignName: campaignTitle,
    totalPieces: linkedItems.length,
    completedPieces: completed,
    scheduledPieces: scheduled,
    draftPieces: drafts,
    phases,
  };
}

export function exportCampaignToMarkdown(
  campaign: MarketingCampaign,
  editorialItems: EditorialItem[],
  tasks: MarketingTask[]
): string {
  const summary = buildCampaignEditorialSummary(campaign, editorialItems);
  const linkedTasks = tasks.filter((t) => t.linkedCampaignId === campaign.id || t.tags.includes(campaign.id));
  const campaignTitle = campaign.title || (campaign as any).name || "";
  const tone = campaign.tone || (campaign as any).targetTone || "";

  let md = `---
tipo: "Plano de Campanha"
status: "${campaign.status.toUpperCase()}"
projeto: "${campaignTitle}"
created_at: "${new Date().toISOString().split("T")[0]}"
tags:
  - "campanha"
  - "marketing"
---

# 🎯 Campanha: ${campaignTitle}

**Objetivo:** ${campaign.objective}  
**Público-Alvo:** ${campaign.targetAudience}  
**Tom de Voz:** ${tone}  
**Canais:** ${campaign.channels.join(", ")}  
**Status:** ${campaign.status.toUpperCase()}

---

## 📊 Progresso Editorial
- **Total de Peças Vinculadas:** ${summary.totalPieces}
- **Publicadas:** ${summary.completedPieces}
- **Agendadas:** ${summary.scheduledPieces}
- **Em Produção/Rascunho:** ${summary.draftPieces}

---

## 🗓️ Peças por Fase da Campanha

`;

  summary.phases.forEach((phase) => {
    md += `### ${phase.name}\n_${phase.description}_\n\n`;
    if (phase.items.length === 0) {
      md += `*Nenhuma peça mapeada especificamente para esta fase.*\n\n`;
    } else {
      phase.items.forEach((item) => {
        md += `- **[${item.status}]** ${item.title} (${item.platform} • ${item.contentType}) ${item.scheduledDate ? `📅 ${item.scheduledDate}` : ""}\n`;
      });
      md += `\n`;
    }
  });

  md += `---

## ✅ Tarefas Operacionais da Campanha

`;

  if (linkedTasks.length === 0) {
    md += `*Nenhuma tarefa operacional vinculada a esta campanha.*\n`;
  } else {
    linkedTasks.forEach((task) => {
      const checkbox = task.status === "done" ? "[x]" : "[ ]";
      md += `- ${checkbox} ${task.title} 🔺 ${task.priority.toUpperCase()} ${task.dueDate ? `📅 ${task.dueDate}` : ""} ${task.channel ? `🏷️ #${task.channel.toLowerCase()}` : ""}\n`;
    });
  }

  return md;
}
