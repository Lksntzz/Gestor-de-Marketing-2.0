# Nisti Marketing 3.1 — Smart Knowledge Pipeline

## Entrega em duas etapas

### Etapa 1 — núcleo Obsidian e Inbox inteligente
- Local REST API é o caminho principal de conexão.
- Nenhuma seleção física de pasta é necessária para o fluxo padrão.
- Após validar a API Key, o app cria a raiz `Nisti Marketing/` no Vault ativo.
- A estrutura canônica é criada dentro dessa raiz.
- Capturas externas devem entrar em `Nisti Marketing/00_Inbox`.
- A Inbox é reavaliada automaticamente a cada heartbeat.
- Classificações com confiança >= 0.82 são movidas automaticamente.
- Ambiguidades e colisões permanecem na Inbox para revisão.
- A ferramenta Adicionar fonte usa exatamente as mesmas pastas canônicas.
- A tela de Configurações descreve o fluxo REST-first e não orienta seleção manual de Vault físico.

### Etapa 2 — inteligência de planejamento e aprendizado
- Transporte REST dos binários originais (PDF/imagem/áudio).
- Transcrição de áudio.
- Classificação assistida por IA quando as regras determinísticas forem inconclusivas.
- Ingestão estruturada de métricas Instagram/TikTok.
- Aprendizados em `08_Aprendizados` como evidência do planejador.
- Planner grounded obrigatório com rastreabilidade das fontes usadas.

## Regra de segurança
A automação nunca sobrescreve uma nota existente no destino. Em caso de colisão, confiança baixa ou `triage_mode: manual`, a nota permanece na Inbox.
