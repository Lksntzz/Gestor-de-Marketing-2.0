# Onboarding da Base Inicial

## Objetivo

Transformar um Vault vazio ou estruturalmente incompleto em uma Base Inicial utilizável pelo Nisti Marketing sem criar uma segunda fonte de verdade, sem preencher lacunas automaticamente e sem sobrescrever documentos canônicos existentes.

O Onboarding é uma orientação dentro de **Base**. Ele não é uma nova área principal do produto.

## Documentos canônicos

O domínio reconhece os seguintes arquivos como Base Inicial:

- `00_Base/Empresa.md`
- `00_Base/Publico.md`
- `00_Base/Posicionamento.md`
- `00_Base/Produtos.md`
- `00_Base/Diferenciais.md`
- `00_Base/Tom-de-Voz.md`
- `00_Base/Canais.md`
- `00_Base/Concorrentes.md`
- `00_Base/Objetivos.md`

`00_Base/Pendencias.md` é derivado das respostas vazias ou explicitamente marcadas como `PENDENTE` durante o onboarding.

## Regras epistemológicas

Cada resposta é declarada pelo usuário como:

- `CONFIRMADO`: informação que o usuário está afirmando como válida;
- `HIPÓTESE`: informação ainda não confirmada;
- `PENDENTE`: informação ausente, indefinida ou que precisa de revisão.

Uma seção somente recebe `CONFIRMADO` se todas as respostas da seção tiverem conteúdo e estiverem `CONFIRMADO`. Qualquer resposta vazia ou `PENDENTE` torna o documento `PENDENTE`. A presença de ao menos uma `HIPÓTESE`, sem pendências, torna o documento `HIPÓTESE`.

O onboarding não usa IA para preencher ou promover respostas. Informação ausente permanece explicitamente ausente.

## Fluxo

1. `assessBaseReadiness()` compara o Vault com os caminhos canônicos.
2. O painel dentro de `VaultView` é mostrado quando a Base ainda não está estruturalmente confirmada.
3. As respostas são salvas localmente em `nisti_base_onboarding_draft_v1`, permitindo interromper e continuar depois.
4. `buildBaseDocumentPlans()` cria apenas planos para arquivos canônicos ausentes.
5. A tela de revisão mostra os caminhos e estados antes de qualquer escrita.
6. Após confirmação humana, o runtime desktop chama `commitKnowledge` com `failIfExists: true`.
7. O processo principal usa escrita exclusiva (`wx`) e bloqueia o commit se o caminho canônico já existir.
8. Depois dos commits, o snapshot físico do Vault é recarregado e o estado de notas do app é reconciliado.
9. O `VaultWatcher` observa as gravações e serializa reindexações do `KnowledgeIndex`, evitando colisões de sync concorrente.

## Compatibilidade com Vaults existentes

`00_Base` faz parte das pastas padrão. Ela é garantida tanto ao selecionar um Vault quanto ao reabrir um Vault já configurado.

Um arquivo canônico existente nunca é recriado com sufixo como `(2)`. O onboarding o considera preservado e não gera plano de gravação para esse caminho.

Se um documento canônico existente estiver `HIPÓTESE`, `PENDENTE` ou não possuir `epistemic_status: CONFIRMADO`, a Base continua sinalizada como não confirmada. A revisão desse arquivo acontece pelo fluxo normal da Base/Obsidian; o onboarding não substitui conteúdo existente.

## Testes e proteção contra regressão

`tests/baseOnboarding.test.ts` cobre:

- caminhos canônicos;
- completude da Base;
- agregação epistemológica;
- geração Markdown sem conteúdo sintético;
- criação de `Pendencias.md` a partir de lacunas reais;
- preservação de documentos existentes;
- `00_Base` na fronteira desktop;
- `failIfExists` no contrato e no processo principal;
- escrita exclusiva;
- uso do snapshot físico após commit;
- integração dentro de `VaultView` sem criar nova rota principal.

Último checkpoint de implementação: CI Quality Gate #430, head `c17a065f26432868c26fa2b50fb4cc42a7f1d74c`, com TypeScript, testes Bun, integração Node, build Web/backend/Electron e smoke concluídos com sucesso.
