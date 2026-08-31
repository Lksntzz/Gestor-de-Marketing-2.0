import { VAULT_SCHEMA_VERSION, VaultManifestTemplateSchema } from "../../domain/vaultManifest";
import { serializeCanonicalFrontmatter } from "./CanonicalKnowledgeWriter";

export interface VaultTemplateDefinition {
  id: string;
  filename: string;
  title: string;
  type: string;
  targetFolder: string;
  version: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export const OFFICIAL_VAULT_TEMPLATES: VaultTemplateDefinition[] = [
  {
    id: "tpl_inbox_capture",
    filename: "TPL_Inbox_Captura.md",
    title: "Template - Captura Inbox",
    type: "inbox_capture",
    targetFolder: "00_Inbox",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "inbox_capture",
      workflow_status: "NOVO",
      epistemic_status: "raw_capture",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["inbox", "rascunho", "captura"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 📥 Registro de Entrada
- **Data de Captura:** {{date}}
- **Origem / Canal:** 
- **Contexto Rápido:** 

## 📝 Notas & Transcrição Bruta
<!-- Insira aqui o pensamento, briefing rápido, áudio transcrito ou rascunho -->

---
## 🎯 Próxima Ação & Triagem
- [ ] Revisar relevância para a marca
- [ ] Definir pasta de destino oficial (01_Estrategia a 08_Aprendizados)
`,
  },
  {
    id: "tpl_strategy_guideline",
    filename: "TPL_Diretriz_Estrategica.md",
    title: "Template - Diretriz Estratégica",
    type: "strategy_guideline",
    targetFolder: "01_Estrategia",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "strategy_guideline",
      workflow_status: "OFICIAL",
      epistemic_status: "verified_truth",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["estrategia", "brand-voice", "oficial"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 🧭 Visão Geral & Propósito
- **Pilar Estratégico:** 
- **Público-Alvo / Persona:** 
- **Impacto no Posicionamento:** 

## 🎯 Regras & Diretrizes Fundamentais
1. **Regra de Ouro:** 
2. **Tom de Voz Recomendado:** 
3. **Restrições & O que Evitar:** 

## 🔗 Relações & Referências
- Documentos relacionados: 
`,
  },
  {
    id: "tpl_product_spec",
    filename: "TPL_Ficha_Produto.md",
    title: "Template - Ficha de Produto",
    type: "product_spec",
    targetFolder: "02_Produtos",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "product_spec",
      workflow_status: "OFICIAL",
      epistemic_status: "verified_truth",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["produto", "catalogo", "especificacao"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 📦 Identificação do Produto
- **Linha:** 
- **Código / SKU:** 
- **Público Principal:** 

## 🛠️ Especificações Técnicas & Acabamentos
- **Gramatura do Papel / Miolo:** 
- **Tipo de Encadernação:** 
- **Dimensões:** 
- **Diferenciais Gráficos:** 

## 💡 Argumentos de Venda & Dores Solucionadas
- **Principal Benefício:** 
- **Proposta de Valor:** 
`,
  },
  {
    id: "tpl_creative_script",
    filename: "TPL_Roteiro_Conteudo.md",
    title: "Template - Roteiro de Conteúdo",
    type: "creative_script",
    targetFolder: "03_Conteudos",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "creative_script",
      workflow_status: "EM REVISÃO",
      epistemic_status: "work_in_progress",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["conteudo", "roteiro", "copywriting"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 🎬 Metadados de Produção
- **Formato:** (Reels / Carrossel / TikTok / Story)
- **Canal de Veiculação:** 
- **Objetivo do Conteúdo:** (Atração / Retenção / Conversão)

## 🪝 Gancho Inicial (0 a 3s)
> **Hook Visual & Falado:** 

## 📜 Corpo & Desenvolvimento do Roteiro
- **Cena 1 (Problema / Tensão):** 
- **Cena 2 (Solução Nisti Print):** 
- **Cena 3 (Prova / Detalhe do Produto):** 

## 📢 Chamada para Ação (CTA)
> **CTA Final:** 
`,
  },
  {
    id: "tpl_campaign_plan",
    filename: "TPL_Plano_Campanha.md",
    title: "Template - Plano de Campanha",
    type: "campaign_plan",
    targetFolder: "04_Campanhas",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "campaign_plan",
      workflow_status: "EM REVISÃO",
      epistemic_status: "work_in_progress",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["campanha", "lancamento", "planejamento"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 🎯 Objetivo & Metas da Campanha
- **Meta Principal (KPI):** 
- **Orçamento Previsto:** 
- **Período de Execução:** 

## 🗓️ Fases & Cronograma
1. **Fase 1: Teaser / Aquecimento**
2. **Fase 2: Lançamento / Abertura**
3. **Fase 3: Sustentação & Escala**

## 📢 Canais & Peças Chave
- Instagram Ads & Orgânico
- WhatsApp VIP & E-mail Marketing
- Influenciadores / UGC
`,
  },
  {
    id: "tpl_meeting_notes",
    filename: "TPL_Ata_Reuniao.md",
    title: "Template - Ata de Reunião",
    type: "meeting_notes",
    targetFolder: "05_Reunioes",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "meeting_notes",
      workflow_status: "OFICIAL",
      epistemic_status: "verified_truth",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["reuniao", "ata", "alinhamento"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 👥 Participantes & Contexto
- **Data e Horário:** {{date}}
- **Presentes:** 
- **Pauta Principal:** 

## 📝 Tópicos Discutidos & Decisões
- 

## ✅ Plano de Ação & Responsáveis
- [ ] Tarefa 1 (Responsável: / Prazo: )
`,
  },
  {
    id: "tpl_influencer_brief",
    filename: "TPL_Briefing_Influenciador.md",
    title: "Template - Briefing Influenciador / UGC",
    type: "influencer_brief",
    targetFolder: "06_Influenciadores_UGC",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "influencer_brief",
      workflow_status: "EM REVISÃO",
      epistemic_status: "work_in_progress",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["influenciadores", "ugc", "parcerias"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 🌟 Perfil do Criador & Parceria
- **Nome / @:** 
- **Nicho / Audiência:** 
- **Formato Contratado:** (Reels / Unboxing / Stories / Carrossel)

## 📋 Diretrizes Obrigatórias do Briefing
- **Mensagem Chave:** 
- **Cupom / Link de Rastreio:** 
- **O que DEVE aparecer no vídeo:** 
- **O que NÃO pode ser dito:** 
`,
  },
  {
    id: "tpl_research_benchmark",
    filename: "TPL_Pesquisa_Benchmark.md",
    title: "Template - Pesquisa & Benchmark",
    type: "research_benchmark",
    targetFolder: "07_Pesquisas",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "research_benchmark",
      workflow_status: "OFICIAL",
      epistemic_status: "verified_truth",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["pesquisa", "benchmark", "mercado"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 🔍 Escopo da Pesquisa
- **Tema / Segmento:** 
- **Concorrentes Analisados:** 
- **Objetivo da Análise:** 

## 📊 Insights & Oportunidades Identificadas
- 

## 🚀 Recomendações de Ação para Nisti Print
- 
`,
  },
  {
    id: "tpl_learning_postmortem",
    filename: "TPL_Aprendizado_PostMortem.md",
    title: "Template - Aprendizado & Post-Mortem",
    type: "learning_postmortem",
    targetFolder: "08_Aprendizados",
    version: "2.2.0",
    frontmatter: {
      id: "{{id}}",
      type: "learning_postmortem",
      workflow_status: "OFICIAL",
      epistemic_status: "verified_truth",
      created_at: "{{created_at}}",
      updated_at: "{{updated_at}}",
      source_ids: [],
      tags: ["aprendizado", "post-mortem", "metricas"],
      schema_version: VAULT_SCHEMA_VERSION,
      owner: "Gestor de Marketing Nisti Print",
    },
    body: `# {{title}}

## 📈 Resumo da Ação / Experimento
- **Campanha / Teste:** 
- **Período:** 
- **Resultados Quantitativos (ROAS, CPC, Vendas):** 

## 🟢 O que funcionou muito bem
- 

## 🔴 O que deu errado ou abaixo do esperado
- 

## 💡 Princípio Aprendido (Regra Permanente)
- 
`,
  },
];

export function renderVaultTemplateFileContent(template: VaultTemplateDefinition): string {
  const frontmatterStr = serializeCanonicalFrontmatter(template.frontmatter);
  return `${frontmatterStr}${template.body}`;
}
