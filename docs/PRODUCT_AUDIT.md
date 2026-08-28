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
