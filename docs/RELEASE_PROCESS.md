# Processo Oficial de Release — Nisti Marketing

Este documento define o processo estável de publicação do aplicativo Windows e do feed de auto-update.

## Princípios

- O `package.json` é a fonte oficial da versão.
- A versão deve usar SemVer estável `X.Y.Z`.
- O identificador interno exibido pelo app deve permanecer alinhado com `package.json`.
- Releases estáveis são publicadas neste mesmo repositório público.
- O cliente nunca recebe token do GitHub.
- Os assets oficiais ficam em GitHub Releases, não em Actions Artifacts.
- O instalador oficial é o NSIS `Nisti-Marketing-Setup-X.Y.Z.exe`.
- `latest.yml` e o `.blockmap` fazem parte obrigatória do feed do `electron-updater`.

## Antes do release

1. Atualize a versão em `package.json`.
2. Atualize `APP_VERSION` em `src/utils/reliability.ts` para o mesmo valor.
3. Não misture incremento de versão com mudanças funcionais quando o objetivo for apenas validar infraestrutura.
4. Execute ou aguarde a CI do `main` e exija sucesso em typecheck, testes, build, preload e backend smoke.

## Como publicar

O workflow oficial é `.github/workflows/release-windows.yml`.

Há dois gatilhos suportados:

### Opção A — tag

Crie/push uma tag `vX.Y.Z` que corresponda exatamente ao `package.json`.

Exemplo: package `2.2.0` → tag `v2.2.0`.

### Opção B — execução manual

No GitHub:

1. Abra **Actions**.
2. Selecione **Release Windows & Auto-Update**.
3. Clique em **Run workflow**.
4. Informe `vX.Y.Z` ou deixe em branco para usar a versão atual do `package.json`.

Branches `release-v*` não fazem parte mais do processo oficial.

## Gates obrigatórios

O workflow só publica se todas as etapas passarem:

1. validação SemVer e correspondência com `package.json`;
2. `bun run verify`;
3. smoke test do backend empacotado;
4. build Windows x64 com electron-builder;
5. geração de exatamente um Setup NSIS, `latest.yml` e `.blockmap`;
6. confirmação de que `latest.yml` referencia exatamente o nome real do Setup;
7. instalação silenciosa de teste do NSIS em diretório temporário;
8. publicação da GitHub Release;
9. validação pós-publicação dos nomes dos assets remotos.

O smoke NSIS aceita retry limitado somente para o access violation `0xC0000005` observado de forma transitória em runners Windows hospedados. Outros códigos de erro falham imediatamente; três access violations consecutivos também bloqueiam a release.

## Auto-update

O aplicativo instalado consulta o feed do GitHub por meio de `electron-updater`.

Fluxo esperado:

`versão instalada → verificar → atualização disponível → download → atualização pronta → reiniciar e atualizar → instalação silenciosa → reabrir na nova versão`

O updater deve preservar `userData`, Vault do Obsidian, SQLite e configurações locais. O cleanup antes da instalação deve permanecer idempotente para evitar fechamento duplicado de banco/processos.

## Authenticode

O workflow suporta assinatura quando os secrets abaixo estiverem configurados no repositório:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

Sem esses secrets, o instalador é gerado sem assinatura e o SmartScreen pode alertar o usuário.

Regras de segurança:

- nunca commitar certificado, senha ou token;
- usar certificado de code signing emitido para a organização responsável;
- manter a chave privada apenas em secret/serviço seguro;
- após configurar assinatura, validar Authenticode no pipeline e bloquear release se a assinatura não for válida.

## Pós-release

Após publicar:

1. confirme que a Release não é draft nem prerelease;
2. confirme presença de `latest.yml`, Setup e `.blockmap`;
3. confirme que a versão instalada anterior detecta a nova versão;
4. execute ao menos um ciclo real de update em Windows após mudanças no updater, NSIS, preload, IPC, SQLite ou bootstrap;
5. não retenha cópias duplicadas dos instaladores em Actions Artifacts.

## Histórico de validação

O ciclo real `2.1.10 → 2.1.11` foi validado em Windows usando o próprio updater do Nisti Marketing, incluindo download, cleanup, instalação silenciosa, reinicialização e abertura na nova versão.
