# Auditoria de Produto — Nisti Marketing

## Objetivo

Reduzir complexidade e manter apenas telas, indicadores e ações que ajudam uma decisão ou execução real de marketing.

Classificações: **MANTER**, **SIMPLIFICAR**, **MESCLAR**, **MOVER PARA AVANÇADO**, **REMOVER**.

## 1. Início / Dashboard — auditoria inicial

### Direção recomendada

O Dashboard deve responder apenas a três perguntas:

1. O que eu preciso fazer agora?
2. O que está pendente nesta semana?
3. Existe algum bloqueio que me impede de trabalhar?

### Elementos atuais

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Card principal “O que fazer agora?” | MANTER | É o elemento mais alinhado ao papel do app: transforma dados em próxima ação. |
| Status “Motor Local / IA configurada” | MOVER PARA AVANÇADO | Estado técnico; útil para diagnóstico, mas não precisa ocupar destaque diário. |
| Status “Obsidian conectado” | SIMPLIFICAR | Mostrar apenas quando desconectado ou com problema. Estado saudável não precisa competir por atenção. |
| Botão “Sincronizar Daily” | MOVER PARA AVANÇADO | Operação técnica/rotineira; não deve ser CTA principal se a sincronização puder ser automática. |
| Botão “Adicionar conhecimento” no cabeçalho | MESCLAR | Duplica o atalho “Conhecimento” existente na mesma tela. Futuramente pode ser absorvido pelo onboarding/base. |
| Métrica “Campanhas estruturadas” | REMOVER do Dashboard | Contagem acumulada é pouco acionável e tende a virar métrica de vaidade. Pode existir dentro de Campanhas. |
| Métrica “Taxa de execução” | SIMPLIFICAR | Tem valor, mas hoje calcula concluídas / total histórico de tarefas. Precisa de janela temporal (ex.: semana atual) para não enganar. |
| Métrica “Notas indexadas” | MOVER PARA AVANÇADO | É saúde da base/sistema, não resultado de marketing. Melhor no Cofre ou Configurações. |
| “Atividades recentes” | SIMPLIFICAR | Útil como histórico/auditoria, mas secundário. Mostrar poucos eventos relevantes ou mover para uma área de atividade. |
| Atalhos “Cofre / Conhecimento / Planejamento / Execução” | REMOVER | Duplicam a navegação lateral e ocupam espaço sem criar nova capacidade. |

### Problemas de lógica encontrados

- A prioridade do Dashboard é determinística e baseada em dados reais, o que é positivo.
- Tarefas pendentes sempre vencem campanhas e bloqueios de configuração na seleção de prioridade; isso precisa ser revisado para distinguir bloqueio estrutural de tarefa operacional.
- A taxa de execução usa todas as tarefas acumuladas, portanto perde significado conforme o histórico cresce.
- O Dashboard recebe diversos dados e callbacks que atualmente não usa (`ideas`, `scripts`, `visuals`, auditoria, criação de campanha/tarefa/nota etc.), indicando contrato de componente inchado e dívida técnica.

### Dashboard alvo

O Dashboard recomendado deve ser menor:

- **Próxima ação** — uma ação clara e justificável.
- **Esta semana** — poucas pendências/entregas relevantes, não métricas acumuladas.
- **Bloqueios** — aparecer somente quando houver problema real (Vault desconectado, base vazia, configuração pendente etc.).

Sem painel de atalhos duplicado e sem métricas técnicas permanentes.

---

## 2. Cofre de Conhecimento — auditoria inicial

### Direção recomendada

O Cofre deve ter uma única responsabilidade de produto: **encontrar, entender, revisar e usar conhecimento confiável**.

A ingestão de novas fontes deve existir, mas não como uma segunda área independente competindo com o Cofre. A recomendação é transformar “Adicionar Conhecimento” em uma ação do próprio Cofre: **Adicionar fonte**.

### Elementos do Cofre atual

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Busca por fonte/resumo/tag | MANTER | É capacidade central para recuperar conhecimento. |
| Lista de fontes | MANTER | Necessária para navegação do acervo. |
| Árvore completa de pastas do Vault | SIMPLIFICAR | É útil para acervos grandes, mas não deve dominar a experiência. Pode ser filtro recolhível/secundário. |
| Síntese da fonte | MANTER | Entrega leitura rápida sem abrir o arquivo inteiro. |
| Pontos estruturados / evidências | MANTER | Aumenta utilidade operacional e rastreabilidade. |
| Estado CONFIRMADO / HIPÓTESE / PENDENTE | MANTER | É informação essencial para impedir uso indevido de conhecimento incerto. |
| Tipo, categoria, data e tags em blocos separados | SIMPLIFICAR | Metadados úteis, mas com peso visual excessivo. Consolidar em uma linha/chips de contexto. |
| Resumo estatístico da pasta e categorias no topo | REMOVER ou recolher | Contagens por tipo/estado são inventário, não uma ação de trabalho. Mostrar apenas quando explicitamente solicitado. |
| Editar Markdown dentro do Nisti | MOVER PARA AVANÇADO | Duplica a função do Obsidian, aumenta superfície de gravação e risco de conflito. O caminho principal deve ser “Abrir no Obsidian”. |
| Copiar síntese | MANTER discreto | Ação pequena e útil, sem precisar de destaque. |
| Abrir no Obsidian | MANTER | Respeita o Vault como fonte de verdade e permite consultar/editar o original. |
| Aviso para fonte PENDENTE | MANTER | Proteção epistemológica diretamente ligada ao uso correto da base. |
| “Usar no marketing” | SIMPLIFICAR | A intenção é correta, mas o rótulo é amplo. Deve encaminhar para uma ação concreta de criação, ex.: criar ideia/roteiro usando esta fonte. |
| “Extrair tarefas” | MOVER PARA AVANÇADO / MESCLAR | Nem toda fonte precisa gerar tarefa. Melhor como ação contextual dentro de “Usar fonte” ou menu secundário. |
| Status Obsidian conectado, número de pastas/fontes e última sync no rodapé | MOVER PARA AVANÇADO | Saúde técnica. Em estado normal deve ficar silenciosa; exibir somente falhas ou dentro de Configurações/diagnóstico. |
| Botão “Nova nota” | MESCLAR | Duplica o fluxo “Texto Livre” de Adicionar Conhecimento. Deve existir uma única entrada para criar/adicionar fonte. |

### Adicionar Conhecimento — diagnóstico

O fluxo de ingestão tem valor real: recebe uma fonte, processa, propõe síntese/evidências/hipóteses, exige revisão humana e só então grava no Vault. Essa sequência deve ser preservada.

O problema é a forma atual: há seis tipos visíveis de entrada (`URL Web`, `PDF`, `YouTube`, `Imagem/OCR`, `Texto Livre`, `Google Drive`), seleção explícita de pasta, informações de modelo/fallback e múltiplas opções de gravação. Isso expõe detalhes de implementação e aumenta o número de decisões necessárias para uma tarefa simples: **colocar uma fonte confiável na base**.

### Ingestão alvo

Reduzir a entrada principal para três formas compreensíveis:

1. **Arquivo** — PDF ou imagem; o sistema identifica o tipo automaticamente.
2. **Link** — site ou YouTube; o sistema identifica a origem automaticamente.
3. **Texto** — informação digitada ou colada manualmente.

Google Drive deve ficar **MOVER PARA AVANÇADO** até ser uma integração persistente e claramente necessária no fluxo diário.

O fluxo visual recomendado:

`Adicionar fonte → selecionar arquivo/link/texto → analisar → revisar síntese + estado epistemológico → aprovar → salvar no Vault`

A pasta pode ser sugerida automaticamente, com “Alterar local” como opção secundária. `00_Inbox` deve ser fallback interno, não um segundo CTA concorrente.

### Duplicações encontradas

- `Nova nota` no `VaultView` e `Texto Livre` no `AddKnowledgeView` criam conhecimento textual por caminhos diferentes.
- O Cofre já possui ações para usar a fonte em marketing enquanto a criação também possui seu próprio fluxo; a transição entre conhecimento e criação precisa ser explícita, não duplicar geradores.
- Estado da conexão, contagens do Vault e sincronização aparecem em múltiplas telas; devem virar diagnóstico silencioso e centralizado.
- Edição Markdown no Nisti compete diretamente com o Obsidian, apesar de o próprio produto declarar o Vault como fonte de verdade.

### Cofre alvo

Uma única área **Cofre de Conhecimento** com:

- busca;
- filtro opcional por pasta/estado;
- lista de fontes;
- painel de síntese/evidências;
- indicador epistemológico;
- `Abrir no Obsidian`;
- `Usar esta fonte`;
- `Adicionar fonte`.

Sem subaba permanente “Adicionar Conhecimento”, sem editor Markdown como caminho principal e sem painel técnico permanente de sincronização.
