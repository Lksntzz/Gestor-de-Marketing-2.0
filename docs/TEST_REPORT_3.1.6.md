# Relatório de testes — Nisti Marketing 3.1.6

Este arquivo consolida os defeitos encontrados nos testes manuais antes da publicação da 3.1.7.

## Teste 1 — Persistência / reconexão do Obsidian

- Status: **FALHOU**
- Chave do Obsidian preservada: sim
- Endpoint preservado: sim
- Conexão manual por “Testar conexão”: funciona
- Reconexão automática após fechar e abrir o Nisti: não funciona na 3.1.6
- Correção preparada na branch 3.1.7: retry automático com backoff, reconexão após perda de sessão e sem depender de seleção física do Vault no fluxo REST-first.

## Demais testes

Aguardando relatório manual consolidado antes de publicar a 3.1.7.
