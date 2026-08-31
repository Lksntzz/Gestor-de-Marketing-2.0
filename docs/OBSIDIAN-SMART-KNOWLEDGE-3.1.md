# Nisti Marketing 3.1 — Smart Knowledge Pipeline

## Entrega concluída em duas etapas

### Etapa 1 — núcleo Obsidian e Inbox inteligente
- Local REST API é o caminho principal de conexão.
- Nenhuma seleção física de pasta é necessária para o fluxo padrão.
- Após validar a API Key, o app cria a raiz `Nisti Marketing/` no Vault ativo.
- A estrutura canônica é criada dentro dessa raiz.
- Capturas externas entram em `Nisti Marketing/00_Inbox`.
- A Inbox é reavaliada automaticamente a cada heartbeat.
- Classificações determinísticas com confiança >= 0.82 são movidas automaticamente.
- Ambiguidades e colisões permanecem na Inbox para revisão.
- A ferramenta Adicionar fonte usa exatamente as mesmas pastas canônicas.
- A tela de Configurações e o botão Sincronizar usam o fluxo REST-first.

### Etapa 2 — inteligência de planejamento e aprendizado
- Casos ambíguos da Inbox podem receber classificação assistida pela IA conectada; o movimento automático só é aceito com confiança >= 0.90 e pasta canônica validada.
- A classificação por IA é fail-closed: falha, divergência relevante, resposta inválida ou baixa confiança mantém a nota na Inbox.
- PDF, imagem e áudio podem preservar o arquivo original via REST, com recusa de sobrescrita, MIME permitido, limite de tamanho e rollback se a nota Markdown falhar.
- Áudios MP3, WAV, M4A, AAC, OGG e WEBM podem ser transcritos pelo provedor de IA configurado; a transcrição nasce como `PENDENTE` para homologação humana.
- Métricas observadas de Instagram e TikTok são extraídas sem preencher campos ausentes com zero e são armazenadas como evidência em `Nisti Marketing/08_Aprendizados`.
- Relatórios e regras canônicas de aprendizado usam `Nisti Marketing/08_Aprendizados`.
- O onboarding ativo baseado em documentos artificiais de `00_Base` foi retirado do fluxo do produto; o código legado permanece apenas para compatibilidade histórica.
- Dashboard, Cofre e Criar avaliam prontidão usando conhecimento real nas pastas gerenciadas pelo Nisti.
- Ideias, roteiros e copywriting exigem evidência relevante em Estratégia, Produtos, Conteúdos, Pesquisas ou Aprendizados; sem fonte relevante, a geração é bloqueada em vez de usar fallback sintético.
- As fontes usadas continuam rastreáveis na resposta do motor de criação.

## Segurança e integridade epistemológica
- A automação nunca sobrescreve uma nota ou asset existente no destino.
- Movimentação da Inbox continua transacional por cópia + exclusão com rollback.
- `triage_mode: manual` e `nisti_keep_in_inbox: true` bloqueiam movimentação automática.
- Conteúdo de notas é tratado como dado não confiável durante a classificação por IA.
- Respostas locais de aprendizado não fabricam vitórias, padrões, hipóteses ou prioridades quando a IA não está disponível.
- Campos de métricas não medidos permanecem ausentes.

## Release
A entrega está preparada como Nisti Marketing `3.1.0`. A publicação stable só ocorre depois de CI, testes Node, build, smoke do backend, runtime Windows, instalador NSIS, smoke de upgrade e validação do feed de atualização.
