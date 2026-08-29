# Refatoração — Fase 0: Proteção de dados e compatibilidade

Este documento define o contrato de proteção que deve ser satisfeito antes da remoção, fusão ou ocultação de telas do Nisti Marketing.

## Objetivo

A refatoração de produto não pode transformar simplificação visual em perda de dados. Dados de telas que serão aposentadas precisam continuar legíveis, exportáveis e migráveis até que a migração definitiva esteja validada.

## Fontes de estado atuais

### Vault / Obsidian

Fonte documental de verdade para notas e conhecimento. Não é apagado nem reestruturado automaticamente nesta fase.

### Estado persistido do aplicativo

Chaves atuais protegidas:

- `obsidian_marketing_notes`
- `obsidian_marketing_campaigns`
- `obsidian_marketing_tasks`
- `obsidian_marketing_rules`
- `obsidian_marketing_ideas`
- `obsidian_marketing_scripts`
- `obsidian_marketing_visuals`
- `obsidian_emotional_drivers`
- `obsidian_niches`
- `obsidian_post_history`
- `obsidian_learnings`
- `obsidian_weekly_routine`
- `obsidian_engine_mode`

`nisti_fired_reminders_v1` é metadado operacional de entrega de lembretes. Não deve ser usado como fonte de verdade de negócio.

### SQLite editorial

`editorial_items` é a fonte persistente do Calendário Editorial e está incluída no backup/restauração protegidos antes das alterações estruturais do calendário.

### Segredos

Credenciais de Obsidian, Gemini e OpenAI não fazem parte de backup portátil.

Segredos continuam protegidos via `safeStorage`/armazenamento seguro e nunca devem ser serializados no arquivo de workspace.

## Formato de backup protegido

O schema de workspace suporta `formatVersion: 2` e inclui, além do backup legado de notas/campanhas/tarefas:

- regras de automação;
- ideias;
- roteiros;
- visuais;
- gatilhos emocionais;
- nichos;
- histórico de resultados;
- aprendizados;
- rotina semanal legada;
- modo de engine;
- itens editoriais;
- configuração não secreta.

### Compatibilidade

- backups legados sem `formatVersion` continuam aceitos;
- coleções ausentes em backup legado permanecem `undefined`, portanto não são transformadas em listas vazias automaticamente durante a restauração;
- formatos futuros desconhecidos são rejeitados fail-closed;
- `apiKey`, `geminiApiKey` e `openaiApiKey` são removidas;
- `connectionStatus` importado é forçado para `disconnected`;
- itens editoriais são restaurados por `upsert` durante a Fase 0, sem excluir itens locais que não existam no backup.

## Estado legado que será aposentado depois

### `weeklyRoutine` / `DailyRoutineSlot`

Não remover nesta fase.

Antes da aposentadoria:

1. preservar no backup v2;
2. definir migração para `EditorialItem`;
3. não inferir datas apenas a partir de dia da semana sem uma semana de referência escolhida;
4. não criar horário, plataforma, prioridade ou campanha ausentes;
5. validar a migração com testes e, quando houver ambiguidade, exigir revisão humana.

### `AutomationRule`

Não remover o estado persistido nesta fase, mesmo com a retirada futura da tela principal.

Antes da aposentadoria:

1. preservar regras existentes no backup;
2. remover handlers legados contraditórios somente após confirmar que o runtime seguro é o único caminho necessário;
3. manter logs/auditoria que possuam valor histórico;
4. não converter uma regra manual em automação real sem executor persistente.

## Regras de restauração

A restauração segue estes princípios:

1. validar todo o payload antes de mutar estado;
2. não importar segredos;
3. não inventar coleções ausentes em backups legados;
4. não interpretar ausência como zero, concluído, publicado ou confirmado;
5. preservar IDs existentes;
6. tratar dados editoriais SQLite de forma explícita;
7. informar falha se uma parte crítica não puder ser restaurada, em vez de declarar sucesso parcial como restauração completa.

## Proteção do reset local

`factoryResetAll()` também foi endurecido antes da refatoração visual:

- itens do Calendário Editorial em SQLite são removidos explicitamente antes do `localStorage`;
- a autorização do renderer para o Vault é revogada;
- credenciais protegidas de Obsidian, Gemini e OpenAI são removidas antes do restante do estado local;
- falhas críticas são propagadas e interrompem o reset, em vez de declarar sucesso;
- arquivos físicos do Vault do Obsidian **nunca são apagados** pelo reset do aplicativo.

A seleção física do Vault pertence à configuração do runtime Electron e não é tratada como conteúdo a ser destruído. Qualquer futura opção de “esquecer este Vault” deve ser explícita e separada de exclusão de arquivos.

## Gates da Fase 0

Antes de iniciar a Fase 1, devem estar concluídos:

- [x] schema de backup versionado;
- [x] compatibilidade de leitura com backup legado;
- [x] proteção contra importação de credenciais;
- [x] proteção fail-closed para formato futuro desconhecido;
- [x] cobertura de teste do contrato de backup;
- [x] ligar o exportador da interface ao backup completo v2;
- [x] ligar o importador da interface às coleções opcionais sem apagar dados ausentes em backup legado;
- [x] incluir restauração explícita dos itens do Calendário Editorial;
- [x] testar round-trip `exportar → validar → importar` do workspace completo;
- [x] proteger o reset local contra calendário/credenciais residuais;
- [x] manter CI verde após o fluxo completo de backup/restauração e reset.

**Status: Fase 0 concluída.** A Fase 1 pode alterar navegação e visibilidade sem apagar estruturas legadas ou dados persistidos.
