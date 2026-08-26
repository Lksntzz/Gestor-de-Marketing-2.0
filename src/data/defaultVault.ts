import { ObsidianNote, MarketingCampaign, MarketingTask, AutomationRule, IdeaItem, CreativeScript, VisualAsset } from "../types";

export const DEFAULT_OBSIDIAN_NOTES: ObsidianNote[] = [
  {
    id: "note-1",
    path: "00 - Estratégia/Brand Voice & Posicionamento.md",
    title: "Brand Voice & Posicionamento",
    folder: "00 - Estratégia",
    lastModified: "2026-08-24 14:30",
    tags: ["estrategia", "branding", "posicionamento", "tom-de-voz"],
    wikilinks: [
      "Persona - Tech Lead Rodrigo",
      "Persona - CMO Mariana",
      "Playbook de Copywriting",
      "SaaS Growth Engine",
    ],
    frontmatter: {
      title: "Brand Voice & Diretrizes de Posicionamento",
      tags: ["branding", "marketing", "estrategia"],
      category: "Estratégia Central",
      tone: "Autoritário, Claro, Empático, Focado em ROI",
      last_reviewed: "2026-08-20",
    },
    content: `---
title: Brand Voice & Diretrizes de Posicionamento
tags:
  - branding
  - marketing
  - estrategia
category: Estratégia Central
tone: "Autoritário, Claro, Empático, Focado em ROI"
last_reviewed: 2026-08-20
---

# 🎯 Brand Voice & Posicionamento de Mercado

## 1. Nossa Proposta de Valor
Ajudamos empresas B2B e equipes ágeis a transformar conhecimento disperso em receita previsível através de automações inteligentes e inteligência contextual.

## 2. Tom de Voz (Brand Persona)
- **Direto & Sem Jargões Vazios**: Não usamos buzzwords corporativos sem substância.
- **Baseado em Dados**: Cada argumento é sustentado por métricas, benchmarks e resultados práticos.
- **Empático com a rotina do tomador de decisão**: Reconhecemos a sobrecarga de trabalho do [[Persona - Tech Lead Rodrigo]] e da [[Persona - CMO Mariana]].

## 3. Pilares de Conteúdo
1. **Educação Técnica & Arquitetura de Dados**: Como estruturar fluxos sem fricção.
2. **Eficiência Operacional**: Redução de tempo em reuniões e tarefas manuais.
3. **Casos de Sucesso & ROI Real**: Estudos de caso do [[SaaS Growth Engine]].

## 4. Regras de Ouro de Copy
Consulte nosso [[Playbook de Copywriting]] antes de disparar qualquer campanha externa.
`,
  },
  {
    id: "note-2",
    path: "01 - Personas/Persona - Tech Lead Rodrigo.md",
    title: "Persona - Tech Lead Rodrigo",
    folder: "01 - Personas",
    lastModified: "2026-08-22 10:15",
    tags: ["personas", "b2b", "tecnico", "tech-lead"],
    wikilinks: ["Brand Voice & Posicionamento", "SaaS Growth Engine"],
    frontmatter: {
      title: "Persona: Tech Lead Rodrigo",
      tags: ["persona", "tech-lead", "b2b"],
      target_audience: "Líderes de Engenharia / CTOs",
      category: "Personas",
    },
    content: `---
title: "Persona: Tech Lead Rodrigo"
tags:
  - persona
  - tech-lead
  - b2b
target_audience: "Líderes de Engenharia / CTOs"
category: Personas
---

# 👨‍💻 Perfil: Rodrigo (Tech Lead / Staff Engineer)

- **Idade**: 34 anos
- **Cargo**: Tech Lead em SaaS escalando para Série A/B
- **Canais Favoritos**: LinkedIn, GitHub, Reddit (r/webdev, r/devops), newsletters técnicas (TLDR, Hacker News)

## Principais Dores & Frustrações
1. Documentação desatualizada e conhecimento espalhado em silos (Slack, Notion, Jira).
2. Ferramentas pesadas que exigem cliques infinitos em vez de integrações via Markdown/API.
3. Medo de vendor lock-in e perda de privacidade de dados da empresa.

## O que o convence (Gatilhos de Conversão)
- APIs abertas, interoperabilidade (Obsidian Markdown, REST APIs, Webhooks).
- Demonstrações técnicas sem enrolação (GIFs de terminal, snippets de código limpos).
- Segurança e controle local dos arquivos.

## Palavras & Termos que ele odeia
- "Plataforma mágica revolucionária 360".
- "Sem necessidade de saber o que acontece por baixo dos panos".
`,
  },
  {
    id: "note-3",
    path: "01 - Personas/Persona - CMO Mariana.md",
    title: "Persona - CMO Mariana",
    folder: "01 - Personas",
    lastModified: "2026-08-23 16:45",
    tags: ["personas", "cmo", "marketing-b2b", "executivos"],
    wikilinks: ["Brand Voice & Posicionamento", "Q3 Lançamento Growth Engine"],
    frontmatter: {
      title: "Persona: CMO Mariana",
      tags: ["persona", "cmo", "executivo"],
      target_audience: "Diretores e VPs de Marketing",
      category: "Personas",
    },
    content: `---
title: "Persona: CMO Mariana"
tags:
  - persona
  - cmo
  - executivo
target_audience: "Diretores e VPs de Marketing"
category: Personas
---

# 👩‍💼 Perfil: Mariana (CMO / VP de Growth)

- **Idade**: 41 anos
- **Objetivo Central**: Previsibilidade de pipeline de vendas e alinhamento Marketing + Vendas (RevOps).
- **Canais Favoritos**: LinkedIn, Podcasts de Negócios, Newsletters de Growth (Lenny's Newsletter, Reforge).

## Dores Centrais
1. Equipe perde tempo recriando materiais e esquecendo prazos de campanhas.
2. Dificuldade de manter consistência de tom de voz entre freelancers e agências.
3. Falta de relatórios acionáveis que mostrem o impacto real das campanhas no CAC e LTV.

## Mensagens Chave
- "Centralize sua inteligência de marketing onde seu time já pensa e produz."
- "Automação de lembretes e tarefas sem perder o controle criativo."
`,
  },
  {
    id: "note-4",
    path: "02 - Produtos/SaaS Growth Engine.md",
    title: "SaaS Growth Engine",
    folder: "02 - Produtos",
    lastModified: "2026-08-25 09:00",
    tags: ["produto", "ofertas", "pricing", "growth-engine"],
    wikilinks: ["Brand Voice & Posicionamento", "Q3 Lançamento Growth Engine"],
    frontmatter: {
      title: "Produto: SaaS Growth Engine v2.0",
      tags: ["produto", "saas", "pricing"],
      category: "Produtos",
      status: "Ativo",
    },
    content: `---
title: "Produto: SaaS Growth Engine v2.0"
tags:
  - produto
  - saas
  - pricing
category: Produtos
status: Ativo
---

# 🚀 SaaS Growth Engine (v2.0)

## Proposta Central
A suíte completa para automação de marketing de ponta a ponta integrada ao Obsidian, sincronizando notas de pesquisa com calendário de publicação e tarefas acionáveis.

## Funcionalidades Principais
- **Conector Nativo Obsidian REST API**: Sincronização bidirecional de notas e tarefas.
- **Motor de Inteligência Contextual**: Criação de campanhas baseadas nas notas da sua base de conhecimento.
- **Gerenciador de Lembretes & Tarefas**: Compatível com plugins populares (Obsidian Tasks, Obsidian Reminder).

## Planos & Pricing
- **Pro Tier**: R$ 197/mês (1 Vault, automações ilimitadas)
- **Team Tier**: R$ 497/mês (Até 5 colaboradores, relatórios avançados)
`,
  },
  {
    id: "note-5",
    path: "03 - Campanhas/Q3 Lançamento Growth Engine.md",
    title: "Q3 Lançamento Growth Engine",
    folder: "03 - Campanhas",
    lastModified: "2026-08-25 11:20",
    tags: ["campanha", "q3-2026", "lancamento", "growth"],
    wikilinks: [
      "Brand Voice & Posicionamento",
      "Persona - Tech Lead Rodrigo",
      "Persona - CMO Mariana",
      "Sequência de Onboarding Email",
    ],
    frontmatter: {
      title: "Campanha: Lançamento Q3 Growth Engine",
      tags: ["campanha", "lancamento", "q3"],
      status: "Em Andamento",
      publish_date: "2026-08-28",
      channel: "Multi-channel (LinkedIn + Email + Blog)",
    },
    content: `---
title: "Campanha: Lançamento Q3 Growth Engine"
tags:
  - campanha
  - lancamento
  - q3
status: Em Andamento
publish_date: 2026-08-28
channel: "Multi-channel (LinkedIn + Email + Blog)"
---

# 🎯 Campanha: Lançamento Q3 - Growth Engine v2.0

## Metas da Campanha
- 500 novos leads qualificados (MQLs)
- 80 testes gratuitos agendados
- 30 clientes pagantes no primeiro mês

## Mensagem Principal
"Chega de silos de marketing: conecte sua base de conhecimento no Obsidian direto à sua esteira de automação e tarefas diárias."

## Tarefas & Prazos (Obsidian Tasks & Reminders)
- [ ] Finalizar carrossel do LinkedIn focado em [[Persona - Tech Lead Rodrigo]] 📅 2026-08-26 ⏰ 14:00 #marketing/linkedin 🔺
- [ ] Configurar sequência de emails com [[Sequência de Onboarding Email]] 📅 2026-08-27 ⏰ 11:00 #marketing/email
- [ ] Publicar artigo SEO no blog institucional 📅 2026-08-28 ⏰ 09:00 #marketing/seo
- [ ] Revisar métricas do primeiro dia de lançamento (@2026-08-29 09:30)
`,
  },
  {
    id: "note-6",
    path: "04 - Conteúdo & Copy/Playbook de Copywriting.md",
    title: "Playbook de Copywriting",
    folder: "04 - Conteúdo & Copy",
    lastModified: "2026-08-21 17:00",
    tags: ["copywriting", "frameworks", "aida", "pas", "conteudo"],
    wikilinks: ["Brand Voice & Posicionamento"],
    frontmatter: {
      title: "Playbook de Copywriting & Frameworks",
      tags: ["copywriting", "templates", "frameworks"],
      category: "Guia de Escrita",
    },
    content: `---
title: Playbook de Copywriting & Frameworks
tags:
  - copywriting
  - templates
  - frameworks
category: Guia de Escrita
---

# ✍️ Playbook de Copywriting de Alta Conversão

## 1. Estrutura PAS (Problema - Agitação - Solução)
- **Problema**: Identifique a dor imediata do cliente (ex: "Suas notas de marketing vivem esquecidas").
- **Agitação**: Mostre o custo de não resolver (ex: "Você perde horas reescrevendo copies e perdendo prazos de campanhas").
- **Solução**: Apresente a saída elegante e prática (ex: "Automatize lembretes e tarefas via API do Obsidian").

## 2. Estrutura AIDA (Atenção - Interesse - Desejo - Ação)
- **Atenção**: Gancho visual e primeira linha instigante (Pattern Interrupt).
- **Interesse**: História rápida ou estatística impactante.
- **Desejo**: Benefício tangível (tempo poupado, aumento de ROI).
- **Ação**: Chamada única e sem ambiguidade (CTA).

## 3. Checklist de Validação
- O título tem menos de 65 caracteres?
- O primeiro parágrafo é claro em menos de 3 segundos de leitura?
- Existe apenas 1 CTA principal?
`,
  },
  {
    id: "note-7",
    path: "04 - Conteúdo & Copy/Sequência de Onboarding Email.md",
    title: "Sequência de Onboarding Email",
    folder: "04 - Conteúdo & Copy",
    lastModified: "2026-08-24 18:20",
    tags: ["email", "onboarding", "automacao", "nutricao"],
    wikilinks: ["SaaS Growth Engine", "Brand Voice & Posicionamento"],
    frontmatter: {
      title: "Sequência de Onboarding: 5 Emails de Boas-Vindas",
      tags: ["email-marketing", "onboarding", "fluxo-automatico"],
      category: "Email Marketing",
    },
    content: `---
title: "Sequência de Onboarding: 5 Emails de Boas-Vindas"
tags:
  - email-marketing
  - onboarding
  - fluxo-automatico
category: Email Marketing
---

# 📬 Sequência Automatizada de Onboarding

## Email 1 (Dia 0): Boas-vindas & Conexão do Obsidian
- **Assunto**: Seu cofre do Obsidian acaba de ganhar superpoderes de marketing 🧠
- **CTA**: Conectar Plugin Local REST API

## Email 2 (Dia 1): Como criar sua primeira campanha com IA
- **Assunto**: Transformando notas de personas em 5 posts de LinkedIn em 60s
- **CTA**: Abrir Criador de Campanhas

## Email 3 (Dia 3): Automação de Tarefas e Lembretes
- **Assunto**: Nunca mais perca um prazo editorial (plugin Tasks + Reminder)
- **CTA**: Ver painel de tarefas sincronizadas
`,
  },
  {
    id: "note-8",
    path: "05 - Pesquisas & Métricas/Pesquisa de Mercado - Tendências B2B 2026.md",
    title: "Pesquisa de Mercado - Tendências B2B 2026",
    folder: "05 - Pesquisas & Métricas",
    lastModified: "2026-08-25 10:00",
    tags: ["pesquisa", "metricas", "benchmarks", "tendencias", "kpi"],
    wikilinks: ["Brand Voice & Posicionamento", "Persona - Tech Lead Rodrigo", "SaaS Growth Engine"],
    frontmatter: {
      title: "Pesquisa de Mercado & Benchmarks de Funil B2B",
      tags: ["pesquisa", "metricas", "kpi", "benchmarks"],
      category: "Pesquisas & Inteligência",
      status: "Validado",
      kpi_alvo: "CAC < R$ 180 | CPL < R$ 45",
      persona_relacionada: "[[Persona - Tech Lead Rodrigo]]",
    },
    content: `---
title: "Pesquisa de Mercado & Benchmarks de Funil B2B"
tags:
  - pesquisa
  - metricas
  - kpi
  - benchmarks
category: Pesquisas & Inteligência
status: Validado
kpi_alvo: "CAC < R$ 180 | CPL < R$ 45"
persona_relacionada: "[[Persona - Tech Lead Rodrigo]]"
---

# 📊 Pesquisa de Mercado & Métricas de Performance

> [!metric] Principais Indicadores do Funil
> - **CPL Médio no LinkedIn Ads**: R$ 42,50 (abaixo do benchmark da indústria de R$ 68,00)
> - **Taxa de Conversão Landing Page**: 4.2% (meta trimestral: > 3.5%)
> - **CAC Atual**: R$ 164,00 | **LTV Estimado**: R$ 2.450,00 (Razão LTV:CAC = 14.9x)

## 💡 Dores e Oportunidades Identificadas
1. **Medo de Vendor Lock-in**: 78% dos líderes técnicos preferem ferramentas com arquivos Markdown locais a bancos de dados proprietários na nuvem.
2. **Perda de Contexto**: A transição entre pesquisa e briefing consome em média 4 horas por semana das equipes de marketing.

## 🎯 Ideias de Ganchos para Novas Campanhas
- *Ângulo 1 (Privacidade)*: "Por que seus dados de marketing não deveriam ficar reféns de plataformas proprietárias."
- *Ângulo 2 (Produtividade)*: "Como transformar 1 hora de pesquisa no Obsidian em 10 posts de alta conversão sem perder a voz da marca."

## 📋 Próximas Ações & Pesquisas
- [ ] Conduzir 5 entrevistas qualitativas com clientes da versão Beta 📅 2026-08-30 ⏰ 14:30 #pesquisa
- [ ] Atualizar tabela de benchmarks competitivos no cofre (@2026-09-02 10:00)
`,
  },
  {
    id: "note-9",
    path: "05 - SEO & Blog/Keywords Prioritárias 2026.md",
    title: "Keywords Prioritárias 2026",
    folder: "05 - SEO & Blog",
    lastModified: "2026-08-20 14:10",
    tags: ["seo", "keywords", "blog", "trafego-organico"],
    wikilinks: ["SaaS Growth Engine"],
    frontmatter: {
      title: "Keywords & Topic Clusters de SEO 2026",
      tags: ["seo", "pesquisa-palavras-chave", "cluster"],
      category: "SEO",
    },
    content: `---
title: Keywords & Topic Clusters de SEO 2026
tags:
  - seo
  - pesquisa-palavras-chave
  - cluster
category: SEO
---

# 🔍 Estratégia de Keywords & Clusters de Conteúdo

| Palavra-Chave | Volume Mensal | Dificuldade | Intenção de Busca | Nota Relacionada |
|---|---|---|---|---|
| obsidian marketing automation | 2.400 | Média | Transacional / Comercial | [[SaaS Growth Engine]] |
| obsidian rest api tarefas | 1.800 | Baixa | Informativa / Tutorial | [[Brand Voice & Posicionamento]] |
| gestão de conhecimento para marketing | 1.200 | Baixa | Comercial | [[Brand Voice & Posicionamento]] |
| obsidian reminder plugin automacao | 950 | Baixa | Informativa | [[Q3 Lançamento Growth Engine]] |
`,
  },
  {
    id: "note-10",
    path: "Daily Notes/2026-08-25.md",
    title: "Daily Note: 2026-08-25",
    folder: "Daily Notes",
    lastModified: "2026-08-25 12:00",
    tags: ["daily-note", "marketing", "tarefas", "lembretes"],
    wikilinks: ["Q3 Lançamento Growth Engine", "Persona - Tech Lead Rodrigo"],
    frontmatter: {
      title: "Daily Note: 25 de Agosto de 2026",
      tags: ["daily-note", "marketing-ops"],
      date: "2026-08-25",
    },
    content: `---
title: "Daily Note: 25 de Agosto de 2026"
tags:
  - daily-note
  - marketing-ops
date: 2026-08-25
---

# 📅 Daily Note: 25/08/2026 - Marketing Operations

## ⏰ Lembretes Ativos para Hoje
- [ ] ⏰ 14:00 Disparar teste A/B do email de onboarding para base de leads
- [ ] ⏰ 16:30 Alinhar cronograma de posts com designer (@2026-08-25 16:30)

## 📋 Tarefas Sincronizadas (Obsidian Tasks Plugin)
- [x] Revisar persona técnica [[Persona - Tech Lead Rodrigo]] para nova campanha 📅 2026-08-25
- [ ] Validar tags e frontmatter da campanha [[Q3 Lançamento Growth Engine]] 📅 2026-08-25 ⏰ 15:00 #marketing/campanhas
- [ ] Publicar teaser do produto no canal do LinkedIn 📅 2026-08-25 ⏰ 17:00 #marketing/social
`,
  },
];

export const DEFAULT_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: "camp-1",
    title: "Lançamento Q3 - SaaS Growth Engine v2.0",
    objective: "Geração de Leads Qualificados e Aquisição de Novos Usuários B2B",
    targetAudience: "Tech Leads, CTOs e Diretores de Marketing B2B",
    tone: "Autoritário, Técnico, Empático e Focado em Produtividade",
    status: "active",
    channels: ["LinkedIn", "Email Newsletter", "Blog SEO", "Twitter / X"],
    linkedNotePaths: [
      "00 - Estratégia/Brand Voice & Posicionamento.md",
      "01 - Personas/Persona - Tech Lead Rodrigo.md",
      "02 - Produtos/SaaS Growth Engine.md",
    ],
    obsidianOutputNotePath: "03 - Campanhas/Q3 Lançamento Growth Engine.md",
    summary:
      "Campanha focada em demonstrar a eliminação de silos de conhecimento através da integração nativa entre Obsidian e automação de marketing inteligente.",
    strategy:
      "Posicionar o produto como a única solução que respeita a privacidade local do Obsidian Markdown enquanto entrega automação de tarefas e lembretes com IA de última geração.",
    startDate: "2026-08-25",
    endDate: "2026-09-15",
    createdDate: "2026-08-24",
    channelsContent: [
      {
        channel: "LinkedIn",
        title: "Por que equipes de alta performance estão conectando seu Obsidian à automação de marketing",
        copy: `Quantas boas ideias de conteúdo você já perdeu porque estavam soterradas em notas no Obsidian?

Se você é Tech Lead ou Head de Marketing, você conhece o ciclo:
1. Você faz um estudo aprofundado de personas.
2. Escreve diretrizes de posicionamento impecáveis.
3. Na correria do dia a dia, sua equipe recorre a copies genéricas que não convertem.

O que mudou hoje:
Com o SaaS Growth Engine v2.0, conectamos sua base de conhecimento no Obsidian via REST API para gerar campanhas, tarefas e lembretes editoriais automatizados.

Zero silos. Zero retrabalho. Total controle em Markdown.

👉 Conheça o novo fluxo de trabalho e faça o teste gratuito no link do primeiro comentário.`,
        callToAction: "Teste a integração gratuita com o Obsidian hoje mesmo no link do comentário.",
        hashtagsOrKeywords: ["#ObsidianMD", "#MarketingAutomation", "#B2BGrowth", "#Productivity", "#PKM"],
        suggestedPublishDate: "2026-08-26",
      },
      {
        channel: "Email Newsletter",
        title: "[Lançamento] Sua base do Obsidian agora cria e agenda campanhas completas",
        copy: `Olá, líder de marketing,

Você já reparou quanto tempo seu time gasta abrindo 5 abas diferentes só para criar uma campanha alinhada com as personas da empresa?

Hoje estamos liberando oficialmente o SaaS Growth Engine v2.0.

O que ele faz na prática:
✅ Lê suas notas estratégicas do Obsidian (Personas, Brand Voice, Ofertas).
✅ Gera conteúdos adaptados para cada canal com IA contextual.
✅ Cria tarefas acionáveis e lembretes com alarme formatados para seus plugins favoritos do Obsidian (Tasks e Reminder).

Tudo sincronizado via API ou Markdown em 1 clique.

Clique no botão abaixo para ver a demonstração ao vivo:`,
        callToAction: "Ver Demonstração da Integração Obsidian",
        hashtagsOrKeywords: ["Obsidian API", "Automação de Lembretes", "Marketing B2B"],
        suggestedPublishDate: "2026-08-27",
      },
    ],
  },
];

export const DEFAULT_TASKS: MarketingTask[] = [
  {
    id: "task-1",
    title: "Finalizar criativos e copy do carrossel no LinkedIn",
    description: "Alinhar com as dores levantadas na nota da Persona Tech Lead",
    channel: "LinkedIn",
    priority: "urgent",
    status: "in-progress",
    dueDate: "2026-08-26",
    dueTime: "14:00",
    reminderDate: "2026-08-26",
    reminderTime: "11:30",
    obsidianTaskString: "- [ ] Finalizar criativos e copy do carrossel no LinkedIn 📅 2026-08-26 ⏰ 14:00 #marketing/linkedin 🔺",
    obsidianFilePath: "03 - Campanhas/Q3 Lançamento Growth Engine.md",
    linkedCampaignId: "camp-1",
    tags: ["marketing", "linkedin", "criativos"],
    isReminderActive: true,
  },
  {
    id: "task-2",
    title: "Configurar sequência de automação no conector Obsidian",
    description: "Testar endpoints de sincronização de tarefas no plugin Local REST API",
    channel: "Automação",
    priority: "high",
    status: "todo",
    dueDate: "2026-08-27",
    dueTime: "10:00",
    reminderDate: "2026-08-27",
    reminderTime: "09:00",
    obsidianTaskString: "- [ ] Configurar sequência de automação no conector Obsidian 📅 2026-08-27 ⏰ 10:00 #marketing/api ⏫",
    obsidianFilePath: "Daily Notes/2026-08-25.md",
    linkedCampaignId: "camp-1",
    tags: ["api", "obsidian", "automacao"],
    isReminderActive: true,
  },
  {
    id: "task-3",
    title: "Publicar post comemorativo de lançamento no LinkedIn e Twitter",
    description: "Incluir link nos comentários e marcar primeiros clientes beta",
    channel: "Social",
    priority: "urgent",
    status: "todo",
    dueDate: "2026-08-28",
    dueTime: "09:30",
    reminderDate: "2026-08-28",
    reminderTime: "08:45",
    obsidianTaskString: "- [ ] Publicar post comemorativo de lançamento no LinkedIn e Twitter 📅 2026-08-28 ⏰ 09:30 #marketing/lancamento 🔺",
    obsidianFilePath: "03 - Campanhas/Q3 Lançamento Growth Engine.md",
    linkedCampaignId: "camp-1",
    tags: ["social", "lancamento"],
    isReminderActive: true,
  },
  {
    id: "task-4",
    title: "Revisar relatório de conversão e abrir Daily Note de Q3",
    description: "Calcular CAC inicial e atualizar nota de métricas no Obsidian",
    channel: "Analytics",
    priority: "medium",
    status: "todo",
    dueDate: "2026-08-29",
    dueTime: "17:00",
    reminderDate: "2026-08-29",
    reminderTime: "16:00",
    obsidianTaskString: "- [ ] Revisar relatório de conversão e abrir Daily Note de Q3 📅 2026-08-29 ⏰ 17:00 #marketing/analytics 🔼",
    obsidianFilePath: "Daily Notes/2026-08-25.md",
    linkedCampaignId: "camp-1",
    tags: ["analytics", "kpi"],
    isReminderActive: true,
  },
];

export const DEFAULT_IDEAS: IdeaItem[] = [
  {
    id: "idea-1",
    title: "Por que CTOs estão abandonando o Notion pelo Obsidian?",
    category: "artigo",
    impact: "alto",
    status: "em-producao",
    targetPersona: "Persona - Tech Lead Rodrigo",
    hook: "O Notion virou uma planilha lenta. O Obsidian é seu segundo cérebro em Markdown puro sem vendor lock-in.",
    sourceNoteTitle: "Persona - Tech Lead Rodrigo",
    tags: ["tech-lead", "b2b", "comparativo"],
    estimatedReach: "12.5k views",
  },
  {
    id: "idea-2",
    title: "Framework de 3 Etapas para Alinhar Marketing e Vendas no Q3",
    category: "campanha",
    impact: "alto",
    status: "validado",
    targetPersona: "Persona - CMO Mariana",
    hook: "Como CMOs de SaaS estão reduzindo o ciclo de vendas em 28% integrando inteligência de personas às daily notes.",
    sourceNoteTitle: "Persona - CMO Mariana",
    tags: ["cmo", "revops", "framework"],
    estimatedReach: "8.2k views",
  },
  {
    id: "idea-3",
    title: "Carrossel: 5 Plugins Indispensáveis de Obsidian para Growth",
    category: "redes",
    impact: "medio",
    status: "ideia",
    targetPersona: "Líderes de Marketing & Growth",
    hook: "Tasks, Dataview, Local REST API, Reminder e Canvas: o stack definitivo de marketing.",
    sourceNoteTitle: "Playbook de Copywriting",
    tags: ["plugins", "carrossel", "produtividade"],
    estimatedReach: "15k views",
  },
  {
    id: "idea-4",
    title: "Template Obsidian Vault: Esteira Completa de Copywriting",
    category: "lead-magnet",
    impact: "estrategico",
    status: "em-producao",
    targetPersona: "Copywriters & Head of Growth",
    hook: "Baixe o cofre Obsidian configurado com frameworks PAS, AIDA e templates de lançamentos prontos.",
    sourceNoteTitle: "Playbook de Copywriting",
    tags: ["lead-magnet", "template", "mql"],
    estimatedReach: "500+ downloads",
  },
  {
    id: "idea-5",
    title: "Vídeo Rápido: Como Sincronizar Tarefas do Obsidian com o App",
    category: "video",
    impact: "medio",
    status: "ideia",
    targetPersona: "Tech Lead & Devs",
    hook: "Em 60 segundos: transforme uma nota com wikilinks em um cronograma com alarmes no seu Obsidian.",
    sourceNoteTitle: "SaaS Growth Engine",
    tags: ["tutorial", "reels", "demo"],
    estimatedReach: "9.8k views",
  },
];

export const DEFAULT_SCRIPTS: CreativeScript[] = [
  {
    id: "script-1",
    title: "Roteiro Reels / TikTok: O Fim do Caos nos Docs da Empresa",
    type: "video_reels",
    durationOrSlides: "45 segundos",
    objective: "Atrair Tech Leads e CMOs cansados de informações espalhadas",
    targetAudience: "Líderes de Tecnologia & Marketing",
    hookScene: "Mostre a tela do computador com 30 abas abertas de Notion, Jira e Google Docs enquanto a pessoa suspira.",
    bodyScenes: [
      {
        step: "00-05s",
        visualCues: "Corte rápido para zoom na expressão de desespero / close no mouse clicando freneticamente",
        audioOrNarration: "'Você passa metade do dia procurando aquele alinhamento de persona que alguém escreveu em maio?'",
      },
      {
        step: "05-20s",
        visualCues: "Tela limpa do Obsidian com grafo 3D conectando Personas -> Produtos -> Tarefas",
        audioOrNarration: "'E se toda a inteligência da sua empresa estivesse conectada em Markdown local com backlinks instantâneos?'",
      },
      {
        step: "20-35s",
        visualCues: "Dashboard do app gerando tarefas com 1 clique e abrindo na Daily Note",
        audioOrNarration: "'Com o SaaS Growth Engine, sua base de conhecimento gera campanhas e coloca os prazos no seu Obsidian Tasks automaticamente.'",
      },
      {
        step: "35-45s",
        visualCues: "Texto na tela com call to action claro e logo",
        audioOrNarration: "'Clique no link da bio e teste a sincronização agora mesmo.'",
      },
    ],
    callToAction: "Comente 'OBSIDIAN' para receber o cofre modelo direto na DM.",
    tags: ["reels", "video-curto", "topo-de-funil"],
  },
  {
    id: "script-2",
    title: "Roteiro Carrossel: Como Estruturar um Segundo Cérebro de Marketing",
    type: "carrossel_slide",
    durationOrSlides: "7 slides",
    objective: "Educação técnica e autoridade no LinkedIn e Instagram",
    targetAudience: "CMOs, Growth Hackers e Copywriters",
    hookScene: "Slide 1: Capa com fundo escuro minimalista e tipografia forte: 'A anatomia de um cofre de marketing que gera R$ 100k/mês.'",
    bodyScenes: [
      {
        step: "Slide 2",
        visualCues: "Esquema da pasta 00 - Estratégia com tags #branding e #posicionamento",
        audioOrNarration: "Passo 1: Brand Voice inviolável. Defina tom de voz e pilares para nunca mais aprovar copy desalinhada.",
      },
      {
        step: "Slide 3",
        visualCues: "Card destacando Persona Tech Lead com dores reais e métricas",
        audioOrNarration: "Passo 2: Personas Vivas. Atualize dores e termos proibidos a cada feedback de vendas.",
      },
      {
        step: "Slide 4",
        visualCues: "Template de copy usando o Framework PAS (Problema - Agitação - Solução)",
        audioOrNarration: "Passo 3: Playbook Modular. Tenha blocos de texto reaproveitáveis que a IA consulta sem inventar dados.",
      },
      {
        step: "Slide 5",
        visualCues: "Captura de tela do plugin Obsidian Tasks com 📅 e ⏰",
        audioOrNarration: "Passo 4: Execução na Daily Note. Transforme estratégia em checklist do dia sem mudar de app.",
      },
      {
        step: "Slide 6",
        visualCues: "Resumo comparativo: Pastas soltas vs Vault Conectado com backlinks [[...]]",
        audioOrNarration: "Resultado: 5h economizadas por semana por pessoa do time de marketing.",
      },
      {
        step: "Slide 7",
        visualCues: "Slide final de encerramento com foto de autor e botão de salvar",
        audioOrNarration: "Curtiu? Salve este post e compartilhe com seu time de conteúdo.",
      },
    ],
    callToAction: "Salve este carrossel para consultar na hora de organizar seu cofre!",
    tags: ["carrossel", "linkedin", "instagram"],
  },
  {
    id: "script-3",
    title: "Roteiro Vídeo YouTube / Demo: Tour Completo do Sistema PKM",
    type: "video_youtube",
    durationOrSlides: "4 minutos",
    objective: "Demonstração aprofundada de produto para conversão em vendas",
    targetAudience: "Tech Leads e Gestores de Conteúdo",
    hookScene: "Apresentador na bancada com microfone e duas telas: 'Hoje vou te mostrar como integro meu Obsidian a uma esteira de marketing de alto impacto.'",
    bodyScenes: [
      {
        step: "00:00 - 00:45",
        visualCues: "Abertura com visual clean, grafo do Obsidian em movimento",
        audioOrNarration: "Introdução: O problema de manter estratégia no papel e esquecer prazos de execução.",
      },
      {
        step: "00:45 - 02:00",
        visualCues: "Navegação pelas pastas 00 a 04, demonstrando backlinks bidirecionais",
        audioOrNarration: "Como estruturar pastas de Estratégia, Personas, Produtos e Copywriting.",
      },
      {
        step: "02:00 - 03:15",
        visualCues: "Geração de campanha no Dashboard e envio via Local REST API",
        audioOrNarration: "Como o motor heurístico e a IA analisam as notas para criar copies e tarefas prontas.",
      },
      {
        step: "03:15 - 04:00",
        visualCues: "Exibição do Obsidian Reminder apitando na tela na hora exata da publicação",
        audioOrNarration: "Conclusão: Fechamento do loop da ideia até o lembrete sonoro de disparo.",
      },
    ],
    callToAction: "Link na descrição para clonar a estrutura e testar o app gratuitamente.",
    tags: ["youtube", "tutorial-longo", "fundo-de-funil"],
  },
];

export const DEFAULT_VISUALS: VisualAsset[] = [
  {
    id: "vis-1",
    title: "Capa do Post: Elimine os Silos de Marketing",
    channel: "LinkedIn Feed",
    format: "1:1 Feed",
    aspectRatio: "1:1",
    promptVisual: "Minimalist modern dark UI interface showing connected knowledge graph nodes glowing purple and emerald on dark obsidian stone background with subtle code typography.",
    headlineOverlay: "Silos de Marketing custam caro. Conecte sua estratégia à execução.",
    colorPalette: ["#0f172a", "#9333ea", "#10b981", "#f8fafc"],
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    tags: ["linkedin", "dark-mode", "grafos"],
  },
  {
    id: "vis-2",
    title: "Banner YouTube: Obsidian para Criadores e Growth",
    channel: "YouTube Banner",
    format: "16:9 Banner/YouTube",
    aspectRatio: "16:9",
    promptVisual: "Isometric desk setup with laptop displaying markdown notes, glowing purple ambient light, clean aesthetic workspace with plants and coffee cup.",
    headlineOverlay: "Segundo Cérebro de Marketing: Do Zero ao Lançamento",
    colorPalette: ["#1e1b4b", "#6366f1", "#fbbf24", "#ffffff"],
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    tags: ["youtube", "banner", "setup"],
  },
  {
    id: "vis-3",
    title: "Story / Reels Frame: 5 Hacks de Produtividade PKM",
    channel: "Instagram / TikTok",
    format: "9:16 Story/Reels",
    aspectRatio: "9:16",
    promptVisual: "Vertical clean UI mockups showing calendar alerts, tasks with checkmarks and obsidian backlink popovers in high contrast dark purple and slate gray.",
    headlineOverlay: "5 Hacks do Obsidian que todo líder de marketing precisa saber",
    colorPalette: ["#18181b", "#a855f7", "#34d399", "#fafafa"],
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    tags: ["stories", "reels", "vertical"],
  },
  {
    id: "vis-4",
    title: "Carrossel Slide 1: Framework PAS em Ação",
    channel: "Instagram & LinkedIn",
    format: "Carrossel 4:5",
    aspectRatio: "4:5",
    promptVisual: "Clean typographic layout on textured off-white background with subtle purple accents, badge with 'Guia Prático' and bold typography.",
    headlineOverlay: "Problema. Agitação. Solução. Como dobrar o CTR das suas campanhas.",
    colorPalette: ["#f8fafc", "#475569", "#7c3aed", "#0f172a"],
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    tags: ["carrossel", "copywriting", "framework"],
  },
];

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule-1",
    name: "Auto-Criar Tarefas na Daily Note do Obsidian",
    description: "Quando uma nova campanha for gerada, insere automaticamente a lista de tarefas e prazos na nota do dia correspondente.",
    trigger: "on_campaign_created",
    action: "create_tasks_in_daily_note",
    enabled: true,
    executionCount: 14,
    lastRun: "2026-08-25 11:20",
  },
  {
    id: "rule-2",
    name: "Sincronizador de Lembretes do Obsidian Reminder",
    description: "Dispara notificações sonoras/visuais e grava a sintaxe (@YYYY-MM-DD HH:mm) diretamente no arquivo Markdown.",
    trigger: "daily_schedule",
    action: "schedule_reminders",
    enabled: true,
    executionCount: 29,
    lastRun: "2026-08-25 09:00",
  },
  {
    id: "rule-3",
    name: "Push Automático via Obsidian Local REST API",
    description: "Envia todas as novas notas estratégicas criadas pela IA diretamente para o cofre aberto no seu computador.",
    trigger: "on_campaign_created",
    action: "push_to_obsidian_api",
    enabled: true,
    executionCount: 8,
    lastRun: "2026-08-24 16:45",
  },
];

