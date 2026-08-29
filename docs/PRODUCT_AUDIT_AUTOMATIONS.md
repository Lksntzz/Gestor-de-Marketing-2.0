# Auditoria de Produto — Automações

Este documento complementa a auditoria geral do Nisti Marketing e avalia a área **Automações** pelo valor real entregue ao fluxo de marketing.

Classificações: **MANTER**, **SIMPLIFICAR**, **MESCLAR**, **MOVER PARA AVANÇADO**, **REMOVER**.

## Conclusão executiva

A área atual chamada **Automações não deve permanecer como módulo principal do produto na forma atual**.

O runtime disponível não executa gatilhos em segundo plano. As regras possuem campos como `trigger` e `enabled`, mas a execução real continua manual: o usuário precisa abrir o aplicativo e clicar em **Executar**. Portanto, hoje a tela representa principalmente uma camada de configuração em torno de ações manuais já disponíveis em outras áreas.

Direção recomendada para a versão simplificada:

- remover **Automações** da navegação principal;
- remover a aba duplicada `Automações` de `TasksAutomationView` no fluxo normal de Execução;
- manter somente as ações úteis diretamente onde pertencem;
- preservar infraestrutura segura reutilizável internamente;
- reintroduzir uma área de automações apenas quando houver pelo menos um executor real de gatilho/agendamento com comportamento observável, persistente e seguro.

## 1. O que existe hoje

Existem três blueprints suportados pelo runtime seguro:

1. `rule_daily_sync` — sincronizar tarefas pendentes na Daily Note;
2. `rule_vault_audit` — gerar relatório/triagem de fontes pendentes em `00_Inbox`;
3. `rule_push_note` — reenviar ao Obsidian uma nota existente escolhida explicitamente.

Os próprios blueprints declaram `runtimeNotice: "Execução manual nesta versão; ..."`. Os rótulos dos gatilhos também usam a palavra **intenção** (`Agendamento diário (intenção)`, `Evento de nota (intenção)`).

Isso significa que `daily_schedule` e `on_note_tagged` não são atualmente gatilhos executados pelo runtime; são metadados descritivos.

## 2. Avaliação por regra

| Regra | Classificação | Diagnóstico |
|---|---|---|
| Sincronizar tarefas pendentes na Daily Note | MESCLAR | A mesma necessidade já existe como ação `Sincronizar Daily Note` em Execução. Não justifica uma regra configurável e outra tela. |
| Relatório de triagem do Inbox | MESCLAR / AUTOMATIZAR INTERNAMENTE | Contar fontes pendentes é diagnóstico do Cofre. Deve aparecer como bloqueio/revisão quando relevante, sem o usuário precisar criar, habilitar e executar uma “automação”. |
| Enviar nota existente ao Obsidian | REMOVER como automação | Regravar uma nota selecionada é operação de sincronização/persistência do Cofre, não uma automação de marketing. |

Nenhuma das três capacidades atuais, isoladamente, justifica um item principal de navegação chamado **Automações**.

## 3. Duplicação de navegação

`TasksAutomationView` contém os modos `Lista`, `Kanban` e `Automações`.

Ao mesmo tempo, a `Sidebar` possui **Automações** como item principal. O `App.tsx` renderiza exatamente o mesmo `TasksAutomationView` duas vezes:

- `activeTab === "tasks"` com `initialSection="tasks"`;
- `activeTab === "automations"` com `initialSection="automations"`.

Portanto, Automações é ao mesmo tempo:

- uma aba interna de Execução;
- uma área principal da navegação;
- o mesmo componente com estado inicial diferente.

Isso é duplicação de arquitetura de informação, não duas capacidades distintas.

## 4. “Habilitada” não significa automática

A interface permite adicionar uma regra, habilitá-la e depois executá-la. Porém, habilitar não agenda nem instala um gatilho. A própria tela informa que **nenhuma regra roda em segundo plano**.

Para o usuário, termos como:

- `Ativa`;
- `Gatilho`;
- `Agendamento diário`;
- `Evento de nota`;

podem sugerir uma automação persistente que não existe.

Se a infraestrutura for preservada em modo avançado, os rótulos devem refletir o comportamento real, por exemplo:

- `Ação manual disponível`;
- `Condição necessária`;
- `Executar agora`.

Não usar linguagem de agendamento/evento até existir executor real.

## 5. Duas implementações coexistindo

Há uma dívida técnica relevante.

### Caminho atual/safe runtime

`TasksAutomationView` mantém seu próprio estado de regras, valida com `validateAutomationRule` e executa por `executeAutomationRule`. Esse caminho é fail-closed, valida Obsidian e só incrementa a execução depois de sucesso confirmado.

### Caminho legado no App.tsx

O `App.tsx` ainda possui `handleToggleRule` e `handleRunRuleNow`, e passa esses callbacks como `onToggleRule` e `onRunRuleNow` para `TasksAutomationView`.

Entretanto, a implementação atual do componente não desestrutura nem usa esses callbacks; ela executa as regras internamente. Assim, esses handlers do `App.tsx` são código legado aparentemente morto para o fluxo atual.

Eles devem ser removidos durante a refatoração para reduzir superfície de comportamento contraditório e impedir reativação acidental.

## 6. Risco nos handlers legados

O caminho legado possui decisões hardcoded que conflitam com o princípio epistemológico atual do produto. Exemplos encontrados:

- cria nota de campanha com `produto: "Linha Nisti Print"`;
- força `nicho: "Papelaria & B2B"`;
- força `canal: "Omnichannel"`;
- cria tarefa de triagem com prazo no dia atual às `16:00`;
- cria lembrete dessa triagem às `15:00`;
- marca prioridade como `high` sem decisão explícita do usuário.

Mesmo que esse caminho não esteja sendo chamado pela UI atual, mantê-lo no código aumenta risco de regressão. Deve ser eliminado, não apenas escondido.

## 7. O que preservar

A auditoria não recomenda jogar fora a infraestrutura segura. Devem ser preservados como serviços/utilitários internos:

- validação fail-closed;
- snapshot validado do Vault;
- escrita confirmada no Obsidian;
- log de auditoria;
- reconciliação idempotente da Daily Note;
- contagem de execuções confirmadas quando houver execução real;
- blueprints somente se forem reutilizados por um futuro executor verdadeiro.

Essas capacidades são engenharia útil. O problema é apresentá-las hoje como um produto separado para o usuário.

## 8. Arquitetura alvo no curto prazo

### Cofre

- mostrar revisão pendente de `00_Inbox` quando houver;
- sincronização deve ser silenciosa/automática quando possível;
- permitir ação manual de sincronização em diagnóstico.

### Execução

- tarefas;
- lembretes explicitamente configurados;
- sincronização com Daily Note como ação secundária/avançada.

### Configurações / Diagnóstico

- estado do runtime;
- sincronização manual;
- logs;
- ações administrativas seguras.

Sem menu principal **Automações** por enquanto.

## 9. Quando Automações volta a justificar uma área própria

Reavaliar somente quando existir pelo menos uma capacidade como:

- executar regra em horário real sem clique manual;
- observar alteração de estado e reagir de forma persistente;
- fila durável de execuções;
- histórico de sucesso/falha;
- retry controlado e idempotente;
- desligamento/revogação clara;
- confirmação humana para ações de maior impacto;
- comportamento funcionando mesmo sem o usuário navegar até a tela.

Nesse ponto, **Automações** deixa de ser um conjunto de botões avançados e passa a ser uma capacidade real do produto.

## Decisão desta área

- **Automações como item principal da Sidebar:** REMOVER por enquanto.
- **Aba Automações dentro de Execução:** REMOVER do fluxo principal.
- **Sincronizar Daily Note:** MANTER como ação secundária/automática.
- **Triagem de Inbox:** MESCLAR com Cofre/alertas.
- **Push de nota:** MESCLAR com persistência/sincronização do Cofre.
- **Runtime seguro de validação e auditoria:** MANTER internamente.
- **Handlers legados de automação no `App.tsx`:** REMOVER na refatoração.
- **Futura área de automações:** somente depois de existir execução realmente automática e persistente.
