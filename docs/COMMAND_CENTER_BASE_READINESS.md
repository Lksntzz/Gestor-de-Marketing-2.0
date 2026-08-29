# Command Center — prontidão da Base

## Objetivo

O Início deve recomendar trabalho operacional somente quando a Base Inicial canônica estiver pronta. A existência de notas soltas no Vault não equivale a uma Base estruturada.

## Ordem de prioridade

1. Obsidian desconectado → configurar Base.
2. Documentos canônicos ausentes → completar Base Inicial.
3. Documentos canônicos existentes, mas com estado diferente de `CONFIRMADO` → revisar Base Inicial.
4. Tarefas pendentes → executar.
5. Campanhas abertas → revisar/planejar.
6. Sem fila operacional → abrir Planejamento.

## Fonte de verdade

A prontidão é calculada por `assessBaseReadiness(notes)` sobre os documentos canônicos de `00_Base` definidos em `src/domain/baseOnboarding.ts`.

Uma nota em `00_Inbox`, uma campanha ou outro documento fora de `00_Base` nunca substitui os documentos canônicos.

## Interface

O Dashboard continua com apenas três responsabilidades visíveis:

- `O que fazer agora?`
- `Esta semana`
- `Bloqueios`

A prontidão da Base altera a decisão e o bloco de bloqueio; não cria novos cards técnicos nem métricas permanentes.
