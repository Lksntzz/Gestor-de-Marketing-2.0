# Hotfix 3.1.8 — Bug 9: onboarding epistemológico

## Problema

A versão 3.1.7 bloqueava a conclusão da Base Inicial sempre que qualquer resposta não estivesse marcada como `CONFIRMADO`. Isso obrigava o usuário a promover hipóteses ou informações desconhecidas a fato para liberar o produto.

## Contrato corrigido

- `CONFIRMADO`: fato homologado pelo usuário.
- `HIPÓTESE`: inferência explícita; pode ser registrada, mas não vira fato.
- `PENDENTE`: informação desconhecida ou ainda não validada; pode ser registrada, mas não vira fato.
- Uma pergunta bloqueia o onboarding somente enquanto nunca foi revisada/classificada.
- Uma resposta explicitamente `PENDENTE` pode permanecer vazia.
- `structurallyComplete`: os 9 documentos canônicos existem no `00_Base`.
- `complete`: além de existirem, todos os documentos canônicos estão `CONFIRMADO`.
- O fluxo de criação usa a conclusão estrutural como gate e mantém a contagem de documentos não confirmados para transparência.

## Segurança epistemológica

O transporte de contexto para IA continua rotulando cada fonte por estado epistemológico. O system prompt do conhecimento continua exigindo que `CONFIRMADO` seja tratado como fato, `HIPÓTESE` apenas como inferência e `PENDENTE` nunca como fato.

## Regressões

- Base vazia continua bloqueada.
- Documento canônico ausente continua bloqueando.
- Base com todos os canônicos e alguns `HIPÓTESE`/`PENDENTE` libera o fluxo de criação.
- Perguntas nunca revisadas continuam bloqueando a gravação.
- Perguntas explicitamente `PENDENTE` não exigem confirmação falsa.
- `00_Base/Pendencias.md` continua registrando lacunas declaradas.
