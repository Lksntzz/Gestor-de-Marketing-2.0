# Etapa 5A — Fundação da UI de conexão única de IA

Status: implementação de fundação. Esta etapa não substitui ainda a tela de configuração nem migra os consumidores de geração.

## Objetivo

Preparar uma fronteira segura para que a próxima alteração de UI trabalhe com uma única credencial ativa sem voltar ao padrão legado de duas chaves expostas ao renderer.

## Contrato

1. A credencial canônica usa o slot seguro `aiConnectionKey` e a referência documental `active:aiConnectionKey`.
2. O renderer pode **gravar** ou **limpar** essa credencial por IPC dedicado, mas não pode lê-la de volta.
3. O slot canônico não pertence ao `ALLOWED_SECRET_NAMES` genérico; portanto `getSecret()` não pode ser usado para recuperá-lo.
4. Regravar exatamente a mesma credencial é idempotente e não revoga uma conexão já validada.
5. Trocar a credencial reinicia a cadeia de confiança antes da nova gravação. Se a gravação falhar, metadata antiga não permanece confiável.
6. Conexões novas usam `active:aiConnectionKey` por padrão.
7. Metadata migrada que contém explicitamente `legacy:geminiApiKey` ou `legacy:openaiApiKey` continua compatível para o mesmo provedor durante a janela de migração.
8. Uma troca de provedor sem referência legada explicitamente correspondente usa a credencial canônica e não procura silenciosamente a outra chave legada.

## Fora do escopo desta subetapa

- substituir o painel de IA em `ObsidianApiSettingsModal.tsx`;
- remover `geminiApiKey` e `openaiApiKey` dos tipos/configuração legados;
- migrar geração de conteúdo/campanhas/análises para o runtime canônico;
- remover o endpoint legado de teste de IA;
- remover compatibilidade de workspaces antigos.

## Gate obrigatório antes de ligar a nova UI

O factory reset atual ainda limpa apenas `obsidianApiKey`, `geminiApiKey` e `openaiApiKey`. Antes que a UI passe a gravar `aiConnectionKey`, o reset total deve chamar `clearAIConnectionCredential()` e exigir sucesso antes de limpar o restante do estado local.

Nenhuma release deve expor a nova entrada de credencial enquanto esse gate não estiver implementado.

## Critérios de aceite desta fundação

- `aiConnectionKey` não pode ser lido pelo preload;
- handlers dedicados validam renderer confiável;
- credencial não aparece em metadata, retorno IPC ou logs;
- conexão nova lê apenas `active:aiConnectionKey`;
- metadata legada explícita continua operacional para o provedor original;
- ausência da credencial canônica falha fechado sem probing de slots legados;
- CI Quality Gate e Windows Desktop Runtime Test devem passar no mesmo head antes do merge.
