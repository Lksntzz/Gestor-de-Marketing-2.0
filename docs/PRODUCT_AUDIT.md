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

---

## 3. Estúdio de Criação — Ideias, Roteiros, Campanhas e Resultados

### Direção recomendada

O Estúdio deve ser organizado como **um fluxo criativo contínuo**, e não como várias ferramentas independentes:

`Briefing → gerar ideias → escolher uma ideia → desenvolver roteiro/peça → aprovar → enviar ao planejamento`

Campanha deve funcionar como **contexto/contêiner estratégico** para conteúdos, não como um segundo gerador concorrente. Resultados pertencem ao ciclo de aprendizado pós-publicação e não devem dominar o Estúdio de Criação.

### Ideias e Roteiros

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Gerar ideias a partir de objetivo, formato e canal | MANTER | É uma capacidade central e diretamente acionável. |
| Mostrar fontes do Vault usadas na geração | MANTER discreto | Garante rastreabilidade sem precisar dominar a tela. |
| Aviso de fallback/contexto insuficiente | MANTER | Importante para não apresentar geração sem base como se estivesse fundamentada. |
| Separar permanentemente “Ideias” e “Roteiros” em duas ferramentas | MESCLAR | São estágios consecutivos do mesmo trabalho. Uma ideia aprovada deveria virar roteiro/peça sem redigitação. |
| Formulário de roteiro exigindo digitar “Ideia / Título” novamente | REMOVER duplicação | A ideia deveria ser selecionada a partir da etapa anterior ou biblioteca aprovada. |
| Salvar ideia/roteiro no Vault | MANTER | Mantém rastreabilidade e histórico, mas deve ser consequência clara de “aprovar/salvar”, não um fluxo paralelo. |
| Adicionar direto ao calendário | SIMPLIFICAR / CORRIGIR | Hoje cria item com a data atual sem o usuário escolher uma data real. Isso transforma criação em falso planejamento. |
| Biblioteca persistente de ideias/roteiros | MANTER como próxima evolução | O componente recebe `ideas` e `scripts`, mas a experiência atual é focada apenas no que acabou de ser gerado. Falta continuidade do acervo criativo. |

### Problemas de lógica encontrados em Ideias/Roteiros

- O botão `Calendário` grava um item editorial com `scheduledDate` igual ao dia atual, mesmo sem decisão explícita de agenda.
- Ao enviar um roteiro ao calendário, a plataforma é gravada como `Instagram`, independentemente do valor informado em `scriptPlatform`.
- Roteiros são persistidos internamente com tipo `video_reels`, independentemente do formato digitado.
- Ideias salvas no Vault preservam muitos detalhes, mas o `IdeaItem` interno mantém apenas parte deles; isso cria duas representações divergentes da mesma ideia.
- O fluxo de roteiro não seleciona uma ideia salva: exige nova entrada textual e pode perder contexto da ideia original.

### Campanhas

A criação de campanha atual possui disciplina boa: exige fontes, revisão humana, não inventa agenda e mantém estado epistemológico. Se todas as fontes forem confirmadas, a própria campanha gerada ainda é tratada como **HIPÓTESE**, o que é conceitualmente correto: estratégia gerada não vira fato só porque as fontes são confiáveis.

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Campanha como agrupador estratégico | MANTER | É útil para organizar objetivo, público, canais, conteúdos e resultados relacionados. |
| Wizard de 5 etapas | SIMPLIFICAR | Nome/objetivo/base/público/tom/canais/revisão são válidos, mas parte disso deve vir da Base Inicial/Briefing e não ser redigitada sempre. |
| Seleção manual obrigatória de fontes do Vault | SIMPLIFICAR | Preservar transparência, mas permitir seleção automática recomendada com opção de revisar/trocar fontes. |
| Campo Público e Tom em toda nova campanha | MESCLAR COM BRIEFING/BASE | Podem ser herdados da base e alterados quando a campanha realmente exigir exceção. |
| “Sugerir diretrizes gerais” | SIMPLIFICAR | É útil, mas deve fazer parte do briefing assistido, não parecer ferramenta separada dentro do formulário. |
| Alternância “Motor Local / IA” na tela de campanha | MOVER PARA AVANÇADO | Decisão técnica de execução, não decisão de marketing. |
| Mostrar motor, fallback, status de gravação no card da campanha | MOVER PARA AVANÇADO | Rastreabilidade deve existir, mas como detalhes/auditoria, não como informação principal diária. |
| Salvar no Obsidian | MANTER | Confirma o rascunho no Vault; deve permanecer explícito. |
| Importar tarefas sugeridas | SIMPLIFICAR | Bom próximo passo, mas deve aparecer após aprovação da campanha, não competir com o conteúdo principal. |

### Resultados

A preocupação com evidência é correta, mas a implementação atual está pesada demais para uso recorrente.

| Elemento | Classificação | Diagnóstico |
|---|---|---|
| Registrar resultado real vinculado a campanha | MANTER, mas simplificar | Fecha o ciclo de aprendizado e evita decisões só por intuição. |
| Exigir fonte de evidência | MANTER | Boa proteção contra métricas inventadas. |
| Exigir todas as métricas possíveis | SIMPLIFICAR fortemente | Plataformas e formatos não oferecem sempre impressões, alcance, CTR, conversão etc. Obrigatoriedade total pode impedir registro de dados reais parciais. |
| Score 0–100 obrigatório | REMOVER ou tornar opcional | Sem definição objetiva de cálculo, vira classificação subjetiva com aparência quantitativa. |
| Nicho, gatilho emocional, hook, horário e demais classificações manuais | MOVER PARA AVANÇADO / automatizar quando suportado | O formulário atual tem custo operacional alto e pode desestimular qualquer registro de resultado. |
| Cards globais de publicações, alcance, leads e CTR | SIMPLIFICAR | Só têm valor com janela temporal e contexto; acumulados históricos podem induzir leitura errada. |
| “Resultados por campanha” | MANTER | Comparação vinculada explicitamente a uma campanha é útil e rastreável. |

### Problemas de medição encontrados

- O snapshot soma métricas históricas de todas as publicações sem janela temporal.
- O CTR médio é uma média simples dos percentuais informados por publicação, não ponderada por impressões/cliques. Pode produzir um indicador enganoso quando volumes são muito diferentes.
- Campos ausentes são normalizados como zero no agregador; isso mistura “não medido” com “resultado zero”.
- O formulário exige nove métricas quantitativas ao mesmo tempo, mesmo quando algumas não existem para determinado canal/formato.

### Estúdio alvo

A experiência recomendada é uma única área de criação:

1. **Briefing** — objetivo + campanha opcional + contexto herdado da Base Inicial.
2. **Ideias** — gerar algumas opções fundamentadas e escolher uma.
3. **Desenvolver** — transformar a ideia escolhida em roteiro/carrossel/peça.
4. **Aprovar** — salvar versão aprovada no Vault.
5. **Planejar** — enviar para o Calendário, pedindo uma data real em vez de assumir hoje.

Campanhas ficam como contexto organizador e podem ser criadas/gerenciadas numa visão mais simples. Resultados entram após publicação, vinculados à campanha/conteúdo, com somente as métricas realmente disponíveis e evidência explícita.

### Decisão desta área

- **Ideias + Roteiros:** MANTER, mas **MESCLAR como fluxo único**.
- **Campanhas:** MANTER, mas **SIMPLIFICAR e aproximar do Briefing/Planejamento**.
- **Resultados:** MANTER como capacidade de aprendizado, porém **reduzir drasticamente o formulário** e não deixar essa visão ser a porta de entrada do Estúdio.
- **Controles técnicos de motor/fallback/sync:** manter para rastreabilidade, mas **MOVER PARA AVANÇADO**.
