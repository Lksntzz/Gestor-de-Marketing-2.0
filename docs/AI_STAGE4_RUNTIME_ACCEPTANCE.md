# Etapa 4 — Runtime confiável da conexão única de IA

Status: **em implementação após conclusão da Etapa 3**.

## Objetivo

Mover a execução operacional da nova conexão de IA para a fronteira confiável do Electron, sem devolver a credencial ao renderer e sem permitir que o renderer fabrique a lista de modelos descoberta.

Esta etapa cria a ponte segura entre o contrato de domínio das Etapas 1–3 e o desktop real. A migração visual completa e a remoção dos caminhos legados ficam para um passo posterior, depois que esta fronteira estiver validada em CI e no runtime Windows.

## Regras obrigatórias

1. o renderer nunca fornece `apiKey` aos novos métodos de conexão;
2. o renderer nunca fornece `discoveredModels` aos novos métodos de validação;
3. a credencial é lida no processo principal a partir do armazenamento seguro existente;
4. descoberta de modelos e teste de modelo executam no processo principal;
5. todo IPC novo exige renderer confiável por `assertTrustedIpcSender`;
6. o retorno IPC contém somente estado validado, modelos sanitizados e mensagens públicas;
7. a metadata canônica da nova conexão é persistida no arquivo local protegido do aplicativo, não em `localStorage` do renderer;
8. nenhuma chave entra em `nisti_config.json`;
9. a lista de modelos usada para validação é a descoberta mantida em memória pelo runtime, não uma lista recebida da UI;
10. uma conexão ativa permanece intacta durante tentativa de troca de modelo ou provedor;
11. uma nova conexão somente substitui a ativa quando o modelo selecionado passa no teste real;
12. rejeição explícita da mesma credencial que sustenta a conexão ativa invalida essa conexão;
13. rejeição de uma credencial candidata de outro provedor não destrói a conexão ativa anterior;
14. falha transitória, cota, permissão ou modelo inválido não destroem conexão ativa anterior;
15. não existe fallback automático entre providers nem entre modelos;
16. os slots legados `geminiApiKey` e `openaiApiKey` permanecem nesta etapa;
17. `active:aiConnectionKey` continua somente como referência de domínio; a migração física do segredo fica fora desta etapa;
18. nenhuma release é publicada nesta etapa.

## Persistência confiável

O processo principal passa a manter `aiConnection` dentro de `nisti_config.json`.

A escrita deve:

- passar pelo `PersistedAIConnectionSchema` estrito;
- preservar o restante da configuração;
- remover campos com nomes de segredo antes da escrita;
- usar permissão de arquivo `0600` quando suportada;
- falhar explicitamente quando a persistência não puder ser concluída.

Se `aiConnection` ainda não existir no arquivo, o runtime pode migrar apenas sinais legados já existentes (`aiProvider`, `aiModel` e presença dos slots seguros). A chave bruta nunca participa da metadata.

## Sessão efêmera de proposta

Troca de provedor/modelo usa uma proposta mantida somente em memória:

- `provider` candidato;
- estado confirmado dessa proposta;
- lista de modelos realmente descoberta para essa proposta.

O renderer recebe uma cópia sanitizada desses dados, mas não controla a fonte da lista.

### Conexão ainda não ativa

A descoberta bem-sucedida pode persistir `AGUARDANDO_MODELO`.

### Conexão já ativa

A descoberta bem-sucedida cria somente uma proposta em memória. A metadata persistida continua `CONEXAO_ATIVA` até a validação final do novo modelo.

Se a proposta usa o mesmo provedor/segredo da conexão ativa, a identidade `connectionId` existente deve ser preservada.

## IPC novo

Contrato mínimo:

- `ai-connection:get-state`
- `ai-connection:confirm-provider`
- `ai-connection:validate-model`

Entradas permitidas:

- confirmar provedor: somente `{ provider }`;
- validar modelo: somente `{ provider, model }`.

Campos inesperados como `apiKey`, `secretRef`, `models` ou `discoveredModels` devem ser rejeitados.

## Casos mínimos de teste

1. confirmação lê a chave por `secretRef` internamente;
2. retorno serializável nunca contém a chave;
3. confirmação inicial bem-sucedida persiste `AGUARDANDO_MODELO`;
4. validação sem descoberta corrente falha sem chamar provider;
5. modelo não descoberto não pode ser injetado pelo renderer;
6. validação usa somente os modelos guardados na sessão do runtime;
7. conexão ativa permanece ativa durante descoberta de troca;
8. troca de modelo inválida preserva conexão ativa;
9. troca de provedor com credencial inválida preserva conexão ativa anterior;
10. rejeição da mesma credencial da conexão ativa invalida a confiança;
11. sucesso de troca substitui a conexão ativa somente após teste real;
12. mesma conexão/provedor preserva `connectionId`;
13. nenhum fallback multi-provider/multi-model ocorre;
14. metadata persistida passa pelo schema estrito;
15. bridge IPC não aceita `apiKey` nem lista de modelos;
16. TypeScript, Bun, Node, build e backend smoke verdes;
17. Windows Desktop Runtime Test verde no head final.

## Fora de escopo

- remoção dos métodos legados `getSecret/setSecret`;
- migração física para `active:aiConnectionKey`;
- exclusão dos slots `geminiApiKey` e `openaiApiKey`;
- tela final completa da conexão;
- migração de todos os consumidores de geração;
- alteração de fallback legado em consumidores que ainda não usam a nova conexão;
- publicação de release.

## Gate de conclusão

A Etapa 4 runtime só pode ser integrada quando:

- a chave não cruza a nova bridge renderer → main;
- a descoberta usada na validação não é controlada pelo renderer;
- troca de provedor/modelo é transacional em relação à conexão ativa;
- persistência canônica ocorre no processo principal e é secret-free;
- todos os testes automatizados passam;
- Quality Gate passa no head final;
- Windows Desktop Runtime Test passa no head final;
- revisão final do diff não encontra caminho alternativo de ativação ou vazamento de segredo.
