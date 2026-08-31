# Etapa 3 — Seleção, validação de modelo e ativação transacional

Status: **em implementação após conclusão da Etapa 2**.

## Objetivo

Permitir que um modelo descoberto seja selecionado, testado explicitamente no provedor já confirmado e somente então promova a conexão para `CONEXAO_ATIVA`.

A Etapa 3 não redesenha ainda a interface completa e não remove os slots legados de credencial. O foco é fechar o contrato de ativação e impedir promoção de modelo não testado.

## Princípios obrigatórios

1. somente um provedor já confirmado pode validar um modelo;
2. o modelo selecionado precisa pertencer ao conjunto de modelos descobertos para esse fluxo;
3. a validação chama somente o provedor confirmado, sem fallback para outro provedor;
4. `CONEXAO_ATIVA` só pode ser produzida após um teste real bem-sucedido do modelo selecionado;
5. o modelo persistido é o ID explicitamente selecionado pelo usuário, não uma inferência baseada em alias/nome;
6. a capacidade `text_generation` só pode ser registrada após o teste real de geração;
7. erro bruto do SDK/provedor nunca é propagado ao retorno persistível;
8. nenhum retorno, log, metadata ou teste serializável contém a chave bruta;
9. uma tentativa de trocar apenas o modelo é transacional: falha do novo modelo não destrói a conexão ativa anterior;
10. rejeição explícita da credencial invalida a confiança na conexão;
11. nenhum slot legado de segredo é apagado nesta etapa;
12. nenhuma publicação de release ocorre nesta etapa.

## Pré-condições para validação

O fluxo precisa possuir:

- `connectionId`;
- `provider` confirmado;
- `secretRef` compatível;
- `credentialConfirmedAt`;
- chave disponível somente para o executor da validação;
- modelo selecionado presente na descoberta corrente.

Estados aceitos para iniciar validação:

- `AGUARDANDO_MODELO`;
- `CONEXAO_ATIVA`, quando o usuário está testando uma troca de modelo;
- estados transitórios/recuperáveis que ainda preservem identidade e provedor confirmados podem ser aceitos somente se todos os campos de confirmação acima estiverem presentes.

## Teste de modelo

A validação deve usar o provider adapter existente com configuração explícita:

- `provider`: o provedor confirmado;
- `apiKey`: a credencial correspondente;
- `model`: exatamente o ID selecionado.

O teste executa a operação mínima existente de `testConnection()`/geração de texto. Não deve testar múltiplos modelos em sequência.

## Resultado de sucesso

Após o teste real bem-sucedido:

- `status = CONEXAO_ATIVA`;
- `connectionId` é preservado;
- `provider` é preservado;
- `secretRef` é preservado;
- `credentialConfirmedAt` é preservado;
- `model` recebe exatamente o modelo selecionado;
- `modelCandidate` é removido;
- `modelConfirmedAt` recebe timestamp novo;
- `capabilities` inclui somente capacidades realmente validadas nesta etapa (`text_generation`).

## Resultado de falha

### Modelo inválido/indisponível para a credencial

- não promove `CONEXAO_ATIVA`;
- se não havia conexão ativa anterior, retorna ao estado `AGUARDANDO_MODELO` mantendo a credencial/provedor confirmados;
- se havia conexão ativa anterior, mantém a configuração ativa anterior intacta e retorna a falha separadamente.

### Credencial rejeitada

- remove confiança de `connectionId`/timestamps confirmados;
- estado passa para `CHAVE_INVALIDA`;
- nenhuma conexão antiga é mantida como válida após rejeição explícita da mesma credencial.

### Sem permissão / limite / indisponibilidade

- não promove o novo modelo;
- não inventa sucesso;
- quando existe conexão ativa anterior, a configuração ativa anterior permanece transacionalmente intacta;
- quando ainda não existe conexão ativa, o fluxo preserva apenas metadados confirmados que continuem semanticamente válidos.

## Fora do escopo

A Etapa 3 não implementa:

- tela final de conexão de IA;
- migração física da chave para `active:aiConnectionKey`;
- exclusão de `geminiApiKey` / `openaiApiKey`;
- troca de todos os consumidores antigos para o novo contrato;
- fallback entre provedores;
- fallback automático entre modelos;
- Chat no Vault;
- linguagem natural global;
- publicação de release.

## Casos de teste mínimos

1. chave vazia → falha sem chamar provider;
2. estado sem provedor confirmado → falha sem chamar provider;
3. provider da requisição divergente do estado → falha sem chamar provider;
4. modelo ausente da descoberta → falha sem chamar provider;
5. validação chama exatamente um provider/modelo;
6. sucesso → `CONEXAO_ATIVA`;
7. sucesso preserva `connectionId`, `provider`, `secretRef` e `credentialConfirmedAt`;
8. sucesso grava exatamente o modelo escolhido;
9. sucesso registra `modelConfirmedAt` e `text_generation`;
10. sucesso remove `modelCandidate` antigo;
11. `INVALID_MODEL` sem conexão ativa → volta a `AGUARDANDO_MODELO`;
12. `INVALID_MODEL` durante troca de modelo → conexão ativa anterior permanece intacta;
13. 401/credencial inválida → `CHAVE_INVALIDA` e confiança anterior é removida;
14. 403 → `SEM_PERMISSAO` quando não há conexão ativa anterior;
15. 429 → `LIMITE_OU_COTA` quando não há conexão ativa anterior;
16. rede/5xx → `PROVEDOR_INDISPONIVEL` quando não há conexão ativa anterior;
17. falha transitória durante troca de modelo preserva conexão ativa anterior;
18. erro contendo a chave não aparece no resultado;
19. nenhuma validação tenta outro provedor ou outro modelo;
20. resultado serializável nunca contém `apiKey`.

## Gate de conclusão

A Etapa 3 só pode ser concluída quando:

- contrato de validação estiver isolado e testável com provider factory injetável;
- nenhuma promoção para `CONEXAO_ATIVA` ocorrer sem teste real bem-sucedido;
- troca de modelo for transacional;
- rejeição de credencial invalidar a confiança corretamente;
- nenhum segredo entrar em metadata/backup/localStorage;
- TypeScript, Bun, Node, build e backend smoke estiverem verdes;
- Windows Desktop Runtime Test estiver verde no head final;
- revisão do diff confirmar ausência de fallback multi-provider/multi-model;
- revisão confirmar que slots legados permanecem compatíveis e não são removidos.
