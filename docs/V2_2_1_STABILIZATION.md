# Estabilização — Nisti Marketing 2.2.1

Status: **validação local concluída; ainda não publicar**.

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
- Bun fixado em `1.2.23` para builds reprodutíveis.

## Gates antes da tag

- [x] TypeScript sem erros.
- [x] Testes Bun e Node verdes.
- [x] Build e smoke do backend verdes.
- [ ] CI Quality Gate verde no head final.
- [ ] Windows Electron smoke verde no head final.
- [ ] Teste manual de atualização 2.2.0 → 2.2.1 em Windows.
- [ ] Decisão explícita de publicar `v2.2.1`.

Authenticode continua acompanhado separadamente pela Issue #20 e não deve ser tratado como concluído sem certificado e assinatura verificável no executável.
