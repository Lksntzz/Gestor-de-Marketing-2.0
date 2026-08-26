import {
  ObsidianNote,
  MarketingCampaign,
  MarketingTask,
  AutomationRule,
  IdeaItem,
  CreativeScript,
  VisualAsset,
} from "../types";

export const STANDARD_VAULT_FOLDERS = [
  "00_Inbox",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates",
];

export const DEFAULT_OBSIDIAN_NOTES: ObsidianNote[] = [
  {
    id: "note-1",
    path: "01_Estrategia/Brand Voice & Posicionamento Nisti Print.md",
    title: "Brand Voice & Posicionamento Nisti Print",
    folder: "01_Estrategia",
    lastModified: "2026-08-25 10:30",
    tags: ["estrategia", "branding", "posicionamento", "nisti-print", "tom-de-voz"],
    wikilinks: [
      "Persona - Empreendedora Mariana Papelaria",
      "Persona - Líder Eclesiástico Pastor Lucas",
      "Catálogo - Planners & Devocionais 2026",
      "Playbook de Copywriting & Vendas",
    ],
    frontmatter: {
      id: "note-1",
      tipo: "Estratégia Central",
      status: "OFICIAL",
      owner: "Diretoria de Marketing Nisti Print",
      created_at: "2026-08-01 09:00",
      updated_at: "2026-08-25 10:30",
      validade: "2027-12-31",
      confidencialidade: "Interno",
      produto: "Geral - Todos os Produtos",
      nicho: "Gráfica Digital & Papelaria Personalizada",
      canal: "Omnichannel",
      projeto: "Posicionamento Institucional",
      tags: ["estrategia", "branding", "posicionamento", "nisti-print"],
      origem: "Manual da Marca Nisti Print",
      approved_by: "Gestor de Marketing",
      hash: "np_strat_001",
    },
    content: `---
id: note-1
tipo: Estratégia Central
status: OFICIAL
owner: Diretoria de Marketing Nisti Print
created_at: 2026-08-01 09:00
updated_at: 2026-08-25 10:30
validade: 2027-12-31
confidencialidade: Interno
produto: Geral - Todos os Produtos
nicho: Gráfica Digital & Papelaria Personalizada
canal: Omnichannel
projeto: Posicionamento Institucional
tags:
  - estrategia
  - branding
  - posicionamento
  - nisti-print
origem: Manual da Marca Nisti Print
approved_by: Gestor de Marketing
hash: np_strat_001
---

# 🎯 Brand Voice & Posicionamento Nisti Print

## 1. Nossa Proposta de Valor
A **Nisti Print** é a gráfica digital de alta precisão que transforma projetos autorais, papelaria criativa e materiais corporativos em produtos físicos de acabamento impecável. Unimos tecnologia de impressão sob demanda, encadernação artesanal e entrega ágil para empreendedores, editoras e comunidades.

## 2. Tom de Voz (Brand Persona)
- **Acolhedor & Especialista**: Falamos com carinho e precisão técnica sobre papéis, gramaturas, acabamentos fosco/soft-touch e laminação hot stamping.
- **Inspirador & Focado em Sonhos**: Reconhecemos que cada planner, devocional ou brinde corporativo carrega a identidade e a visão do cliente.
- **Claro & Transparente**: Prazos de produção claros, simulação de frete justa e suporte humano humanizado.

## 3. Pilares de Conteúdo
1. **Qualidade de Acabamento & Unboxing**: Exaltação do sensorial (toque, cores vivas, encadernação wire-o reforçada).
2. **Histórias de Empreendedores**: Como o [[Persona - Empreendedora Mariana Papelaria]] fatura mais com produtos sob demanda.
3. **Planners & Fé**: Linha especializada para [[Persona - Líder Eclesiástico Pastor Lucas]] e ministérios com o [[Catálogo - Planners & Devocionais 2026]].

## 4. Diretrizes de Conversão
Siga sempre o nosso [[Playbook de Copywriting & Vendas]] para manter a promessa de acabamento premium e entrega pontual.
`,
  },
  {
    id: "note-2",
    path: "01_Estrategia/Persona - Empreendedora Mariana Papelaria.md",
    title: "Persona - Empreendedora Mariana Papelaria",
    folder: "01_Estrategia",
    lastModified: "2026-08-24 14:15",
    tags: ["personas", "papelaria-criativa", "empreendedora", "b2b-pequeno"],
    wikilinks: ["Brand Voice & Posicionamento Nisti Print", "Catálogo - Planners & Devocionais 2026"],
    frontmatter: {
      id: "note-2",
      tipo: "Persona & ICP",
      status: "OFICIAL",
      owner: "Squad de Aquisição",
      created_at: "2026-08-05 11:00",
      updated_at: "2026-08-24 14:15",
      validade: "2027-06-30",
      confidencialidade: "Interno",
      produto: "Planners, Cadernos e Brindes Personalizados",
      nicho: "Papelaria Criativa e E-commerce",
      canal: "Instagram / WhatsApp / TikTok",
      projeto: "Mapeamento de ICPs Nisti",
      tags: ["personas", "papelaria-criativa", "empreendedora"],
      origem: "Entrevistas com Clientes 2026",
      approved_by: "Gestor de Marketing",
      hash: "np_pers_002",
    },
    content: `---
id: note-2
tipo: Persona & ICP
status: OFICIAL
owner: Squad de Aquisição
created_at: 2026-08-05 11:00
updated_at: 2026-08-24 14:15
validade: 2027-06-30
confidencialidade: Interno
produto: Planners, Cadernos e Brindes Personalizados
nicho: Papelaria Criativa e E-commerce
canal: Instagram / WhatsApp / TikTok
projeto: Mapeamento de ICPs Nisti
tags:
  - personas
  - papelaria-criativa
  - empreendedora
origem: Entrevistas com Clientes 2026
approved_by: Gestor de Marketing
hash: np_pers_002
---

# 👩‍💼 Perfil da Persona: Mariana (Empreendedora Criativa & Papelaria)

- **Idade**: 29 anos
- **Negócio**: Loja online de papelaria personalizada e ilustrações autorais
- **Faturamento Médio**: R$ 15k a R$ 45k/mês
- **Canais**: Instagram (@mari.criativa), Pinterest, TikTok e loja virtual própria

## Principais Dores & Frustrações
1. Gráficas tradicionais exigem tiragens mínimas gigantescas (500+ unidades), amarrando o capital de giro.
2. Acabamentos imperfeitos (cores desbotadas, sangria cortada errada, capas tortas).
3. Prazos estourados perto de datas comemorativas (Volta às Aulas, Black Friday, Fim de Ano).

## O que a convence (Gatilhos de Conversão)
- **Tiragens Reduzidas / On-Demand**: Poder imprimir lotes a partir de 10 a 50 unidades sem perda de margem.
- **Amostra Física de Prova**: Receber a prova digital/física antes da rodagem completa.
- **Fidelidade de Cores (RGB para CMYK)** com garantia de reimpressão sem burocracia.
`,
  },
  {
    id: "note-3",
    path: "02_Produtos/Catálogo - Planners & Devocionais 2026.md",
    title: "Catálogo - Planners & Devocionais 2026",
    folder: "02_Produtos",
    lastModified: "2026-08-25 16:00",
    tags: ["produtos", "planners", "devocionais", "catalogo", "lancamento"],
    wikilinks: ["Brand Voice & Posicionamento Nisti Print", "Persona - Líder Eclesiástico Pastor Lucas"],
    frontmatter: {
      id: "note-3",
      tipo: "Catálogo de Produtos",
      status: "OFICIAL",
      owner: "Engenharia de Produto Nisti",
      created_at: "2026-08-10 08:00",
      updated_at: "2026-08-25 16:00",
      validade: "2026-12-31",
      confidencialidade: "Público",
      produto: "Planners 2026 & Devocionais Diários",
      nicho: "Papelaria Funcional & Linha Fé",
      canal: "E-commerce & B2B Corporativo",
      projeto: "Lançamento Coleção 2026",
      tags: ["produtos", "planners", "devocionais", "catalogo"],
      origem: "Ficha Técnica Industrial Nisti Print",
      approved_by: "Diretor de Operações",
      hash: "np_prod_003",
    },
    content: `---
id: note-3
tipo: Catálogo de Produtos
status: OFICIAL
owner: Engenharia de Produto Nisti
created_at: 2026-08-10 08:00
updated_at: 2026-08-25 16:00
validade: 2026-12-31
confidencialidade: Público
produto: Planners 2026 & Devocionais Diários
nicho: Papelaria Funcional & Linha Fé
canal: E-commerce & B2B Corporativo
projeto: Lançamento Coleção 2026
tags:
  - produtos
  - planners
  - devocionais
  - catalogo
origem: Ficha Técnica Industrial Nisti Print
approved_by: Diretor de Operações
hash: np_prod_003
---

# 📖 Catálogo de Produtos: Planners & Devocionais Nisti 2026

## 1. Especificações Técnicas
- **Capa**: Capa dura 2.0mm com laminação Soft Touch fosca ou brilho holográfico.
- **Miolo**: Papel Offset 90g ou Pólen Soft 80g (não passa tinta de marca-texto nem caneta gel).
- **Acabamento**: Wire-o metálico reforçado (bronze, preto ou prata) com elástico acetinado e bolso interno duplo.
- **Opcionais**: Hot stamping dourado/prata localizado no nome do cliente.

## 2. Tabela de Preços & Margens de Revenda (B2B)
- **10 a 49 unidades**: R$ 38,90 / un (Preço sugerido de venda final: R$ 89,00 a R$ 119,00).
- **50 a 199 unidades**: R$ 29,50 / un.
- **200+ unidades**: R$ 24,90 / un.

## 3. Principais Argumentos de Venda
- "Seu projeto com toque de livraria profissional."
- "Sem pedido mínimo abusivo: comece com 10 unidades e teste o seu público."
`,
  },
  {
    id: "note-4",
    path: "03_Conteudos/Playbook de Copywriting & Vendas.md",
    title: "Playbook de Copywriting & Vendas",
    folder: "03_Conteudos",
    lastModified: "2026-08-24 18:20",
    tags: ["copywriting", "conteudos", "playbook", "ganchos", "conversao"],
    wikilinks: ["Brand Voice & Posicionamento Nisti Print", "Catálogo - Planners & Devocionais 2026"],
    frontmatter: {
      id: "note-4",
      tipo: "Playbook de Conteúdo",
      status: "OFICIAL",
      owner: "Squad de Conteúdo",
      created_at: "2026-08-12 14:00",
      updated_at: "2026-08-24 18:20",
      validade: "2027-12-31",
      confidencialidade: "Interno",
      produto: "Todos",
      nicho: "Copywriting & Tráfego Pago",
      canal: "Instagram / Anúncios / Email",
      projeto: "Padronização de Copy",
      tags: ["copywriting", "conteudos", "playbook", "ganchos"],
      origem: "Testes A/B Nisti 2025/2026",
      approved_by: "Gestor de Marketing",
      hash: "np_copy_004",
    },
    content: `---
id: note-4
tipo: Playbook de Conteúdo
status: OFICIAL
owner: Squad de Conteúdo
created_at: 2026-08-12 14:00
updated_at: 2026-08-24 18:20
validade: 2027-12-31
confidencialidade: Interno
produto: Todos
nicho: Copywriting & Tráfego Pago
canal: Instagram / Anúncios / Email
projeto: Padronização de Copy
tags:
  - copywriting
  - conteudos
  - playbook
  - ganchos
origem: Testes A/B Nisti 2025/2026
approved_by: Gestor de Marketing
hash: np_copy_004
---

# ✍️ Playbook de Copywriting & Ganchos de Alta Conversão

## 1. Fórmulas de Ganchos (Hooks) Validados
1. **Gancho de Alívio**: "Você não precisa imprimir 500 planners para ter preço de atacado e acabamento de luxo."
2. **Gancho de Frustração**: "Cansado de receber miolo com papel fino que vaza a tinta da caneta? Conheça o offset 90g da Nisti Print."
3. **Gancho de Prova Visual**: "Veja o teste da lâmina e da gota d'água na nossa laminação Soft Touch."

## 2. Chamadas para Ação (CTAs) de Sucesso
- "Toque no link da bio para solicitar uma amostra digital do seu material com o seu logo."
- "Fale com um dos nossos consultores técnicos no WhatsApp e garanta a cotação especial para o seu lote."
`,
  },
  {
    id: "note-5",
    path: "00_Inbox/Rascunho - Ideias Parceria com Escolas e Igrejas.md",
    title: "Rascunho - Ideias Parceria com Escolas e Igrejas",
    folder: "00_Inbox",
    lastModified: "2026-08-26 08:00",
    tags: ["inbox", "rascunho", "parcerias", "ideias"],
    wikilinks: ["Catálogo - Planners & Devocionais 2026"],
    frontmatter: {
      id: "note-5",
      tipo: "Captura Bruta",
      status: "NOVO",
      owner: "Gestor de Marketing",
      created_at: "2026-08-26 08:00",
      updated_at: "2026-08-26 08:00",
      validade: "2026-09-30",
      confidencialidade: "Interno",
      produto: "Agendas Escolares & Devocionais",
      nicho: "Educação & Religioso",
      canal: "Prospecção Direta",
      projeto: "Expansão B2B",
      tags: ["inbox", "rascunho", "parcerias", "ideias"],
      origem: "Anotação rápida de reunião",
      approved_by: "",
      hash: "np_inbox_005",
    },
    content: `---
id: note-5
tipo: Captura Bruta
status: NOVO
owner: Gestor de Marketing
created_at: 2026-08-26 08:00
updated_at: 2026-08-26 08:00
validade: 2026-09-30
confidencialidade: Interno
produto: Agendas Escolares & Devocionais
nicho: Educação & Religioso
canal: Prospecção Direta
projeto: Expansão B2B
tags:
  - inbox
  - rascunho
  - parcerias
  - ideias
origem: Anotação rápida de reunião
approved_by: ""
hash: np_inbox_005
---

# 📥 Ideias para Kit Escolar e Congressos de Mulheres

- Mapear 20 colégios particulares da região para propor agendas escolares personalizadas para o ano letivo de 2027.
- Oferecer mini-devocionais de brinde para congressos de jovens e conferências de liderança.
- Validar se a margem comporta desconto progressivo acima de 300 unidades.

> **Status da Nota**: NOVO (aguardando revisão para ser classificado em 07_Pesquisas ou 04_Campanhas).
`,
  },
  {
    id: "note-6",
    path: "08_Aprendizados/Relatório Pós-Campanha Volta às Aulas.md",
    title: "Relatório Pós-Campanha Volta às Aulas",
    folder: "08_Aprendizados",
    lastModified: "2026-08-20 15:40",
    tags: ["aprendizados", "metricas", "pos-campanha", "insights"],
    wikilinks: ["Brand Voice & Posicionamento Nisti Print", "Persona - Empreendedora Mariana Papelaria"],
    frontmatter: {
      id: "note-6",
      tipo: "Registro de Aprendizado",
      status: "OFICIAL",
      owner: "Gestor de Tráfego & BI",
      created_at: "2026-08-20 15:40",
      updated_at: "2026-08-20 15:40",
      validade: "2027-12-31",
      confidencialidade: "Interno",
      produto: "Cadernos & Planners de Estudo",
      nicho: "Estudantes & Papelarias",
      canal: "Meta Ads & E-mail",
      projeto: "Campanha Volta às Aulas",
      tags: ["aprendizados", "metricas", "pos-campanha", "insights"],
      origem: "Dashboard de Performance",
      approved_by: "Diretoria",
      hash: "np_learn_006",
    },
    content: `---
id: note-6
tipo: Registro de Aprendizado
status: OFICIAL
owner: Gestor de Tráfego & BI
created_at: 2026-08-20 15:40
updated_at: 2026-08-20 15:40
validade: 2027-12-31
confidencialidade: Interno
produto: Cadernos & Planners de Estudo
nicho: Estudantes & Papelarias
canal: Meta Ads & E-mail
projeto: Campanha Volta às Aulas
tags:
  - aprendizados
  - metricas
  - pos-campanha
  - insights
origem: Dashboard de Performance
approved_by: Diretoria
hash: np_learn_006
---

# 📊 Aprendizados da Campanha Volta às Aulas

## 1. O que funcionou muito bem (Vencedores)
- Vídeos curtos (Reels/TikTok) no estilo "ASMR de acabamento e wire-o sendo prensado" geraram 4,2x mais cliques para o WhatsApp do que fotos estáticas.
- Anúncios com foco na dor de "pedido mínimo baixo para papelarias locais" tiveram CTR de 3,8% com CAC 35% menor.

## 2. O que devemos evitar
- Anúncios com textos longos sem mostrar a textura física do papel tiveram taxa de rejeição alta.
`,
  },
  {
    id: "note-7",
    path: "99_Templates/Template Nota Oficial de Produto.md",
    title: "Template Nota Oficial de Produto",
    folder: "99_Templates",
    lastModified: "2026-08-01 10:00",
    tags: ["templates", "padrao", "estrutura", "produto"],
    wikilinks: [],
    frontmatter: {
      id: "note-7",
      tipo: "Template de Documento",
      status: "OFICIAL",
      owner: "Gestor de Conhecimento",
      created_at: "2026-08-01 10:00",
      updated_at: "2026-08-01 10:00",
      validade: "2028-12-31",
      confidencialidade: "Público",
      produto: "Genérico",
      nicho: "Todos",
      canal: "Interno",
      projeto: "Governança PKM",
      tags: ["templates", "padrao", "estrutura", "produto"],
      origem: "Guia de Estilo Nisti Print",
      approved_by: "Gestor de Marketing",
      hash: "np_tmpl_007",
    },
    content: `---
id: {{id}}
tipo: Ficha de Produto
status: NOVO
owner: {{owner}}
created_at: {{created_at}}
updated_at: {{updated_at}}
validade: {{validade}}
confidencialidade: Interno
produto: {{produto}}
nicho: {{nicho}}
canal: {{canal}}
projeto: {{projeto}}
tags:
  - produto
  - nisti-print
origem: {{origem}}
approved_by: ""
hash: {{hash}}
---

# 📦 {{produto}}

## 1. Descrição & Diferenciais
- Descreva aqui os diferenciais técnicos e visuais do produto.

## 2. Acabamentos & Papéis Disponíveis
- Gramaturas, tipos de laminação, formatos e embalagem.

## 3. Argumentos de Venda & Público-Alvo
- Dores que resolve e ganchos de persuasão.
`,
  },
];

export const DEFAULT_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: "camp-1",
    title: "Lançamento Linha Planners & Devocionais 2026 Nisti Print",
    objective: "Geração de 350 pedidos B2B e captação de 1.200 leads de papelarias criativas",
    targetAudience: "Empreendedoras de Papelaria, Líderes de Comunidades e Autores Independentes",
    tone: "Inspirador, sofisticado, técnico e focado na facilidade de tiragens reduzidas",
    status: "active",
    channels: ["Instagram", "Email Newsletter", "WhatsApp VIP", "Meta Ads"],
    channelsContent: [
      {
        channel: "Instagram",
        title: "Carrossel: O Fim dos Pedidos Mínimos Abusivos",
        copy: "Você já desenhou a coleção de planners mais linda do ano, mas a gráfica pediu 500 unidades para rodar?\n\nNa Nisti Print, seu projeto ganha vida a partir de 10 unidades com laminação Soft Touch, wire-o bronze e capa dura 2.0mm.\n\n👉 Passe para o lado e veja o teste de folheação sem vazamento de tinta no nosso miolo offset 90g.\n\nComente 'PROVA' para receber uma cotação instantânea no Direct.",
        callToAction: "Comente 'PROVA' para falar com nossa equipe técnica.",
        hashtagsOrKeywords: ["#NistiPrint", "#Planners2026", "#PapelariaCriativa", "#ImpressaoSobDemanda"],
        suggestedPublishDate: "2026-08-28",
        mediaType: "carousel",
      },
      {
        channel: "Email Newsletter",
        title: "[Convite VIP] Garanta seu lote de Planners 2026 com tabela antecipada",
        copy: "Olá Criador(a),\n\nA temporada de ouro da papelaria começou. Criamos uma condição exclusiva para clientes cadastrados imprimirem lotes de Planners e Devocionais 2026 com prova física inclusa e frete fixo regional.\n\nConfira as especificações no nosso catálogo e reserve sua janela de impressão antes da lotação da fábrica.",
        callToAction: "Ver Catálogo Técnico e Reservar Lote",
        hashtagsOrKeywords: ["email-b2b", "lancamento-planners", "nisti-print"],
        suggestedPublishDate: "2026-08-29",
        mediaType: "email",
      },
    ],
    linkedNotePaths: [
      "01_Estrategia/Brand Voice & Posicionamento Nisti Print.md",
      "02_Produtos/Catálogo - Planners & Devocionais 2026.md",
      "03_Conteudos/Playbook de Copywriting & Vendas.md",
    ],
    obsidianOutputNotePath: "04_Campanhas/Lançamento Planners 2026.md",
    summary: "Campanha focada em quebrar a objeção de lote mínimo e destacar acabamento de luxo.",
    strategy: "Tração com vídeos curtos de acabamento físico + retargeting de catálogo via e-mail.",
    startDate: "2026-08-25",
    endDate: "2026-09-30",
    createdDate: "2026-08-25",
  },
];

export const DEFAULT_TASKS: MarketingTask[] = [
  {
    id: "task-1",
    title: "Gravar Reels ASMR de prensagem de Wire-o para a Linha Planners",
    description: "Capturar em 4K no galpão com iluminação suave o fechamento do wire-o e o toque da capa Soft Touch.",
    channel: "Instagram",
    priority: "high",
    status: "todo",
    dueDate: "2026-08-28",
    dueTime: "14:00",
    reminderDate: "2026-08-28",
    reminderTime: "11:00",
    obsidianTaskString: "- [ ] Gravar Reels ASMR de prensagem de Wire-o 📅 2026-08-28 ⏰ 14:00 #marketing #video",
    obsidianFilePath: "04_Campanhas/Lançamento Planners 2026.md",
    tags: ["marketing", "video", "reels", "nisti-print"],
    isReminderActive: true,
  },
  {
    id: "task-2",
    title: "Revisar notas em 00_Inbox e classificar novos briefings",
    description: "Passar pela triagem do Curador do Obsidian para validar se notas atendem o status OFICIAL.",
    channel: "Interno",
    priority: "medium",
    status: "todo",
    dueDate: "2026-08-27",
    dueTime: "17:00",
    obsidianTaskString: "- [ ] Revisar notas em 00_Inbox e classificar novos briefings 📅 2026-08-27 #pkm #curadoria",
    obsidianFilePath: "00_Inbox/Rascunho - Ideias Parceria com Escolas e Igrejas.md",
    tags: ["pkm", "curadoria", "obsidian"],
    isReminderActive: false,
  },
];

export const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: "rule-1",
    name: "Sincronização de Campanhas no Obsidian",
    description: "Cria nota Markdown com Frontmatter estruturado na pasta 04_Campanhas ao gerar um novo plano.",
    trigger: "on_campaign_created",
    action: "push_to_obsidian_api",
    enabled: true,
    executionCount: 14,
    lastRun: "2026-08-25 11:30",
  },
  {
    id: "rule-2",
    name: "Triagem de Inbox para Notas Oficiais",
    description: "Alerta o gestor quando uma nota em 00_Inbox ultrapassa 3 dias sem aprovação humana.",
    trigger: "daily_schedule",
    action: "generate_status_report",
    enabled: true,
    executionCount: 28,
    lastRun: "2026-08-26 06:00",
  },
];

export const DEFAULT_AUTOMATION_RULES = DEFAULT_AUTOMATIONS;

export const DEFAULT_IDEAS: IdeaItem[] = [
  {
    id: "idea-1",
    title: "Série em Vídeo: Como Montar um Planner Autoral do Zero",
    category: "video",
    impact: "alto",
    status: "em-producao",
    targetPersona: "Mariana (Empreendedora de Papelaria)",
    hook: "Você não precisa comprar 1000 planners da China para ter sua própria marca.",
    sourceNoteTitle: "Catálogo - Planners & Devocionais 2026",
    tags: ["papelaria", "planners", "reels"],
    estimatedReach: "15k - 25k visualizações",
  },
  {
    id: "idea-2",
    title: "Guia PDF Gratuito: Como Igrejas e Ministérios Podem Criar Devocionais Personalizados",
    category: "lead-magnet",
    impact: "estrategico",
    status: "ideia",
    targetPersona: "Pastor Lucas (Líder Eclesiástico)",
    hook: "Fortaleça a identidade da sua comunidade com devocionais anuais de alta qualidade.",
    sourceNoteTitle: "Persona - Líder Eclesiástico Pastor Lucas",
    tags: ["igrejas", "devocionais", "b2b"],
    estimatedReach: "500 downloads qualificados",
  },
];

export const DEFAULT_SCRIPTS: CreativeScript[] = [
  {
    id: "script-1",
    title: "Reels ASMR: O Toque do Soft Touch",
    type: "video_reels",
    durationOrSlides: "30 segundos",
    objective: "Sensibilização e quebra de objeção sobre qualidade de acabamento",
    targetAudience: "Empreendedoras e designers de papelaria",
    hookScene: "Close em 4K na mão passando sobre a capa aveludada com áudio estéreo nítido.",
    bodyScenes: [
      {
        step: "Cena 1",
        visualCues: "Abertura suave do wire-o bronze e folheamento do miolo 90g com caneta tinteiro.",
        audioOrNarration: "Som natural do papel encorpado sem nenhum vazamento para o verso.",
      },
      {
        step: "Cena 2",
        visualCues: "Exibição do pacote de 10 unidades embaladas com cuidado.",
        audioOrNarration: "Tiragens a partir de 10 unidades com acabamento de grande editora.",
      },
    ],
    callToAction: "Comente 'PLANNER2026' para receber o catálogo e tabela de atacado no direct.",
    tags: ["asmr", "reels", "planners", "nisti-print"],
  },
];

export const DEFAULT_VISUALS: VisualAsset[] = [
  {
    id: "visual-1",
    title: "Mockup Planners 2026 Wire-o Bronze",
    channel: "Instagram Feed",
    format: "1:1 Feed",
    aspectRatio: "1:1",
    promptVisual: "Fotografia profissional de produto, planner capa dura azul marinho com wire-o bronze...",
    headlineOverlay: "Sua marca com acabamento de livraria. A partir de 10 unidades.",
    colorPalette: ["#1e293b", "#d97706", "#f8fafc"],
    tags: ["mockup", "feed", "planners"],
  },
];
