# Etapa 2 — Análise segura de credencial e descoberta de modelos

Status: **em implementação após conclusão da Etapa 1**.

## Objetivo

Confirmar de forma segura o provedor explicitamente escolhido e descobrir os modelos disponíveis para a credencial, sem enviar uma chave a múltiplos provedores, sem ainda redesenhar a interface inteira e sem remover a compatibilidade legada.

## Princípios obrigatórios

1. análise de formato acontece somente localmente;
2. formato/prefixo gera no máximo um candidato, nunca uma confirmação;
3. formato ambíguo ou desconhecido exige seleção explícita do provedor antes de qualquer transmissão;
4. uma credencial só pode ser enviada ao endpoint oficial do provedor explicitamente selecionado;
5. não existe fallback ou probing automático entre provedores;
6. erros/logs/retornos nunca contêm a chave bruta;
7. a descoberta de modelos não confirma automaticamente um modelo específico;
8. sucesso de autenticação/listagem pode confirmar a credencial e o provedor, mas o estado final desta etapa é `AGUARDANDO_MODELO`, não `CONEXAO_ATIVA`;
9. a chave continua no armazenamento seguro legado enquanto consumidores antigos dependerem dele;
10. nenhum segredo entra em `localStorage`, backup, Markdown ou estado comum.

## Análise local

A análise local deve retornar somente metadados não sensíveis:

- estado sugerido;
- candidatos de provedor;
- provedor candidato quando inequívoco.

O analisador não retorna:

- chave completa;
- prefixo copiado da chave;
- hash reversível/identificador derivado da chave;
- trecho mascarado que permita correlação persistente.

Heurísticas conhecidas podem mudar ao longo do tempo e, por isso, não são prova de identidade do provedor.

## Confirmação do provedor

### OpenAI

A confirmação usa somente o host oficial `api.openai.com` e a operação de listagem de modelos. A credencial é enviada no header de autorização do provedor selecionado.

### Gemini

A confirmação usa somente o host oficial `generativelanguage.googleapis.com` e `models.list`. A credencial deve preferencialmente ser enviada pelo header `x-goog-api-key`, evitando incluí-la na URL.

## Descoberta de modelos

O resultado da descoberta é efêmero e pode conter:

- ID do modelo;
- nome de exibição quando fornecido oficialmente;
- proprietário quando fornecido oficialmente;
- ações suportadas quando fornecidas oficialmente.

Regras:

- OpenAI: não inferir capacidades a partir do nome do modelo;
- Gemini: modelos podem ser filtrados por suporte oficial a `generateContent`;
- paginação deve ser respeitada quando o provedor fornecer token/cursor;
- IDs duplicados devem ser removidos;
- ordem deve ser determinística para facilitar teste e UI futura.

## Estados de erro

Falhas devem ser normalizadas para o contrato existente:

- credencial explicitamente rejeitada → `CHAVE_INVALIDA`;
- autenticação válida sem permissão suficiente → `SEM_PERMISSAO`;
- rate limit/quota → `LIMITE_OU_COTA`;
- indisponibilidade/rede/erro inesperado do provedor → `PROVEDOR_INDISPONIVEL`.

Nenhum estado de erro pode ser promovido silenciosamente para conexão válida.

## Sucesso

Após descoberta bem-sucedida:

- `connectionId` existe;
- `provider` está confirmado;
- `providerCandidate` pode ser removido;
- `secretRef` continua apontando para o slot seguro compatível durante a migração;
- `credentialConfirmedAt` é registrado;
- `status` passa para `AGUARDANDO_MODELO`;
- `model` e `modelConfirmedAt` permanecem ausentes;
- `CONEXAO_ATIVA` não é permitido nesta etapa.

## Fora do escopo

A Etapa 2 não implementa:

- redesenho completo da tela de configuração;
- seleção/validação final do modelo;
- consolidação física para `active:aiConnectionKey`;
- exclusão de `geminiApiKey`/`openaiApiKey`;
- troca dos consumidores existentes para novo orquestrador;
- fallback entre provedores;
- Chat no Vault;
- camada completa de linguagem natural;
- publicação de release.

## Casos de teste mínimos

1. chave vazia → `SEM_CHAVE`, sem rede;
2. formato Gemini conhecido → somente candidato Gemini, sem rede;
3. formato OpenAI conhecido → somente candidato OpenAI, sem rede;
4. formato desconhecido → aguarda confirmação explícita, sem rede;
5. descoberta OpenAI chama somente `api.openai.com/v1/models`;
6. descoberta Gemini chama somente `generativelanguage.googleapis.com/v1beta/models`;
7. Gemini usa header `x-goog-api-key`, sem chave na URL;
8. paginação Gemini é seguida;
9. modelos Gemini sem `generateContent` são excluídos;
10. OpenAI preserva IDs retornados sem inventar capacidades;
11. 401/credencial inválida → `CHAVE_INVALIDA`;
12. 403 → `SEM_PERMISSAO`;
13. 429 → `LIMITE_OU_COTA`;
14. rede/5xx → `PROVEDOR_INDISPONIVEL`;
15. erro contendo a chave na mensagem de baixo nível → saída sanitizada;
16. sucesso → `AGUARDANDO_MODELO`, nunca `CONEXAO_ATIVA`;
17. resultado serializável não contém a chave;
18. nenhuma implementação tenta o segundo provedor após falha do primeiro.

## Gate de conclusão

A Etapa 2 só pode ser concluída quando:

- análise local estiver isolada e testada;
- adapter de descoberta aceitar `fetch` injetável para testes;
- hosts de rede estiverem fechados em constantes conhecidas;
- nenhuma chave aparecer em URL, erro, log, backup ou metadata persistida;
- nenhuma descoberta multi-provedor automática existir;
- TypeScript, Bun, Node, build e backend smoke estiverem verdes;
- Windows Desktop Runtime Test estiver verde no head final;
- revisão do diff confirmar que UI completa, validação final de modelo e remoção das chaves legadas não foram antecipadas.
