# ADR-002 — Persistência local-first com Vault, SQLite e safeStorage

Status: **Aceito**

Data: 31/08/2026

## Contexto

Documentos históricos do projeto previram PostgreSQL/Supabase, autenticação multiusuário, plugin próprio Nisti Knowledge, Google Drive como componente estrutural e um AI Gateway desacoplado. O produto evoluiu para um aplicativo Windows local-first integrado diretamente ao Obsidian.

Manter os dois desenhos como arquiteturas simultaneamente válidas cria fontes de verdade concorrentes, duplicação de sincronização e regras de autorização incompatíveis.

## Decisão

A arquitetura principal é local-first e distribui persistência por responsabilidade.

### Obsidian / Markdown

Fonte documental de conhecimento para:

- Base;
- fontes;
- ideias e roteiros documentais;
- campanhas e reuniões quando representadas como conhecimento;
- resultados e aprendizados documentais.

No desktop, acesso ao sistema de arquivos é a via principal. REST API do Obsidian é integração opcional.

### SQLite / armazenamento operacional local

Usado para estados operacionais determinísticos que não devem depender da interpretação do documento, como calendário/editorial e índices operacionais já definidos pelo produto.

### `safeStorage`

Usado para credenciais e segredos autorizados. Segredo não é configuração comum e não pertence ao Vault.

### Índice local

Responsável por busca e recuperação, detecção de mudança/duplicidade e suporte à memória criativa. O índice pode ser reconstruível e não substitui o conteúdo canônico do Vault.

## Regras

- não criar segunda fonte de verdade para o mesmo domínio sem ADR específico;
- `.obsidian` não é gerenciado automaticamente pelo Nisti;
- `.nisti` contém somente metadados gerenciados definidos pela arquitetura do Vault;
- índice SQLite do conhecimento permanece fora do Vault para reduzir conflito de sincronização;
- escrita nova não sobrescreve arquivo existente silenciosamente;
- reparo estrutural só recria elementos gerenciados ausentes;
- caminhos inseguros e destinos externos ao Vault são bloqueados;
- watcher e reconciliação incremental não transformam sincronizador de nuvem em responsabilidade do Nisti.

## Componentes históricos

### Substituídos como núcleo

- PostgreSQL/Supabase/RLS como persistência central;
- plugin Nisti Knowledge obrigatório;
- AI Gateway remoto obrigatório;
- Google Drive como fonte canônica.

### Permitidos como integração opcional

- Google Drive para importação/apoio de arquivos;
- REST API do Obsidian para interoperabilidade adicional.

## Consequências

Positivas:

- menor dependência de infraestrutura externa;
- operação local previsível;
- interoperabilidade direta com Obsidian;
- separação explícita entre conhecimento, operação e segredos.

Trade-offs:

- sincronização entre computadores depende de ferramenta externa escolhida pelo usuário;
- colaboração multiusuário em tempo real não é objetivo desta arquitetura;
- migrações de schema e manifesto passam a ser responsabilidade explícita do desktop.
