# Nisti Marketing — Baseline de Arquitetura v1

Status: **baseline para implementação das decisões já aprovadas**.

Data: 31/08/2026

## 1. Objetivo

Este documento separa o que já existe no produto, o que foi aprovado para a próxima evolução e o que continua pendente de decisão. Ele evita que arquiteturas históricas incompatíveis voltem a ser tratadas como requisitos simultâneos.

A especificação detalhada aprovada para conexão de IA e Vault permanece registrada em `docs/AI_VAULT_APPROVED_ARCHITECTURE.md` na linha documental histórica. Esta baseline consolida a direção vigente para a `main` após a estabilização 2.2.1.

## 2. Estado do produto

### Código

- `main`: código estabilizado em versão `2.2.1`.
- arquitetura de runtime: Electron + React/Vite + backend local Node/Express.
- conhecimento: Obsidian/Vault local e índice local.
- estado operacional determinístico: armazenamento local e SQLite conforme o domínio.
- credenciais: armazenamento seguro do Electron; credenciais não pertencem ao estado normal do React, Markdown ou backup.

### Distribuição

- última release pública estável no momento desta baseline: `v2.2.0`.
- `2.2.1` está integrada ao código, mas não deve ser tratada como publicada até existir decisão explícita de release e release correspondente no GitHub.

## 3. Decisões aprovadas que passam a orientar novas implementações

### 3.1 Base e conhecimento

- Obsidian/Vault é a base documental central do conhecimento.
- o desktop usa acesso direto ao sistema de arquivos como via principal; REST API do Obsidian é opcional.
- informação deve preservar fonte e rastreabilidade.
- estado operacional e confiabilidade da informação são conceitos independentes.
- a Base Inicial continua sendo pré-condição do fluxo principal.
- informações da Base são classificadas como `CONFIRMADO`, `HIPÓTESE` ou `PENDENTE`; IA não promove hipótese para fato.

### 3.2 Conexão de IA

- somente **uma conexão de IA pode ficar ativa por vez**;
- uma conexão ativa representa uma chave, um provedor confirmado e um modelo confirmado;
- OpenAI e Gemini são os primeiros adaptadores suportados;
- não haverá fallback automático entre provedores;
- uma chave não pode ser enviada exploratoriamente a múltiplos provedores;
- identificação por formato é hipótese local, não confirmação;
- confirmação da credencial ocorre somente contra o provedor escolhido/identificado com segurança;
- modelos permanecem indisponíveis para escolha antes da confirmação da chave;
- troca de chave invalida provedor, modelo, capacidades e validações anteriores;
- troca apenas de modelo preserva a chave confirmada, mas exige novo teste do modelo;
- credencial persistida deve permanecer em armazenamento seguro e ser referenciada internamente por identificador de conexão, não propagada pelo aplicativo como string bruta.

### 3.3 Operação da IA

Fluxo obrigatório para operações assistidas por IA:

`Solicitação → Pré-condições → Recuperação de contexto → Proteção → Geração → Validação → Revisão → Persistência confirmada`

A IA:

- recebe somente o contexto necessário;
- gera propostas em schema controlado;
- não oficializa conhecimento sozinha;
- não inventa datas, prioridades, orçamento, métricas, resultados ou lembretes;
- não publica nem conclui tarefas autonomamente;
- falha de modo seguro: resposta inválida ou indisponibilidade não cria persistência artificial.

### 3.4 Vault dedicado

A evolução aprovada prevê a estrutura canônica:

- `00_Base`
- `00_Inbox`
- `01_Estrategia`
- `02_Produtos`
- `03_Conteudos`
- `04_Campanhas`
- `05_Reunioes`
- `06_Influenciadores_UGC`
- `07_Pesquisas`
- `08_Aprendizados`
- `99_Templates`

O diretório `.nisti` guarda manifesto gerenciado. O índice SQLite permanece fora do Vault.

O schema comum das notas gerenciadas deve evoluir para:

- `id`
- `type`
- `workflow_status`
- `epistemic_status`
- `created_at`
- `updated_at`
- `source_ids`
- `tags`
- `schema_version`
- `owner`

`workflow_status` e `epistemic_status` não podem promover um ao outro implicitamente.

### 3.5 Curadoria, watcher e memória

Estão aprovadas como direção:

- curadoria de novas fontes preservando o original;
- hash e rastreabilidade para evitar duplicação;
- conteúdo derivado começando como `PENDENTE` ou `HIPÓTESE`;
- watcher local enquanto o aplicativo estiver aberto;
- reconciliação incremental para recuperar eventos perdidos;
- botão manual de sincronização apenas como diagnóstico/recuperação excepcional;
- memória criativa comparando histórico acessível e bloqueando repetição não intencional;
- reaproveitamento de conteúdo apenas quando solicitado explicitamente e marcado como derivado.

## 4. Persistência por responsabilidade

| Componente | Responsabilidade vigente |
|---|---|
| Obsidian / Markdown | Conhecimento, fontes, Base, conteúdo documental e aprendizados |
| SQLite / estado local determinístico | Calendário e estados operacionais que não devem depender de interpretação da IA |
| Electron `safeStorage` | Credencial da conexão de IA e outros segredos autorizados |
| Índice local | Busca, recuperação de trechos, detecção de mudança/duplicidade e memória criativa |
| Auditoria | Fontes, modelo, horário, ação e resultado; nunca a chave bruta |

Nenhum componente deve ser transformado em segunda fonte de verdade sem ADR específico.

## 5. Arquiteturas históricas classificadas

### Substituídas como arquitetura principal

- Next.js como runtime principal do produto;
- PostgreSQL/Supabase/RLS como persistência central do produto local;
- plugin próprio `Nisti Knowledge` como requisito obrigatório para leitura/escrita do Vault;
- múltiplas IAs simultaneamente ativas;
- fallback automático entre provedores;
- AI Gateway remoto obrigatório para a operação local.

### Mantidas apenas quando úteis como integração opcional

- Google Drive pode continuar como integração auxiliar de arquivos; não é a base canônica do conhecimento.
- REST API do Obsidian pode continuar disponível como integração opcional; acesso local ao Vault é a via principal no desktop.

A remoção física de código legado deve ocorrer por PRs controlados, sem confundir descontinuação arquitetural com deleção imediata de compatibilidade.

## 6. Itens que NÃO estão aprovados para implementação

### Chat fundamentado no Vault

Arquitetura detalhada existe, porém a decisão final permanece **pendente**. Não iniciar implementação do chat como requisito desta baseline.

### Camada completa de entendimento de linguagem natural

A necessidade foi reconhecida, mas o desenho consolidado permanece **pendente de aprovação formal**. Não acoplar esta camada à Etapa 1.

### IA totalmente local

Permanece evolução futura. Enquanto OpenAI/Gemini forem usados, trechos selecionados do contexto podem sair do computador para o provedor externo conforme a operação autorizada.

## 7. Ordem de implementação vigente

1. contratos e migração da configuração de IA;
2. análise local de chave e descoberta segura de modelos;
3. orquestrador de conexão única e fluxo de troca;
4. interface e homologação dos provedores iniciais;
5. manifesto único do Vault;
6. bootstrap de pastas e templates;
7. consolidação de leitura e escrita;
8. auditoria, reparo e homologação ponta a ponta;
9. curadoria automática e detecção contínua;
10. chat fundamentado no Vault somente após aprovação explícita.

Cada etapa deve sair em PR independente. Uma etapa dependente não deve começar antes de a anterior estar tecnicamente fechada.

## 8. Restrições da Etapa 1

A Etapa 1 é deliberadamente estreita. Ela deve:

- introduzir contratos de domínio para uma conexão única;
- definir estados válidos da conexão;
- definir persistência sem chave bruta no estado comum;
- mapear/migrar metadados legados sem apagar credenciais antes de todos os consumidores estarem migrados;
- manter compatibilidade temporária suficiente para não quebrar a versão atual durante a migração;
- possuir testes de migração idempotente e fail-closed.

Ela **não deve** ainda:

- tentar chaves em provedores externos;
- implementar descoberta de modelos;
- trocar automaticamente de provedor;
- redesenhar a tela completa de Configuração;
- iniciar Chat no Vault;
- iniciar o novo manifesto do Vault.

## 9. Gates antes de qualquer release da nova arquitetura

- TypeScript verde;
- testes de domínio e migração verdes;
- nenhum segredo em config comum, logs, Markdown ou backup;
- migração idempotente;
- dados legados não destruídos antes da conclusão da transição;
- Windows runtime verde;
- atualização a partir da release estável anterior validada pelo pipeline;
- decisão explícita de publicação.

## 10. Changelog

### v1.0 — 31/08/2026

- consolida a arquitetura local-first vigente;
- registra formalmente conexão única de IA como substituta de múltiplas conexões/fallback;
- registra Vault direto + SQLite + `safeStorage` como separação de responsabilidades;
- classifica arquiteturas históricas incompatíveis;
- preserva Chat no Vault e linguagem natural como decisões pendentes;
- define limites objetivos para iniciar a Etapa 1.
