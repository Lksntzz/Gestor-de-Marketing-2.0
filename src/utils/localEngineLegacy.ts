import {
  ObsidianNote,
  MarketingCampaign,
  MarketingChannelContent,
  MarketingTask,
  MarketingReminder,
  VaultAuditInsight,
} from "../types";
import { parseMarkdownNote, formatToObsidianTask } from "./obsidianUri";
import { normalizeTaxonomyFolder } from "../domain/taxonomy";

/**
 * DETERMINISTIC PKM MARKETING INTELLIGENCE ENGINE (NISTI PRINT)
 * Operates 100% locally with 0 tokens, instant speed, and zero external AI dependencies.
 * Uses linguistic heuristics, copywriting frameworks (AIDA, PAS, FAB),
 * wikilink graph analysis, and regex parsing.
 */

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

/**
 * Helper: Extract key terms, pains, metrics and personas from Obsidian notes
 */
function extractContextKnowledge(notes: ObsidianNote[], allowDrafts: boolean = false) {
  const personas: string[] = [];
  const pains: string[] = [];
  const valueProps: string[] = [];
  const metrics: string[] = [];
  const keywords: string[] = [];

  // Filter: ONLY OFICIAL notes by default to guide local engine
  const filteredNotes = allowDrafts 
    ? notes 
    : notes.filter(n => (n.frontmatter?.status === "OFICIAL" || !n.frontmatter?.status));

  filteredNotes.forEach((n) => {
    const { frontmatter, body, tags } = parseMarkdownNote(n.content);
    tags.forEach((t) => keywords.push(t));

    const normFolder = normalizeTaxonomyFolder(n.folder);
    if (normFolder === "01_Estrategia" || frontmatter.target_audience) {
      personas.push(frontmatter.title || n.title);
    }

    // Scan for callouts and bullet points
    const lines = body.split("\n");
    lines.forEach((line) => {
      const l = line.trim();
      if (l.startsWith("- **Dor") || l.includes("Dor Principal") || l.includes("Gargalo") || l.includes("Objeção")) {
        pains.push(l.replace(/^-\s*/, "").replace(/\*\*/g, ""));
      } else if (l.startsWith("- **Diferencial") || l.includes("Proposta de Valor") || l.includes("Benefício")) {
        valueProps.push(l.replace(/^-\s*/, "").replace(/\*\*/g, ""));
      } else if (l.includes("CAC") || l.includes("LTV") || l.includes("Taxa de Conversão") || l.includes("CPL") || l.includes("%")) {
        metrics.push(l.replace(/^-\s*/, "").replace(/\*\*/g, ""));
      }
    });
  });

  return {
    personas: personas.length > 0 ? personas : ["Empreendedoras de Papelaria", "Líderes Ministeriais", "Clientes Corporativos B2B"],
    pains: pains.length > 0 ? pains : ["Pedido mínimo alto em gráficas tradicionais", "Prazos longos e folhas que vazam tinta"],
    valueProps: valueProps.length > 0 ? valueProps : ["Impressão boutique sob demanda a partir de 10 unidades com acabamento Soft Touch e wire-o bronze", "Miolo offset 90g de alta gramatura"],
    metrics: metrics.length > 0 ? metrics : ["Margem de até 150% na revenda de planners", "Produção ágil em até 5 dias úteis"],
    keywords: Array.from(new Set(keywords)).slice(0, 10),
  };
}

/**
 * Deterministic Campaign & Copywriting Generator
 */
export function generateLocalCampaign(input: LocalCampaignInput) {
  const { campaignName, objective, channels, audience, tone, contextNotesList, customInstructions } = input;
  const knowledge = extractContextKnowledge(contextNotesList);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const chList = channels.length > 0 ? channels : ["Instagram", "WhatsApp B2B", "Email Marketing", "TikTok / Reels"];
  const targetAudience = audience || knowledge.personas.join(", ");
  const targetTone = tone || "Profissional, acolhedor, sofisticado e focado em excelência de acabamento";

  const primaryPain = knowledge.pains[0] || "tiragens mínimas inacessíveis e acabamento sem padrão editorial";
  const primaryValue = knowledge.valueProps[0] || "impressão boutique a partir de 10 unidades com laminação aveludada";
  const primaryMetric = knowledge.metrics[0] || "alta margem de lucro e fidelização imediata dos clientes";

  // Build channel-specific content
  const channelsContent: MarketingChannelContent[] = chList.map((channel, idx) => {
    const publishDate = new Date(today.getTime() + 86400000 * (idx + 1)).toISOString().split("T")[0];
    const chLower = channel.toLowerCase();

    if (chLower.includes("instagram") || chLower.includes("reels")) {
      return {
        channel: "Instagram",
        title: `Lançamento ${campaignName} - Acabamento Soft Touch`,
        copy: `O que diferencia um planner comum de um projeto autoral inesquecível? O toque.\n\nNa Nisti Print, produzimos tiragens a partir de 10 unidades com capa dura, laminação Soft Touch e encadernação wire-o bronze.\n\n✨ Destaques do projeto:\n- Papel 90g sem vazamento de caneta\n- Acabamento aveludado de luxo\n- Entrega no prazo para a sua campanha\n\nPronta para lançar a sua linha própria?`,
        callToAction: "Comente 'CATALOGO' para receber a tabela de atacado no direct.",
        hashtagsOrKeywords: ["#PapelariaFina", "#Planners2026", "#GraficaBoutique", "#NistiPrint"],
        suggestedPublishDate: publishDate,
        mediaType: "carousel",
      };
    }

    if (chLower.includes("whatsapp") || chLower.includes("b2b")) {
      return {
        channel: "WhatsApp B2B",
        title: `Proposta Especial: ${campaignName}`,
        copy: `Olá! Temos uma condição especial para a produção de planners e devocionais da sua marca/ministério para 2026.\n\nTrabalhamos com lotes a partir de 10 unidades e acabamento premium de livraria. Gostaria de receber nosso catálogo com tabela de atacado?`,
        callToAction: "Responder esta mensagem para receber a proposta em PDF.",
        hashtagsOrKeywords: ["vendas-diretas", "b2b", "atacado-papelaria"],
        suggestedPublishDate: publishDate,
        mediaType: "email",
      };
    }

    if (chLower.includes("email") || chLower.includes("newsletter")) {
      return {
        channel: "Email Marketing",
        title: `[Guia] Como lançar planners e devocionais autorais sem estoque parado`,
        copy: `Olá,\n\nSe você já quis lançar produtos impressos com a sua identidade mas esbarrou em pedidos mínimos de 500 ou 1.000 unidades, você precisa conhecer o modelo boutique da Nisti Print.\n\n📌 **O que entregamos**:\n- Lotes flexíveis a partir de 10 unidades\n- Miolo em papel encorpado 90g\n- Laminação aveludada Soft Touch e detalhes metalizados\n\n👉 Acesse o link abaixo e confira os projetos recentes produzidos em nossa fábrica.`,
        callToAction: "Ver Catálogo Completo 2026",
        hashtagsOrKeywords: ["email-marketing", "planners", "b2b-papelaria"],
        suggestedPublishDate: publishDate,
        mediaType: "email",
      };
    }

    // Default Fallback
    return {
      channel: channel,
      title: `${campaignName} - ${channel}`,
      copy: `Seu projeto editorial com acabamento de livraria e tiragens a partir de 10 unidades. Conheça a Nisti Print e encante sua audiência com qualidade incomparável.`,
      callToAction: "Clique para solicitar orçamento exclusivo.",
      hashtagsOrKeywords: ["#NistiPrint", "#PapelariaPersonalizada", "#GraficaBoutique"],
      suggestedPublishDate: publishDate,
      mediaType: "single_image",
    };
  });

  const tasks: MarketingTask[] = [
    {
      id: `task-local-${Date.now()}-1`,
      title: `Gravar demonstração de produto em vídeo para ${campaignName}`,
      channel: "Instagram",
      priority: "high",
      status: "todo",
      dueDate: new Date(today.getTime() + 86400000).toISOString().split("T")[0],
      dueTime: "10:00",
      tags: ["producao", "reels", "nisti"],
      obsidianTaskString: `- [ ] Gravar demonstração de produto em vídeo para ${campaignName} 📅 ${new Date(today.getTime() + 86400000).toISOString().split("T")[0]} ⏰ 10:00 #conteudo #instagram`,
      isReminderActive: true,
      reminderDate: new Date(today.getTime() + 86400000).toISOString().split("T")[0],
      reminderTime: "09:00",
    },
    {
      id: `task-local-${Date.now()}-2`,
      title: `Disparo de mensagens no WhatsApp B2B para clientes de papelaria`,
      channel: "WhatsApp B2B",
      priority: "urgent",
      status: "todo",
      dueDate: new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0],
      dueTime: "14:00",
      tags: ["vendas", "b2b", "prospeccao"],
      obsidianTaskString: `- [ ] Disparo de mensagens no WhatsApp B2B para clientes de papelaria 📅 ${new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0]} ⏰ 14:00 #vendas #b2b`,
      isReminderActive: true,
      reminderDate: new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0],
      reminderTime: "13:30",
    },
  ];

  const reminders: MarketingReminder[] = [
    {
      id: `rem-local-${Date.now()}-1`,
      taskId: tasks[0].id,
      taskTitle: tasks[0].title,
      channel: "Instagram",
      triggerDate: tasks[0].dueDate,
      triggerTime: "09:00",
      status: "pending",
      obsidianReminderString: `- [ ] ${tasks[0].title} (@${tasks[0].dueDate} 09:00)`,
    },
  ];

  const wikilinkReferences = contextNotesList.map((n) => `[[${n.title}]]`).join(", ") || "[[Brand Voice & Posicionamento]], [[Catálogo - Planners & Devocionais 2026]]";
  const campaignHash = `camp_${Date.now().toString(36)}`;

  const obsidianMarkdownNote = `---
id: "${campaignHash}"
tipo: "Plano de Campanha"
status: "OFICIAL"
owner: "Gestor de Marketing Nisti Print"
created_at: "${todayStr}"
updated_at: "${todayStr}"
confidencialidade: "Interno"
produto: "Linha Planners & Devocionais 2026"
nicho: "${targetAudience}"
canal: "${chList.join(", ")}"
projeto: "${campaignName}"
tags:
  - campanha
  - marketing-nisti
origem: "Gerador de Campanhas PKM"
approved_by: "Gestor de Marketing"
hash: "${campaignHash}"
title: "${campaignName}"
---

# 🚀 ${campaignName}

> [!summary] Resumo Estratégico
> - **Objetivo Principal**: ${objective}
> - **Público-Alvo**: ${targetAudience}
> - **Tom de Voz**: ${targetTone}
> - **Base de Conhecimento Vinculada**: ${wikilinkReferences}

---

## 🎯 Conteúdos por Canal de Distribuição

${channelsContent
  .map(
    (c) => `### 📢 ${c.channel}: ${c.title}
- **Data Sugerida de Publicação**: \`${c.suggestedPublishDate}\`
- **Keywords / Hashtags**: ${c.hashtagsOrKeywords.join(" ")}

#### Copy / Roteiro do Post:
${c.copy}

> [!tip] Call to Action (CTA)
> **${c.callToAction}**
`
  )
  .join("\n---\n\n")}

---

## 📋 Tarefas Automatizadas (Obsidian Tasks)
${tasks.map((t) => t.obsidianTaskString).join("\n")}

---

## ⏰ Lembretes Ativos (Obsidian Reminder)
${reminders.map((r) => r.obsidianReminderString).join("\n")}
`;

  return {
    summary: `Campanha '${campaignName}' estruturada localmente com o motor heurístico PKM da Nisti Print.`,
    strategy: `Foco em resolução da dor '${primaryPain}' e entrega de '${primaryValue}' para ${targetAudience}.`,
    channelsContent,
    tasks,
    reminders,
    obsidianMarkdownNote,
    usedEngine: "Motor Local Heurístico (0 tokens / Instantâneo)",
  };
}

/**
 * Deterministic Task & Reminder Extractor
 */
export function extractLocalTasksFromNote(input: LocalExtractionInput) {
  const { noteTitle, noteContent } = input;
  const lines = noteContent.split("\n");
  const extractedTasks: any[] = [];
  const suggestedReminders: any[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      let rest = trimmed.slice(5).trim();

      const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      const dueDate = dateMatch ? dateMatch[1] : new Date(today.getTime() + 86400000).toISOString().split("T")[0];

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

      if (cleanTitle) {
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
      }
    }
  });

  if (extractedTasks.length === 0) {
    const tomorrow = new Date(today.getTime() + 86400000).toISOString().split("T")[0];
    extractedTasks.push({
      title: `Revisar e incorporar conceitos de [[${noteTitle}]] na estratégia`,
      channel: "Estratégia",
      priority: "medium",
      dueDate: tomorrow,
      dueTime: "14:00",
      obsidianTaskString: `- [ ] Revisar e incorporar conceitos de [[${noteTitle}]] na estratégia 📅 ${tomorrow} ⏰ 14:00 #estrategia`,
      reminderDate: tomorrow,
      reminderTime: "10:00",
      category: "Revisão",
    });

    suggestedReminders.push({
      title: `Check-in da nota [[${noteTitle}]]`,
      triggerDate: tomorrow,
      triggerTime: "10:00",
      obsidianReminderString: `- [ ] Check-in da nota [[${noteTitle}]] (@${tomorrow} 10:00)`,
    });
  }

  return {
    extractedTasks,
    suggestedReminders,
    summaryInsights: `Extraídas ${extractedTasks.length} ações e ${suggestedReminders.length} lembretes a partir de [[${noteTitle}]].`,
    usedEngine: "Motor Local Heurístico (0 tokens / Instantâneo)",
  };
}

/**
 * Deterministic Vault Auditor & Knowledge Graph Analyzer (10 Official Folders)
 */
export function analyzeLocalVault(notes: ObsidianNote[]): VaultAuditInsight {
  let score = 50;
  const knowledgeGaps: VaultAuditInsight["knowledgeGaps"] = [];
  const suggestedCampaigns: VaultAuditInsight["suggestedCampaigns"] = [];

  const hasStrategy = notes.some((n) => normalizeTaxonomyFolder(n.folder) === "01_Estrategia");
  const hasProducts = notes.some((n) => normalizeTaxonomyFolder(n.folder) === "02_Produtos");
  const hasContent = notes.some((n) => normalizeTaxonomyFolder(n.folder) === "03_Conteudos");
  const hasCampaigns = notes.some((n) => normalizeTaxonomyFolder(n.folder) === "04_Campanhas");
  const hasLearnings = notes.some((n) => normalizeTaxonomyFolder(n.folder) === "08_Aprendizados");

  if (hasStrategy) score += 12;
  else knowledgeGaps.push({ topic: "Brand Voice e Personas", recommendation: "Crie uma nota em '01_Estrategia' com tom de voz e personas ICP.", urgency: "alta" });

  if (hasProducts) score += 12;
  else knowledgeGaps.push({ topic: "Catálogo de Produtos & Acabamentos", recommendation: "Documente especificações em '02_Produtos'.", urgency: "alta" });

  if (hasContent) score += 10;
  else knowledgeGaps.push({ topic: "Playbook de Copywriting & Roteiros", recommendation: "Adicione modelos em '03_Conteudos'.", urgency: "media" });

  if (hasCampaigns) score += 10;
  else knowledgeGaps.push({ topic: "Cronogramas de Campanha", recommendation: "Estruture planos em '04_Campanhas'.", urgency: "media" });

  if (hasLearnings) score += 6;
  else knowledgeGaps.push({ topic: "Métricas Pós-Campanha", recommendation: "Mapeie resultados em '08_Aprendizados'.", urgency: "baixa" });

  score = Math.min(100, Math.max(20, score));

  suggestedCampaigns.push({
    title: "Campanha: Planners Ministeriais 2026",
    rationale: "Antecipação de pedidos de final de ano para igrejas e convenções.",
    recommendedChannels: ["WhatsApp B2B", "Instagram", "Email Marketing"],
    estimatedEffort: "Médio",
  });

  suggestedCampaigns.push({
    title: "Série em Vídeo: Como Montar um Planner Autoral",
    rationale: "Desmistificar a barreira de entrada para empreendedoras de papelaria.",
    recommendedChannels: ["Instagram", "TikTok / Reels", "YouTube"],
    estimatedEffort: "Baixo",
  });

  const automatedWorkflowRecommendations = [
    "Sincronizar tarefas de marketing na Daily Note do Obsidian (`YYYY-MM-DD.md`).",
    "Utilizar o seletor de modo local para geração instantânea e ilimitada sem consumo de tokens.",
    "Adicionar tags de canal (`#instagram`, `#whatsapp`, `#email`) para indexação facilitada.",
  ];

  const scoreAnalysis = `Seu cofre possui ${notes.length} notas indexadas com uma pontuação de maturidade de ${score}/100.`;

  return {
    readinessScore: score,
    scoreAnalysis,
    knowledgeGaps,
    suggestedCampaigns,
    automatedWorkflowRecommendations,
  };
}
