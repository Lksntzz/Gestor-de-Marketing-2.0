# Auditoria de Produto — Planejamento e Execução

Este documento complementa `docs/PRODUCT_AUDIT.md` e registra a auditoria de **Calendário Editorial**, **Quadro de Tarefas** e **Inteligência de Rotinas**.

Classificações: **MANTER**, **SIMPLIFICAR**, **MESCLAR**, **MOVER PARA AVANÇADO**, **REMOVER**.

## Conclusão executiva

A maior sobreposição do Nisti Marketing está neste bloco. Hoje existem três representações parcialmente concorrentes do trabalho semanal:

- `EditorialItem` no Calendário Editorial;
- `MarketingTask` no Quadro de Tarefas;
- `DailyRoutineSlot` em Inteligência de Rotinas.

O Calendário deve ser a fonte de verdade para **o que será publicado e quando**. Tarefas devem representar **ações necessárias para executar o plano**. `DailyRoutineSlot` não deve continuar como uma terceira agenda semanal paralela.

Direção recomendada:

`conteúdo aprovado → calendário → tarefas derivadas/relacionadas → publicação → resultado → aprendizado`

## 1. Calendário Editorial

### Decisão

**MANTER como núcleo do planejamento semanal**, com simplificação do fluxo.

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Visão semanal por dia | MANTER | Responde diretamente quando cada conteúdo será publicado. |
| Status editorial | MANTER | DRAFT, IN_PRODUCTION, REVIEW, APPROVED, SCHEDULED, PUBLISHED e ARCHIVED modelam o ciclo editorial de forma suficiente. |
| Criar/editar conteúdo no calendário | MANTER | É ação legítima de planejamento, desde que datas e decisões não sejam inventadas. |
| `Planejar Semana com IA` | SIMPLIFICAR | Deve gerar uma **prévia de sugestões** e exigir aprovação antes de persistir itens no calendário. |
| Quantidade/plataformas/formatos/objetivos digitados toda semana | MESCLAR COM BASE/BRIEFING | Preferências recorrentes devem vir da Base Inicial e das campanhas, com possibilidade de exceção. |
| Novo conteúdo iniciado com data de hoje, Instagram e Engajamento | REMOVER defaults decisórios | Esses valores representam decisões de marketing. O sistema não deve registrá-los como fato sem escolha explícita. |
| Criar tarefa automaticamente ao salvar item agendado | MANTER como projeção vinculada | É útil, mas precisa de vínculo consistente e ciclo de vida sincronizado. |

### Problemas de consistência encontrados

- Ao salvar um item editorial com `scheduledDate`, o sistema cria automaticamente uma tarefa `Publicar: <título>`.
- Ao excluir o item editorial, o código exclui o `EditorialItem`, mas não remove a tarefa derivada.
- Se a data editorial for removida posteriormente, a tarefa derivada também não é removida.
- Marcar o item como `PUBLISHED` não conclui automaticamente a tarefa vinculada.
- Portanto, Calendário e Execução podem divergir e deixar tarefas órfãs.

A correção recomendada é tratar a tarefa de publicação como **projeção vinculada** ao `EditorialItem`, com `editorialItemId` explícito e reconciliação idempotente. Uma decisão editorial deve atualizar sua projeção operacional; não criar dois registros independentes que possam divergir.

### Problema do planejamento por IA

O fluxo atual persiste cada sugestão retornada pela IA diretamente como `DRAFT` no banco editorial. Mesmo como rascunho, isso transforma uma sugestão em agenda registrada antes de revisão humana.

Fluxo alvo:

`Planejar semana → receber sugestões → revisar dias/formatos/plataformas → aprovar selecionadas → gravar calendário`

## 2. Quadro de Tarefas / Execução

### Decisão

**MANTER**, porque tarefas representam trabalho operacional real que não é igual a conteúdo editorial.

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Lista de tarefas | MANTER | É a visão mais direta da execução. |
| A fazer / Em andamento / Concluída | MANTER | Estados operacionais simples e suficientes. |
| Kanban | MOVER PARA AVANÇADO ou remover inicialmente | Para um gestor local/individual, é uma segunda visualização da mesma lista. Só se justifica se houver uso recorrente. |
| Vencidas / Hoje / Em andamento / Lembretes em quatro cards | SIMPLIFICAR | Transformar em filtros compactos, não em painel de métricas. |
| Busca e filtros | MANTER | Úteis quando a lista crescer. |
| Detalhe da tarefa selecionada | MANTER | Permite executar sem inflar a lista. |
| “Próxima ação” dentro de Execução | MESCLAR COM DASHBOARD | O Dashboard já deve ser o único lugar que decide “o que fazer agora”. Execução deve mostrar a tarefa selecionada/detalhes, não competir com outra inteligência de prioridade. |
| Adiar para amanhã | MANTER | Ação operacional clara e explícita. |
| Lembretes | MANTER, mas secundário | Úteis quando configurados explicitamente. |
| Copiar Markdown / abrir fonte | MOVER PARA AÇÕES SECUNDÁRIAS | São integrações úteis, mas não precisam competir com concluir/iniciar/adiar. |
| Sincronizar Daily Note | MOVER PARA AVANÇADO / automático | É operação de infraestrutura. |
| Status técnico do Obsidian e última sync | MOVER PARA DIAGNÓSTICO | Mostrar falha quando houver; estado saudável deve ficar silencioso. |

### Acoplamento desnecessário com Obsidian

A tela desabilita `Nova tarefa` quando o Obsidian está desconectado, porém o próprio `TaskModal` apenas monta um `MarketingTask` e chama `onSaveTask`; ele não depende de uma conexão Obsidian para criar o objeto local.

Isso cria um bloqueio de produto sem necessidade técnica aparente. O usuário deve poder registrar e executar tarefas localmente. A sincronização com Obsidian pode ocorrer depois ou permanecer opcional.

## 3. Inteligência de Rotinas

### Decisão

**REMOVER como tela independente e redistribuir apenas as capacidades únicas.**

A tela atualmente contém:

- “O que fazer agora”;
- contagem de tarefas abertas/vencidas;
- campanhas abertas;
- quantidade de conhecimento confirmado;
- pautas da semana;
- tarefas de hoje/semana;
- revisões de conhecimento;
- resultados agregados;
- aprendizados;
- atalho para revisão de conhecimento;
- status de Obsidian/motor;
- sincronização semanal.

Quase todos esses elementos já pertencem a outras áreas.

| Elemento de Rotinas | Destino recomendado |
|---|---|
| “O que fazer agora” | Dashboard |
| Tarefas abertas/vencidas/hoje | Execução |
| Campanhas abertas | Campanhas |
| Base confirmada / revisão de conhecimento | Cofre |
| Pautas semanais | Calendário Editorial |
| Resultados registrados | Resultados |
| Aprendizados | **MANTER**, mover para Resultados/Aprendizados |
| Status de motor/Obsidian/sync | Configurações/Diagnóstico |
| Sincronizar semana | infraestrutura/ação secundária |

### Duplicação estrutural mais crítica

`DailyRoutineSlot` possui sua própria agenda e status (`planejando`, `em-producao`, `agendado`, `publicado`) enquanto `EditorialItem` possui outra agenda e outra máquina de estados (`DRAFT`, `IN_PRODUCTION`, `REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`).

Manter as duas significa que o mesmo conteúdo pode estar “agendado” em Rotinas e “DRAFT” no Calendário, ou “publicado” em uma tela e pendente na outra.

Recomendação: migrar qualquer pauta útil de `DailyRoutineSlot` para `EditorialItem` e aposentar `weeklyRoutine` como agenda operacional.

### Nichos e gatilhos emocionais

A criação de pauta em Rotinas exige tema, dia, formato, nicho e gatilho emocional. Isso é modelagem excessiva para uma ação simples de planejamento e pode impedir o usuário de registrar uma pauta válida quando essas classificações não forem relevantes.

Nicho, emoção, hook e padrões podem continuar como **metadados opcionais de análise** ou vir do briefing/conhecimento, mas não devem ser pré-requisitos para colocar um conteúdo no calendário.

## 4. Aprendizados

Esta é a capacidade realmente diferenciada dentro de Rotinas e deve ser preservada.

O fluxo atual exige título, regra, evidência e ação antes de salvar um aprendizado. Essa disciplina é boa porque impede “insights” sem base.

Destino recomendado:

`Resultado registrado → analisar evidência → sugerir aprendizado → revisão humana → salvar aprendizado → reutilizar em futuros briefings`

A área pode se chamar **Aprendizados** dentro de Resultados, e cada aprendizado deve manter vínculo com sua evidência/campanha/publicação quando possível.

## 5. Automação dentro de Execução

`TasksAutomationView` também contém uma terceira aba `Automações`, apesar de Automações já existir como área própria na navegação principal. Isso é duplicação de arquitetura de informação.

A auditoria específica de Automações será feita separadamente, mas a decisão preliminar é: **Automações não deve ser uma aba do Quadro de Tarefas e uma área principal ao mesmo tempo**.

## Arquitetura alvo deste bloco

### Planejamento

**Calendário Editorial** como única agenda de conteúdo:

- conteúdo;
- data/hora escolhidas;
- plataforma;
- formato;
- status editorial;
- campanha opcional;
- vínculo com ideia/roteiro aprovado.

### Execução

**Tarefas** como lista de ações reais:

- produzir arte;
- revisar texto;
- aprovar peça;
- publicar conteúdo;
- responder cliente;
- medir resultado;
- outras ações manuais.

Tarefas derivadas de conteúdo devem manter vínculo explícito com o item editorial.

### Aprendizado

**Resultados + Aprendizados** fecham o ciclo após publicação.

## Decisão desta área

- **Calendário Editorial:** MANTER como fonte de verdade da agenda e simplificar.
- **Quadro de Tarefas:** MANTER como execução; lista como caminho principal e Kanban opcional/avançado.
- **Inteligência de Rotinas:** REMOVER como tela independente e distribuir suas funções.
- **WeeklyRoutine/DailyRoutineSlot:** aposentar como agenda operacional depois de migração.
- **Aprendizados:** MANTER e mover para Resultados.
- **Sincronizações/status técnicos:** MOVER PARA AVANÇADO/DIAGNÓSTICO.
- **Próxima ação:** existir uma única vez no Dashboard.
