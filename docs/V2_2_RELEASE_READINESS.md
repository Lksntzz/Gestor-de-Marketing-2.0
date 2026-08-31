# Release Readiness — Nisti Marketing 2.2.0

Status: **publicado em 30/08/2026 no commit `b7f51b4`**.

Este documento registra os gates técnicos e de produto para a primeira release do fluxo consolidado do Nisti Marketing após a auditoria de ferramentas e a refatoração do V1.

## Escopo funcional da 2.2.0

Fluxo principal:

`Início → Base → Criar → Planejar → Executar → Aprender`

Cadeia operacional protegida:

`Base Inicial → Briefing → Ideia → Conteúdo aprovado → Calendário → Tarefa editorial → Publicação → Resultado → Aprendizado`

Principais entregas desde 2.1.11:

- Onboarding da Base Inicial em `00_Base`, com estados `CONFIRMADO`, `HIPÓTESE` e `PENDENTE`;
- Base/Cofre como fonte documental principal, com ingestão `Arquivo | Link | Texto`;
- Command Center reduzido a próxima ação, semana e bloqueios reais;
- Assistente de Briefing integrado a `Criar`;
- fluxo contínuo `Briefing → Ideias → Desenvolver → Aprovar`;
- Biblioteca de criação derivada de ideias, roteiros e SQLite editorial, sem banco paralelo;
- Calendário semanal como fonte de verdade para data, horário, prioridade e estado editorial;
- reconciliação entre item editorial e tarefa `task-ed-*`;
- Execução local independente da conexão com Obsidian para tarefas manuais;
- Aprender com resultados esparsos, sem converter métrica ausente em zero;
- backup/restauração versionados e reset fail-closed;
- defaults operacionais legados neutralizados para não inventar prazo, horário, prioridade ou lembrete;
- revisão de candidatos a tarefa no Cofre sem criação automática;
- handoff `Criar → Planejar` preservando `scriptId` e delegando decisões de agenda ao Calendário.

## Gates obrigatórios antes da publicação

### Produto e dados

- [x] Navegação principal corresponde ao mapa final aprovado.
- [x] Base Inicial canônica possui proteção contra sobrescrita e duplicação.
- [x] Conteúdo gerado por IA permanece `HIPÓTESE`; aprovação de workflow não vira confirmação factual.
- [x] Nenhum fluxo principal inventa data, horário, prioridade, lembrete ou métrica ausente.
- [x] Calendário é a fonte de verdade da publicação.
- [x] Tarefas editoriais são reconciliadas e não podem divergir silenciosamente do Calendário.
- [x] Backup v2 cobre o workspace necessário à refatoração e não exporta credenciais.
- [x] Reset de fábrica protege o Vault físico e falha fechado quando a limpeza local crítica não é confirmada.

### Qualidade automatizada

- [x] TypeScript sem erros no último checkpoint funcional antes do bump.
- [x] Testes Bun cobrindo domínio, regressões e fluxo V1 integrado.
- [x] Testes Node cobrindo integração desktop/filesystem/SQLite.
- [x] Build Web/backend/Electron validado pela Quality Gate.
- [x] Smoke do backend empacotado validado pela Quality Gate.
- [x] Quality Gate verde no commit exato da versão 2.2.0.
- [x] Windows Desktop Runtime Test verde no commit exato da versão 2.2.0.

Os dois itens acima são atualizados pelo CI após o commit de preparação da versão. A publicação não deve ocorrer se qualquer um falhar.

## Distribuição e updater

- [x] `package.json` é a fonte oficial da versão.
- [x] `APP_VERSION` deve corresponder exatamente ao `package.json`.
- [x] release oficial usa NSIS `Nisti-Marketing-Setup-X.Y.Z.exe`.
- [x] `latest.yml` e `.blockmap` são obrigatórios.
- [x] workflow de release valida SemVer, assets locais, instalação silenciosa e feed remoto.
- [x] updater stable não aceita downgrade nem prerelease.
- [x] ciclo real 2.1.10 → 2.1.11 já validou download, instalação silenciosa e reabertura.

A release **`v2.2.0`** foi publicada. A próxima correção prevista é **`v2.2.1`**; não republicar nem mover a tag `v2.2.0`.

## Authenticode

A Issue #20 permanece aberta. A ausência de certificado não impede o funcionamento nem a criação da release: o workflow gera o instalador unsigned quando os secrets não existem. O efeito conhecido é possível alerta do Windows SmartScreen.

Classificação para 2.2.0: **não bloqueante**, desde que o risco de UX do SmartScreen seja aceito para esta distribuição.

## Compatibilidade legada

`Automações` permanece somente como rota interna de compatibilidade. A navegação principal não a expõe. A tela legada executa apenas ações manuais, validadas e fail-closed; handlers antigos ainda presentes em `App.tsx` não são o executor usado pela tela legada atual.

A remoção física desses handlers é dívida técnica posterior e não deve ser misturada ao release se exigir reescrever o compositor central sem ganho de segurança em runtime.

## Registro do GO

A 2.2.0 recebeu tag/release após:

1. `package.json` e `APP_VERSION` estiverem em `2.2.0`;
2. Quality Gate e Windows Desktop Runtime Test estiverem verdes no mesmo head;
3. não existir regression crítica aberta no fluxo `Base → Criar → Planejar → Executar`;
4. decisão explícita de publicar `v2.2.0`.

Os quatro critérios foram atendidos e a atualização foi distribuída pelo GitHub Releases. Pendências posteriores pertencem à estabilização 2.2.1.
