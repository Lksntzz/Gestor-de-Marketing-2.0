# Relatório de testes — Nisti Marketing 3.1.6

Este arquivo consolida os defeitos encontrados nos testes manuais antes da publicação da 3.1.7.

## Teste 1 — Persistência / reconexão do Obsidian

- Status: **FALHOU**
- Chave do Obsidian preservada: sim
- Endpoint preservado: sim
- Conexão manual por “Testar conexão”: funciona
- Reconexão automática após fechar e abrir o Nisti: não funciona na 3.1.6
- Correção preparada na branch 3.1.7: retry automático com backoff, reconexão após perda de sessão e sem depender de seleção física do Vault no fluxo REST-first.

## Teste 2 — Leitura manual de Markdown

- Status: **APROVADO**
- Arquivo criado diretamente no Obsidian apareceu no Nisti: sim
- Conteúdo de controle foi lido corretamente: sim
- Duplicação: não observada
- Pasta `00_Inbox`: única na navegação durante o teste

## Teste 3 — Alteração e sincronização automática

- Status: **APROVADO**
- Alteração feita diretamente no Markdown do Obsidian apareceu no Nisti automaticamente: sim
- Não foi necessário clicar em “Sincronizar agora”.

## Teste 4 — Exclusão e reconciliação automática

- Status: **APROVADO**
- Arquivo apagado no Obsidian desapareceu do Nisti automaticamente: sim
- Não foi necessário clicar em “Sincronizar agora”.

## Teste 5 — Gravação do Nisti para o Obsidian

- Status: **FALHOU / fluxo inconsistente**
- A análise e revisão concluíram normalmente.
- A interface exibiu “Gravação confirmada pelo Obsidian”.
- Ao clicar em “Abrir no Obsidian”, o Obsidian exibiu `Vault not found` porque a URI foi construída com o placeholder `vault=Vault ativo`, não com o nome real do Vault.
- Após esse erro, o usuário observou o Obsidian como desconectado no Nisti.
- O usuário confirmou que a nota `Teste escrita Nisti` já existia e que o conteúdo novo apareceu dentro dessa nota existente, em vez de haver confirmação inequívoca de um novo arquivo separado no destino esperado.

### Defeitos registrados a partir do Teste 5

1. **URI inválida para “Abrir no Obsidian”**
   - `apiConfig.vaultName` pode receber o fallback `Vault ativo`.
   - Esse fallback é passado para `buildObsidianOpenUri(...)` como se fosse um nome real de Vault.
   - Resultado: `obsidian://open?vault=Vault%20ativo&...` e erro `Vault not found`.

2. **Falso positivo de gravação confirmada**
   - O fluxo pode mostrar sucesso após um commit local sem validar por leitura no Vault REST ativo que o Markdown esperado realmente existe no caminho esperado.
   - A 3.1.7 deve usar confirmação pós-gravação (read-after-write) antes de apresentar “Gravação confirmada pelo Obsidian”.

3. **Colisão/roteamento inconsistente de nota**
   - Um novo conhecimento não deve ser silenciosamente direcionado para uma nota pré-existente.
   - A 3.1.7 deve detectar colisão contra o Vault ativo e usar nome único explícito ou bloquear/solicitar decisão; nunca sobrescrever/anexar silenciosamente.

4. **REST-first deve ser a autoridade de gravação**
   - O fluxo de Adicionar conhecimento não deve preferir o caminho físico somente porque `getVaultPath()` está disponível.
   - A gravação e a confirmação devem estar alinhadas com o mesmo Vault conectado pela Local REST API. O filesystem físico fica como fallback avançado/compatibilidade, não como confirmação primária.

5. **Queda de sessão após erro de abertura**
   - O erro de URI não deve derrubar a autorização/runtime do Obsidian.
   - Mesmo em falha transitória, a reconexão automática da 3.1.7 deve recuperar a sessão sem intervenção manual.

## Publicação

A 3.1.7 permanece em branch/PR draft. Nenhuma release deve ser publicada até o relatório manual estar completo e todas as correções passarem por regressão, CI, Electron real no Windows, instalador e teste de upgrade.
