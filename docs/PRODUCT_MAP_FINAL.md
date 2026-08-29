# Mapa Final de Produto — Nisti Marketing

Este documento consolida a auditoria de produto do Nisti Marketing e define a arquitetura de telas alvo antes da refatoração.

Princípio central: **cada tela deve representar uma responsabilidade clara do fluxo de marketing**. Informações técnicas, sincronizações e mecanismos de infraestrutura não devem competir com tarefas de marketing no fluxo principal.

## 1. Arquitetura alvo

A navegação recomendada é:

1. **Início** — próxima ação, semana e bloqueios.
2. **Base** — Cofre de Conhecimento + adicionar fonte.
3. **Criar** — briefing, ideias, desenvolvimento de conteúdo/roteiro e aprovação.
4. **Planejar** — campanhas + calendário editorial.
5. **Executar** — tarefas operacionais.
6. **Aprender** — resultados + aprendizados.
7. **Configurações** — IA, Obsidian, sincronização, diagnóstico e recursos avançados.

Fluxo principal:

`Base → Briefing → Ideias → Conteúdo → Campanha/Calendário → Tarefas → Publicação → Resultado → Aprendizado`

## 2. Mapa tela atual → arquitetura nova

| Tela/área atual | Destino novo | Decisão | O que migra | O que sai do fluxo principal |
|---|---|---|---|---|
| Dashboard / Início | **Início** | SIMPLIFICAR | Próxima ação, pendências da semana, bloqueios reais | métricas técnicas, atalhos duplicados, contagens acumuladas, motor IA/local, sync permanente |
| Explorador Obsidian / Vault | **Base / Cofre** | MANTER + SIMPLIFICAR | busca, fontes, síntese, evidências, estado epistemológico, abrir no Obsidian | editor Markdown como caminho principal, inventário técnico em destaque |
| Adicionar Conhecimento | **Base / Cofre → Adicionar fonte** | MESCLAR | ingestão, análise, revisão humana, salvar no Vault | tela própria; seis tipos técnicos de entrada; Google Drive no fluxo principal |
| Ideias | **Criar** | MANTER | geração fundamentada de ideias | ferramenta isolada |
| Roteiros | **Criar** | MESCLAR | desenvolver ideia aprovada em roteiro/peça | redigitação da ideia e plataforma/formato hardcoded |
| Campanhas | **Planejar** | MANTER + SIMPLIFICAR | objetivo, campanha, contexto, canais, fontes, aprovação | wizard pesado, engine selector, detalhes de runtime em destaque |
| Resultados | **Aprender** | MANTER + SIMPLIFICAR | resultado real, evidência, métricas disponíveis | obrigatoriedade de todas as métricas, score subjetivo obrigatório |
| Calendário Editorial | **Planejar** | MANTER | agenda editorial, datas, plataforma, formato, status, vínculo com campanha/conteúdo | defaults decisórios e persistência automática de sugestões sem revisão |
| Quadro de Tarefas | **Executar** | MANTER + SIMPLIFICAR | lista, status, prazo, prioridade, lembrete, vínculo com conteúdo/campanha | próxima ação duplicada, cards excessivos, sync/estado técnico em destaque |
| Kanban | **Executar → Avançado** | MOVER PARA AVANÇADO | visão alternativa se realmente usada | destaque equivalente à lista |
| Inteligência de Rotinas | distribuir entre áreas | REMOVER como tela | aprendizados → Aprender; pautas → Calendário; revisões → Base | dashboard paralelo, segunda agenda semanal, métricas repetidas, status técnico |
| WeeklyRoutine / DailyRoutineSlot | migrar para EditorialItem | APOSENTAR | pautas úteis e seus dados explicitamente registrados | máquina de estados e agenda paralelas |
| Automações | **Configurações/Avançado** ou oculto | REMOVER como módulo principal | runtime seguro, logs, validação, ações administrativas | item da Sidebar, aba duplicada, linguagem de gatilho/agendamento sem executor real |
| Sincronização / status Obsidian | **Configurações / Diagnóstico** | CENTRALIZAR | status, último sync, ações manuais, logs | repetição em Dashboard, Rotinas, Execução, Campanhas e Cofre |
| Motor Local / IA | **Configurações** | CENTRALIZAR | escolha de provider/modelo e diagnóstico | alternância em telas de marketing |

## 3. Responsabilidade de cada tela nova

### Início

Deve responder somente:

- o que preciso fazer agora;
- o que está pendente nesta semana;
- existe algum bloqueio real.

Não deve ser painel de administração técnica.

### Base

Responsabilidade: **encontrar, revisar e adicionar conhecimento confiável**.

Ações principais:

- pesquisar;
- consultar fonte;
- revisar `CONFIRMADO / HIPÓTESE / PENDENTE`;
- adicionar arquivo, link ou texto;
- abrir original no Obsidian;
- usar fonte como contexto para criação.

### Criar

Responsabilidade: **transformar briefing e conhecimento em conteúdo aprovado**.

Fluxo:

`Briefing → Ideias → Escolher → Desenvolver → Aprovar`

Uma ideia aprovada deve manter identidade e contexto ao virar roteiro/carrossel/peça.

### Planejar

Responsabilidade: **decidir o que será feito/publicado e quando**.

Duas entidades principais:

- campanha como contexto estratégico;
- `EditorialItem` como unidade de agenda.

O calendário é a única fonte de verdade para data/hora/status editorial.

### Executar

Responsabilidade: **mostrar ações reais que precisam ser concluídas**.

Tarefas podem ser manuais ou derivadas de um item editorial, mas devem manter vínculo explícito. A exclusão/alteração de um conteúdo precisa reconciliar sua tarefa derivada.

### Aprender

Responsabilidade: **registrar evidência e transformar resultado em aprendizado**.

Fluxo:

`Publicação → Resultado → Evidência → Aprendizado → reutilização em briefing`

Ausência de métrica deve permanecer `não medida`, nunca virar zero automaticamente.

### Configurações

Responsabilidade: tudo que é técnico e administrativo:

- Obsidian;
- provedor/modelo de IA;
- secrets;
- sincronização;
- diagnóstico;
- logs;
- atualização do aplicativo;
- recursos avançados.

## 4. Modelo de dados alvo

Não fazer migração destrutiva de uma vez.

### Manter

- `ObsidianNote`
- `MarketingCampaign`
- `MarketingTask`
- `EditorialItem`
- `IdeaItem` / modelo criativo equivalente
- `CreativeScript` / conteúdo desenvolvido
- `PostHistoryItem` ou sucessor para resultados
- `LearningInsight`

### Aposentar gradualmente

- `DailyRoutineSlot` como agenda operacional;
- `weeklyRoutine` como fonte de verdade;
- `AutomationRule` como recurso de produto principal, mantendo compatibilidade enquanto necessário para dados existentes.

### Adicionar vínculos explícitos

Prioridade arquitetural:

- `MarketingTask.editorialItemId?`
- `EditorialItem.campaignId?`
- `EditorialItem.ideaId?`
- `EditorialItem.scriptId?` ou `contentId?`
- resultado vinculado a `editorialItemId` quando possível;
- aprendizado vinculado a resultado/campanha/publicação quando possível.

Evitar inferir relacionamentos por título ou nome de arquivo.

## 5. Regras que a refatoração não pode quebrar

1. O Vault/Obsidian continua sendo a fonte documental de verdade.
2. `CONFIRMADO / HIPÓTESE / PENDENTE` deve continuar explícito.
3. IA não transforma ausência de informação em fato.
4. Nenhuma data, horário, métrica, prioridade ou lembrete deve ser inventado para parecer que o fluxo está completo.
5. Sugestão de IA deve ser revisada antes de virar planejamento persistente.
6. Escrita no Vault deve continuar rastreável e confirmada.
7. Tarefas locais devem funcionar mesmo sem conexão Obsidian; sincronização é uma integração, não pré-requisito para registrar trabalho.
8. Resultado ausente deve permanecer ausente; não normalizar automaticamente para zero.
9. Atualizador/instalador validado não deve ser alterado durante esta refatoração de produto sem necessidade.

## 6. Ordem segura de refatoração

A refatoração deve ocorrer por fases para não misturar mudança visual com migração de estado.

### Fase 0 — proteção

Antes de remover telas:

- adicionar/ajustar testes dos fluxos que serão preservados;
- garantir export/backup dos estados persistidos;
- registrar migração de `weeklyRoutine` e regras antigas;
- manter CI verde.

### Fase 1 — navegação e limpeza sem perda de dados

- criar a nova arquitetura de navegação;
- remover Automações e Rotinas da Sidebar, inicialmente sem apagar seus dados;
- retirar `Adicionar Conhecimento` como subaba independente e abrir ingestão pelo Cofre;
- remover duplicações visuais de status técnico;
- manter rotas/compatibilidade interna temporária para dados antigos.

**Objetivo:** reduzir complexidade percebida sem migrar o domínio inteiro no mesmo commit.

### Fase 2 — Base / Cofre

- unificar `VaultView` + ingestão;
- consolidar Nova Nota/Text Livre em uma única entrada;
- mover diagnóstico de sync para Configurações;
- preparar a Base Inicial/Onboarding para alimentar o Cofre.

### Fase 3 — Criar

- transformar Ideias/Roteiros em fluxo contínuo;
- preservar ID/contexto ao promover ideia para conteúdo;
- corrigir plataforma/formato hardcoded;
- impedir envio ao calendário sem decisão explícita de data.

### Fase 4 — Planejar

- simplificar Campanhas;
- consolidar calendário como agenda única;
- mudar `Planejar Semana` para `sugerir → revisar → aprovar → persistir`;
- migrar pautas úteis de `weeklyRoutine` para `EditorialItem`.

### Fase 5 — vínculo Calendário ↔ Tarefas

- adicionar `editorialItemId` a tarefas derivadas;
- implementar reconciliação idempotente;
- atualizar data/título/status de tarefa a partir da decisão editorial;
- remover tarefa derivada quando o vínculo deixar de existir, seguindo regra definida;
- marcar/concluir de modo consistente quando conteúdo for publicado.

Esta fase deve ter testes específicos para evitar tarefas órfãs.

### Fase 6 — Executar

- simplificar lista de tarefas;
- liberar criação local offline;
- mover Kanban para modo secundário/avançado;
- remover aba Automações de `TasksAutomationView`;
- remover handlers legados de automação do `App.tsx`.

### Fase 7 — Aprender

- mover Aprendizados para Resultados;
- tornar métricas opcionais por disponibilidade;
- distinguir `não medido` de `0`;
- corrigir agregações e CTR;
- vincular aprendizado à evidência.

### Fase 8 — Configurações / Diagnóstico

- centralizar engine mode, provider, Obsidian, sync, logs e ações administrativas;
- preservar runtime seguro de automação como infraestrutura interna;
- ocultar conceitos de trigger/agendamento até existir executor automático real.

### Fase 9 — Onboarding da Base Inicial

Somente depois que Base/Cofre e navegação estiverem estabilizados:

- iniciar com Vault vazio;
- perguntas guiadas;
- gerar Markdown estruturado;
- classificar `CONFIRMADO / HIPÓTESE / PENDENTE`;
- usar essa base para briefings, criação e campanhas.

## 7. Itens de dívida técnica que devem entrar na refatoração

- handlers legados de automação em `App.tsx` com defaults/hardcodes;
- props/callbacks mortos em componentes;
- bloqueios de UI por Obsidian onde a operação é local;
- duas representações divergentes de uma mesma ideia/conteúdo;
- tarefa editorial sem vínculo explícito;
- defaults de calendário que assumem hoje/Instagram/Engajamento;
- planejamento por IA persistindo sugestões antes de revisão;
- médias de CTR sem ponderação/contexto;
- ausência de métrica sendo interpretada como zero;
- repetição de status de Obsidian/engine/sync em múltiplas telas.

## 8. Critério de aceite da refatoração

A nova versão deve permitir que um usuário percorra o fluxo sem precisar entender a arquitetura interna:

1. consultar/adicionar conhecimento;
2. criar um briefing;
3. gerar e aprovar uma ideia/conteúdo;
4. associar a campanha se necessário;
5. escolher data no calendário;
6. executar tarefas;
7. registrar resultado real;
8. salvar aprendizado.

Nenhuma dessas etapas deve exigir escolher motor de IA, rodar uma automação manual, sincronizar tecnicamente o Vault ou navegar por uma segunda agenda semanal.

## 9. Resultado esperado

O Nisti Marketing deixa de ser um conjunto de módulos independentes e passa a funcionar como um **fluxo operacional de marketing local**.

A redução de telas não significa redução de capacidade. Funções técnicas úteis continuam existindo, mas no nível correto da arquitetura: infraestrutura e diagnóstico ficam atrás do produto, enquanto o usuário trabalha com Base, Criar, Planejar, Executar e Aprender.
