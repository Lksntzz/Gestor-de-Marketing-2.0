# Nisti Marketing 2.0 — Stabilization Plan

Base: `main` commit `a949263eef37513d5997e339f4b862baa04eb1ea`.

## Estado atual

- [x] TypeScript volta a compilar.
- [x] Testes automatizados atualizados para 2.0.0.
- [x] Build web/backend/Electron volta a concluir no CI.
- [x] `package.json` e `APP_VERSION` alinhados em `2.0.0`.
- [x] Identidade base padronizada como **Nisti Marketing**.
- [x] Fontes do protótipo removidas; tipografia volta a ser a do projeto.
- [x] Criptografia web fail-closed restaurada com AES-GCM.
- [x] Backend de produção volta a usar build self-contained com Vite/PDF carregados sob demanda.
- [x] Assistente de campanhas recompilado sem defaults comerciais fictícios.

## Próximas etapas

- [ ] Gate único de conexão Obsidian: sem REST + Vault validado, sem leitura/gravação do banco de conhecimento.
- [ ] Migrar `process-knowledge` para cliente autenticado único e remover `fetch` direto.
- [ ] Sincronizar recursivamente Markdown, texto, PDF e imagens do Vault.
- [ ] Remover dados fictícios remanescentes de tarefas, histórico, aprendizados e fallbacks do backend.
- [ ] Padronizar título/menu Electron como Nisti Marketing e remover menu nativo padrão.
- [ ] Atualizar workflow de release para v2.0.0 e adicionar smoke test Windows do backend empacotado.
- [ ] Limpar scripts temporários `fix_*.cjs` e `patch_*.cjs` da raiz.
- [ ] Validar NSIS + Portable em Windows antes de qualquer merge/release.
