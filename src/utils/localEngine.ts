import {
  ObsidianNote,
  MarketingCampaign,
  MarketingChannelContent,
  MarketingTask,
  MarketingReminder,
  VaultAuditInsight,
} from "../types";
import { parseMarkdownNote, formatToObsidianTask } from "./obsidianUri";

/**
 * DETERMINISTIC PKM MARKETING INTELLIGENCE ENGINE
 * Operates 100% locally with 0 tokens, instant speed, and zero AI dependencies.
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

  // Filter: ONLY OFICIAL notes by default to guide AI/Local engine unless allowDrafts is explicitly set
  const filteredNotes = allowDrafts 
    ? notes 
    : notes.filter(n => (n.frontmatter?.status === "OFICIAL" || !n.frontmatter?.status));

  filteredNotes.forEach((n) => {
    const { frontmatter, body, tags } = parseMarkdownNote(n.content);
    tags.forEach((t) => keywords.push(t));

    if (n.folder.toLowerCase().includes("estrategia") || n.folder.toLowerCase().includes("persona") || frontmatter.target_audience) {
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
    personas: personas.length > 0 ? personas : ["Empreendedoras de Papelaria", "Líderes de Comunidades", "Clientes B2B"],
    pains: pains.length > 0 ? pains : ["Pedido mínimo alto em gráficas tradicionais", "Prazos longos e acabamento com papel que vaza tinta"],
    valueProps: valueProps.length > 0 ? valueProps : ["Impressão sob demanda a partir de 10 unidades com acabamento Soft Touch e wire-o bronze", "Miolo offset 90g de alta resistência"],
    metrics: metrics.length > 0 ? metrics : ["Margem de até 150% na revenda", "Produção ágil em até 5 dias úteis"],
    keywords: Array.from(new Set(keywords)).slice(0, 10),
  };
}

/**
 * Deterministic Campaign & Copywriting Generator
 * Formats multi-channel marketing content with proven copy frameworks.
 */
export function generateLocalCampaign(input: LocalCampaignInput) {
  const { campaignName, objective, channels, audience, tone, contextNotesList, customInstructions } = input;
  const knowledge = extractContextKnowledge(contextNotesList);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const chList = channels.length > 0 ? channels : ["LinkedIn", "Email Newsletter", "Blog SEO", "Twitter / X"];
  const targetAudience = audience || knowledge.personas.join(", ");
  const targetTone = tone || "Profissional, analítico, persuasivo e focado em resultados";

  const primaryPain = knowledge.pains[0] || "processos fragmentados e perda de produtividade";
  const primaryValue = knowledge.valueProps[0] || "arquitetura de dados centralizada e execução contínua";
  const primaryMetric = knowledge.metrics[0] || "economia de 5+ horas semanais na rotina da equipe";

  // Build channel-specific content
  const channelsContent: MarketingChannelContent[] = chList.map((channel, idx) => {
    const publishDate = new Date(today.getTime() + 86400000 * (idx + 1)).toISOString().split("T")[0];
    const chLower = channel.toLowerCase();

    if (chLower.includes("linkedin")) {
      return {
        channel: "LinkedIn",
        title: `Por que ${targetAudience} estão reestruturando ${campaignName}?`,
        copy: `O maior gargalo identificado em nossas pesquisas recentes é simples: ${primaryPain}.\n\nQuando a estratégia fica presa em ferramentas isoladas, a equipe gasta mais tempo alinhando tarefas do que gerando impacto real.\n\nCom base em [[00 - Estratégia/Brand Voice & Posicionamento]] e na análise de [[01 - Personas/Persona - Tech Lead Rodrigo]], estruturamos 3 passos para ${objective.toLowerCase()}:\n\n1️⃣ **Documentação Atômica**: Centralize diretrizes no Obsidian para que qualquer pessoa produza com a mesma consistência.\n2️⃣ **Eliminação de Atrito**: Garanta ${primaryValue.toLowerCase()}.\n3️⃣ **Métricas Claras**: Foco em ${primaryMetric.toLowerCase()}.\n\nQual o principal desafio que você enfrenta hoje na sincronia entre planejamento e execução?`,
        callToAction: "Compartilhe sua experiência nos comentários ou envie uma mensagem direta.",
        hashtagsOrKeywords: ["#GestaoDeMarketing", "#ProdutividadePKM", "#Obsidian", "#EstrategiaB2B"],
        suggestedPublishDate: publishDate,
        mediaType: "carousel",
      };
    }

    if (chLower.includes("email") || chLower.includes("newsletter")) {
      return {
        channel: "Email Newsletter",
        title: `[Framework] Como alcançar ${objective} sem retrabalho`,
        copy: `Olá,\n\nSe você já sentiu que sua equipe passa mais tempo organizando reuniões e buscando notas antigas do que lançando campanhas, você não está sozinho.\n\nNossa pesquisa recente apontou que o maior vilão da produtividade é: "${primaryPain}".\n\n📌 **Nossa Abordagem Prática**:\nAlinhamos as diretrizes do nosso cofre Obsidian para transformar notas de pesquisa e personas em planos acionáveis instantaneamente.\n\n✨ **Resultados Esperados**:\n- ${primaryValue}\n- ${primaryMetric}\n\n👉 Acesse o roteiro completo e as tarefas prontas para o seu cofre abaixo.`,
        callToAction: "Ver Playbook Completo em Markdown",
        hashtagsOrKeywords: ["email-marketing", "produtividade", "lead-generation"],
        suggestedPublishDate: publishDate,
        mediaType: "email",
      };
    }

    if (chLower.includes("blog") || chLower.includes("seo")) {
      return {
        channel: "Blog SEO",
        title: `Guia Completo: ${campaignName} e as Melhores Práticas para ${targetAudience}`,
        copy: `# ${campaignName}: Estratégia e Execução de Alto Impacto\n\n## Introdução\nNo mercado atual, equipes de alta performance não dependem de intuição. Elas utilizam bases de conhecimento vivas (PKM) para alimentar cada decisão de marketing.\n\n## 1. O Problema Central\n${primaryPain}.\n\n## 2. A Solução Estratégica\nAo aplicar ${primaryValue}, sua empresa ganha consistência e agilidade.\n\n## 3. Indicadores Chave de Sucesso\n- Meta Principal: ${objective}\n- Impacto Medido: ${primaryMetric}\n\n## Conclusão\nIntegrar notas de personas com cronogramas e tarefas automatizadas no Obsidian elimina a dispersão de ideias.`,
        callToAction: "Agendar demonstração ou baixar modelo de notas",
        hashtagsOrKeywords: ["seo-marketing", "knowledge-management", "guia-b2b", "obsidian-tasks"],
        suggestedPublishDate: publishDate,
        mediaType: "text_thread",
      };
    }

    if (chLower.includes("twitter") || chLower.includes("x")) {
      return {
        channel: "Twitter / X",
        title: `Thread: O segredo por trás de ${campaignName}`,
        copy: `🧵 1/5 A maioria dos times de marketing falha não por falta de ideias, mas por causa de ${primaryPain.toLowerCase()}.\n\n2/5 Como resolvemos isso? Conectando nossa base de conhecimento no Obsidian direto à linha de produção.\n\n3/5 O pilar central: ${primaryValue}.\n\n4/5 Resultado direto: ${primaryMetric}.\n\n5/5 Se você quer ter o mesmo controle sobre seu marketing sem depender de ferramentas proprietárias, confira o link no perfil.`,
        callToAction: "Retweete se você acredita em gestão de marketing descentralizada!",
        hashtagsOrKeywords: ["#buildinpublic", "#PKM", "#Obsidian", "#MarketingStrategy"],
        suggestedPublishDate: publishDate,
        mediaType: "text_thread",
      };
    }

    // Default Fallback (Instagram, Ads, etc.)
    const safeChannel = channel || "Geral";
    return {
      channel: safeChannel,
      title: `${campaignName} para ${safeChannel}`,
      copy: `Descubra como alcançar ${objective} de forma consistente.\n\nTransformamos ${primaryPain.toLowerCase()} em ${primaryValue.toLowerCase()}.\n\nConfira nosso método documentado e acelere seus resultados com previsibilidade.`,
      callToAction: "Clique no link da bio para conferir o material completo",
      hashtagsOrKeywords: ["#MarketingDigital", "#Estrategia", `#${safeChannel.replace(/\s+/g, "")}`],
      suggestedPublishDate: publishDate,
      mediaType: "single_image",
    };
  });

  const primaryChannel = chList[0] || "Geral";

  // Build automated Obsidian tasks
  const tasks: Partial<MarketingTask>[] = [
    {
      title: `Validar briefings de ${campaignName} com base nas personas`,
      description: `Checar alinhamento com ${targetAudience} e proposta de valor.`,
      channel: "Estratégia",
      priority: "high",
      dueDate: new Date(today.getTime() + 86400000).toISOString().split("T")[0],
      dueTime: "10:30",
      reminderDate: new Date(today.getTime() + 86400000).toISOString().split("T")[0],
      reminderTime: "09:00",
      tags: ["marketing", "planejamento", "estrategia"],
      obsidianTaskString: `- [ ] Validar briefings de ${campaignName} com base nas personas 📅 ${new Date(today.getTime() + 86400000).toISOString().split("T")[0]} ⏰ 10:30 (@${new Date(today.getTime() + 86400000).toISOString().split("T")[0]} 09:00) ⏫ #marketing #estrategia`,
    },
    {
      title: `Produzir criativos e artes finais para ${primaryChannel}`,
      description: "Montar imagens, carrosséis e diagramas visuais.",
      channel: primaryChannel,
      priority: "medium",
      dueDate: new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0],
      dueTime: "15:00",
      reminderDate: new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0],
      reminderTime: "13:30",
      tags: ["design", "criativos", primaryChannel.toLowerCase().replace(/\s+/g, "-")],
      obsidianTaskString: `- [ ] Produzir criativos e artes finais para ${primaryChannel} 📅 ${new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0]} ⏰ 15:00 (@${new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0]} 13:30) 🔼 #design`,
    },
    {
      title: `Programar publicações e automações nos canais (${chList.slice(0, 2).join(", ") || "Canais"})`,
      description: "Agendar posts, configurar links rastreáveis UTM e testes A/B.",
      channel: "Distribuição",
      priority: "urgent",
      dueDate: new Date(today.getTime() + 86400000 * 3).toISOString().split("T")[0],
      dueTime: "09:00",
      reminderDate: new Date(today.getTime() + 86400000 * 3).toISOString().split("T")[0],
      reminderTime: "08:00",
      tags: ["lancamento", "distribuicao", "social"],
      obsidianTaskString: `- [ ] Programar publicações e automações nos canais 📅 ${new Date(today.getTime() + 86400000 * 3).toISOString().split("T")[0]} ⏰ 09:00 (@${new Date(today.getTime() + 86400000 * 3).toISOString().split("T")[0]} 08:00) 🔺 #lancamento`,
    },
  ];

  const reminders: MarketingReminder[] = [
    {
      id: `rem-local-${Date.now()}-1`,
      taskId: "task-local-1",
      taskTitle: `Revisão de qualidade: ${campaignName}`,
      channel: "Revisão",
      triggerDate: new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0],
      triggerTime: "14:00",
      status: "pending",
      obsidianReminderString: `- [ ] Revisão de qualidade: ${campaignName} (@${new Date(today.getTime() + 86400000 * 2).toISOString().split("T")[0]} 14:00)`,
    },
  ];

  // Build Obsidian Markdown Note
  const wikilinkReferences = contextNotesList.map((n) => `[[${n.title}]]`).join(", ") || "[[Brand Voice & Posicionamento Nisti Print]], [[Catálogo - Planners & Devocionais 2026]]";
  const campaignHash = `camp_${Date.now().toString(36)}`;

  const obsidianMarkdownNote = `---
id: "${campaignHash}"
tipo: "Campanha de Marketing"
status: "OFICIAL"
owner: "Gestor de Marketing Nisti Print"
created_at: "${todayStr}"
updated_at: "${todayStr}"
validade: "${new Date(today.getTime() + 86400000 * 60).toISOString().split("T")[0]}"
confidencialidade: "Interno"
produto: "Linha Nisti Print"
nicho: "${targetAudience}"
canal: "${chList.join(", ")}"
projeto: "${campaignName}"
tags:
  - campanha
  - marketing-nisti
  - ${(chList || []).map((c) => (c || "").toLowerCase().replace(/\s+/g, "-")).filter(Boolean).join("\n  - ")}
origem: "Gerador de Campanhas PKM"
approved_by: "Gestor de Marketing"
hash: "${campaignHash}"
title: "${campaignName}"
aliases:
  - "Campanha ${campaignName}"
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

#### Copy / Texto do Post:
${c.copy}

> [!tip] Call to Action (CTA)
> **${c.callToAction}**
`
  )
  .join("\n---\n\n")}

---

## 📋 Tarefas Automatizadas (Obsidian Tasks Plugin)
\`\`\`tasks
not done
path includes ${campaignName}
sort by due
\`\`\`

${tasks.map((t) => t.obsidianTaskString).join("\n")}

---

## ⏰ Lembretes Ativos (Obsidian Reminder Plugin)
${reminders.map((r) => r.obsidianReminderString).join("\n")}
`;

  return {
    summary: `Campanha '${campaignName}' estruturada localmente com o motor heurístico PKM com base nas diretrizes do cofre.`,
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
 * Parses Markdown checkboxes, action verbs, dates, and priorities via regex.
 */
export function extractLocalTasksFromNote(input: LocalExtractionInput) {
  const { noteTitle, noteContent } = input;
  const lines = noteContent.split("\n");
  const extractedTasks: any[] = [];
  const suggestedReminders: any[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. First pass: find explicit Obsidian task checkboxes
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
      const isDone = trimmed.startsWith("- [x]");
      let rest = trimmed.slice(5).trim();

      // Extract Due Date 📅 YYYY-MM-DD
      const dateMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      const dueDate = dateMatch ? dateMatch[1] : new Date(today.getTime() + 86400000).toISOString().split("T")[0];

      // Extract Due Time ⏰ HH:mm
      const timeMatch = rest.match(/⏰\s*(\d{1,2}:\d{2})/);
      const dueTime = timeMatch ? timeMatch[1] : "14:00";

      // Extract Reminder (@YYYY-MM-DD HH:mm)
      const reminderMatch = rest.match(/\(@(\d{4}-\d{2}-\d{2})\s*(\d{1,2}:\d{2})\)/);
      const reminderDate = reminderMatch ? reminderMatch[1] : dueDate;
      const reminderTime = reminderMatch ? reminderMatch[2] : "10:00";

      let priority = "medium";
      if (rest.includes("🔺") || rest.toLowerCase().includes("urgente")) priority = "urgent";
      else if (rest.includes("⏫") || rest.toLowerCase().includes("alta")) priority = "high";
      else if (rest.includes("🔽") || rest.toLowerCase().includes("baixa")) priority = "low";

      // Clean title
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
          category: "Ação de Nota",
        });

        if (reminderMatch || reminderDate) {
          suggestedReminders.push({
            title: `Lembrete: ${cleanTitle}`,
            triggerDate: reminderDate,
            triggerTime: reminderTime,
            obsidianReminderString: `- [ ] ${cleanTitle} (@${reminderDate} ${reminderTime})`,
          });
        }
      }
    }
  });

  // 2. Second pass: If no explicit checkboxes, extract action items from headers or bullet points
  if (extractedTasks.length === 0) {
    const actionVerbs = [
      "Agendar",
      "Revisar",
      "Criar",
      "Produzir",
      "Publicar",
      "Entrevistar",
      "Analisar",
      "Configurar",
      "Mapear",
      "Estruturar",
      "Testar",
      "Atualizar",
    ];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const startsWithAction = actionVerbs.some((verb) => trimmed.startsWith(verb) || trimmed.startsWith(`- ${verb}`) || trimmed.startsWith(`* ${verb}`));

      if (startsWithAction && trimmed.length > 10) {
        const cleanTitle = trimmed.replace(/^[-*]\s*/, "");
        const taskDue = new Date(today.getTime() + 86400000 * ((idx % 3) + 1)).toISOString().split("T")[0];

        const safeTag = (noteTitle || "nota").toLowerCase().replace(/\s+/g, "-");
        extractedTasks.push({
          title: cleanTitle,
          channel: "Geral",
          priority: "high",
          dueDate: taskDue,
          dueTime: "11:00",
          obsidianTaskString: `- [ ] ${cleanTitle} 📅 ${taskDue} ⏰ 11:00 #obsidian #${safeTag}`,
          reminderDate: taskDue,
          reminderTime: "09:00",
          category: "Ação Heurística",
        });

        suggestedReminders.push({
          title: `Lembrete: ${cleanTitle}`,
          triggerDate: taskDue,
          triggerTime: "09:00",
          obsidianReminderString: `- [ ] ${cleanTitle} (@${taskDue} 09:00)`,
        });
      }
    });
  }

  // 3. Guaranteed fallback if note is purely informational
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
    summaryInsights: `Extraídas ${extractedTasks.length} ações e ${suggestedReminders.length} lembretes a partir de [[${noteTitle}]] usando motor de regras local.`,
    usedEngine: "Motor Local Heurístico (0 tokens / Instantâneo)",
  };
}

/**
 * Deterministic Vault Auditor & Knowledge Graph Analyzer
 * Computes readiness score, knowledge gaps, and campaign ideas locally.
 */
export function analyzeLocalVault(notes: ObsidianNote[]): VaultAuditInsight {
  let score = 50; // base score
  const knowledgeGaps: VaultAuditInsight["knowledgeGaps"] = [];
  const suggestedCampaigns: VaultAuditInsight["suggestedCampaigns"] = [];

  const hasStrategy = notes.some((n) => n.folder.includes("00 - Estratégia") || n.tags.includes("brand-voice") || n.tags.includes("posicionamento"));
  const hasPersonas = notes.some((n) => n.folder.includes("01 - Personas") || n.tags.includes("persona"));
  const hasProducts = notes.some((n) => n.folder.includes("02 - Produtos") || n.tags.includes("produto") || n.tags.includes("saas"));
  const hasCopywriting = notes.some((n) => n.folder.includes("04 - Copywriting") || n.tags.includes("copywriting") || n.tags.includes("framework"));
  const hasMetrics = notes.some((n) => n.folder.includes("Pesquisas") || n.tags.includes("metricas") || n.tags.includes("kpi"));

  if (hasStrategy) score += 12;
  else knowledgeGaps.push({ topic: "Brand Voice e Diretrizes de Tom", recommendation: "Crie uma nota em '00 - Estratégia' com tom de voz e regras de comunicação.", urgency: "alta" });

  if (hasPersonas) score += 14;
  else knowledgeGaps.push({ topic: "Personas e ICP Definidos", recommendation: "Crie notas detalhando dores, objeções e canais preferidos do público em '01 - Personas'.", urgency: "alta" });

  if (hasProducts) score += 10;
  else knowledgeGaps.push({ topic: "Matriz de Produtos & Preços", recommendation: "Documente propostas de valor e diferenciais competitivos em '02 - Produtos'.", urgency: "media" });

  if (hasCopywriting) score += 8;
  else knowledgeGaps.push({ topic: "Playbook de Copywriting", recommendation: "Adicione modelos de ganchos e estruturas AIDA/PAS na pasta '04 - Copywriting'.", urgency: "baixa" });

  if (hasMetrics) score += 6;
  else knowledgeGaps.push({ topic: "Métricas & Benchmarks de Funil", recommendation: "Mapeie metas de CAC, LTV e taxas de conversão para calibrar o retorno das campanhas.", urgency: "media" });

  // Check for orphan notes without wikilinks
  const orphanNotes = notes.filter((n) => n.wikilinks.length === 0 && !n.folder.includes("Daily"));
  if (orphanNotes.length > 0) {
    knowledgeGaps.push({
      topic: `${orphanNotes.length} notas isoladas sem Wikilinks [[...]]`,
      recommendation: `Conecte notas como '${orphanNotes[0]?.title}' com suas personas e produtos para enriquecer o grafo de conhecimento.`,
      urgency: "baixa",
    });
  } else {
    score += 5;
  }

  score = Math.min(100, Math.max(20, score));

  // Generate logical campaign suggestions from available assets
  suggestedCampaigns.push({
    title: "Campanha: Liderança Técnica sem Vendor Lock-in",
    rationale: "Explora o posicionamento de arquivos locais e segurança documentados no cofre para atrair decisores de tecnologia.",
    recommendedChannels: ["LinkedIn", "Email Newsletter", "Blog SEO"],
    estimatedEffort: "Médio",
  });

  suggestedCampaigns.push({
    title: "Série Educativa: Copywriting Orientado a PKM",
    rationale: "Ensina como notas atômicas aceleram a produção de conteúdo sem perda de consistência editorial.",
    recommendedChannels: ["Twitter / X", "Instagram", "Blog SEO"],
    estimatedEffort: "Baixo",
  });

  suggestedCampaigns.push({
    title: "Automação Editorial: Do Briefing ao Calendário",
    rationale: "Demonstra o fluxo prático com tarefas do Obsidian Tasks e alarmes integrados à Daily Note.",
    recommendedChannels: ["Email Newsletter", "LinkedIn"],
    estimatedEffort: "Médio",
  });

  const automatedWorkflowRecommendations = [
    "Sincronizar automaticamente tarefas de marketing com a Daily Note do Obsidian (`Daily Notes/YYYY-MM-DD.md`).",
    "Utilizar o seletor de modo local para geração instantânea e ilimitada sem consumo de tokens.",
    "Adicionar tags de canal (`#linkedin`, `#email`, `#seo`) para indexação facilitada no plugin Dataview.",
  ];

  let scoreAnalysis = `Seu cofre possui ${notes.length} notas indexadas com uma pontuação de prontidão de ${score}/100. `;
  if (score >= 80) {
    scoreAnalysis += "A base está altamente madura e pronta para alimentar campanhas completas multicanal.";
  } else {
    scoreAnalysis += "Adicione as notas recomendadas nas lacunas para alcançar máxima consistência de marketing.";
  }

  return {
    readinessScore: score,
    scoreAnalysis,
    knowledgeGaps,
    suggestedCampaigns,
    automatedWorkflowRecommendations,
  };
}
