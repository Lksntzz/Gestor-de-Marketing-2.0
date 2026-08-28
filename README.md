# Nisti Marketing

Aplicativo desktop local-first para gestão de marketing da Nisti Print, integrado ao Obsidian e com suporte a IA multi-provedor.

## Download para Windows

Os instaladores oficiais são publicados na aba **Releases** deste repositório.

Para instalação normal, use sempre o arquivo:

`Nisti-Marketing-Setup-X.Y.Z.exe`

Depois da primeira instalação, novas versões estáveis são detectadas pelo atualizador interno do aplicativo em **Configuração → Sistema**. O fluxo validado é: verificar atualização → baixar → reiniciar e atualizar → reabrir na nova versão.

O feed do auto-update usa os arquivos publicados em cada Release:

- `latest.yml`
- `Nisti-Marketing-Setup-X.Y.Z.exe`
- `Nisti-Marketing-Setup-X.Y.Z.exe.blockmap`

## Release Windows

O pipeline oficial está em `.github/workflows/release-windows.yml`.

Uma release estável pode ser iniciada por:

- tag Git no formato `vX.Y.Z`; ou
- execução manual em **Actions → Release Windows & Auto-Update → Run workflow**.

A versão solicitada deve corresponder exatamente ao campo `version` do `package.json`. Antes de publicar, o workflow executa typecheck, testes, build, smoke test do backend, geração NSIS, validação do `latest.yml`, instalação silenciosa de teste no runner Windows e validação dos assets publicados.

Branches `release-v*` não fazem mais parte do processo oficial.

O procedimento completo está documentado em [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md).

## Assinatura de código

O pipeline aceita assinatura Authenticode quando os secrets `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD` estiverem configurados. Sem certificado, o build continua funcional, porém o Windows SmartScreen pode exibir aviso ao usuário.

Nenhum certificado, senha ou token de assinatura deve ser armazenado no código-fonte.

## Desenvolvimento local

```bash
bun install
bun run dev
```

Para validar a aplicação antes de um release:

```bash
bun run verify
```

Para gerar o instalador Windows localmente:

```bash
bun run electron:build
```

Os executáveis locais são gerados em `dist-electron/`.
