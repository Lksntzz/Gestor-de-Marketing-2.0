# Nisti Marketing 3.1.7

## Correções principais

- Reconexão automática do Obsidian após reiniciar o Nisti, com retry/backoff e recuperação após perda transitória.
- Fluxo REST-first sem exigir seleção física do Vault para autenticação e escrita.
- Correção de URI `Abrir no Obsidian`, removendo placeholders de Vault inválidos.
- Escrita no Obsidian com bloqueio de colisão e confirmação somente após releitura do conteúdo.
- `00_Base` incluído na raiz gerenciada, sem desvio acidental para Inbox.
- Onboarding da Base Inicial restaurado como primeiro passo obrigatório.
- `Continuar para ideias` passa a depender da Base Inicial canônica realmente completa e confirmada.
- Contagens de documentos ausentes e pendentes corrigidas.
- Testes de regressão adicionados para reconexão, URI, roteamento da Base, readiness do briefing e escrita REST-first verificada.

## Atualização

A versão 3.1.7 preserva configurações e credenciais seguras durante a atualização. O instalador e o feed do auto-update são publicados somente depois dos gates de CI, runtime Windows, smoke do instalador e teste de upgrade da versão estável anterior.
