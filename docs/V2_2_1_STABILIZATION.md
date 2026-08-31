# Estabilização — Nisti Marketing 2.2.1

Status: **código em estabilização; não publicar antes dos gates de release**.

## Objetivo

Corrigir riscos identificados depois da publicação da 2.2.0 sem ampliar o escopo funcional principal.

## Alterações

- renderer Electron restrito ao backend em loopback; o fallback `dist/index.html` permanece sem acesso a IPC;
- janelas e navegações externas bloqueadas no Electron e encaminhadas somente para HTTPS ou `obsidian:`;
- todos os IPCs validam frame principal e origem confiável antes de acessar secrets, Vault, SQLite ou updater;
- CSP aplicada pelo backend e pelo fallback `file://`;
- IDs fallback de notas determinísticos por caminho, sem `Date.now()`;
- persistência de configuração propaga falhas e não confirma uma gravação que não aconteceu;
- Base Inicial incompleta abre a área Base antes do Command Center;
- geração criativa alinhada ao requisito de cinco ideias;
- transportes criativos legados sem sessão e a porta fixa `localhost:3000` removidos;
- probe Windows abre o Electron e comprova renderer React, preload e backend local integrado;
- Bun fixado em `1.2.23` para builds reprodutíveis;
- pipeline de release valida upgrade do instalador estável anterior para a nova versão, preservação do `userData`, versão instalada e runtime Electron antes de publicar.

## Gates antes da tag/release

- [x] TypeScript sem erros na validação local registrada pela PR.
- [x] Testes Bun e Node verdes na validação local registrada pela PR.
- [x] Build e smoke do backend verdes na validação local registrada pela PR.
- [ ] CI Quality Gate verde no head final.
- [ ] Windows Electron smoke verde no head final.
- [ ] Pipeline de release comprovar upgrade do instalador da release estável anterior para `2.2.1` antes da etapa de publicação.
- [ ] Decisão explícita de publicar `v2.2.1`.

## Validação do auto-update real

A 2.2.0 de produção usa o feed estável do GitHub Releases e configura `allowPrerelease = false`. Releases `draft` ou `prerelease` não ficam disponíveis para esse cliente. Por isso, um teste real de descoberta/download pelo `electron-updater` da 2.2.0 para a 2.2.1 não pode ocorrer antes de a 2.2.1 existir no feed estável sem alterar o cliente já distribuído.

A estratégia adotada separa os riscos:

1. **antes de publicar:** CI, smoke do Electron, validação de `latest.yml` e upgrade real do NSIS da release estável anterior para o novo instalador, com preservação de `userData`;
2. **imediatamente após publicar:** executar um canário em uma instalação real 2.2.0 usando o fluxo normal `Verificar atualização → download → instalar → reabrir` e confirmar versão, Vault, configuração e dados locais;
3. se o canário falhar, bloquear qualquer promoção adicional e tratar como incidente de release; clientes já atualizados exigirão correção em versão superior porque downgrade automático permanece desabilitado.

Para releases futuras, um canal canário separado deve ser considerado se for necessário provar o fluxo completo do `electron-updater` antes de expor uma versão ao canal estável.

## Authenticode

Authenticode continua acompanhado separadamente pela Issue #20 e não deve ser tratado como concluído sem certificado e assinatura verificável no executável.
