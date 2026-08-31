# Etapa 1 — Notas de implementação

Esta nota acompanha a implementação dos contratos e da migração da conexão única de IA.

## Implementado

- contrato `PersistedAIConnectionState` com schema versionado e estados explícitos;
- parser estrito/fail-closed;
- migração dos campos legados `aiProvider` e `aiModel` usando somente presença booleana das credenciais;
- credenciais continuam nos slots legados protegidos enquanto os consumidores antigos dependem delas;
- metadata V1 separado das credenciais em `localStorage`;
- persistência validada que rejeita campos desconhecidos/segredos brutos;
- migração no startup desktop;
- backup inclui apenas metadata secret-free;
- restauração de backup rebaixa qualquer confiança de outra máquina antes de persistir;
- backups legados continuam importáveis sem fabricar conexão nova;
- testes de contrato, migração, persistência e backup.

## Deliberadamente não implementado nesta etapa

- chamada a Gemini/OpenAI para identificar a chave;
- descoberta ou listagem de modelos;
- validação remota de modelo;
- troca completa dos consumidores legados para um segredo único;
- remoção de `geminiApiKey` / `openaiApiKey`;
- UI nova de conexão;
- fallback automático entre provedores;
- Chat no Vault;
- camada completa de linguagem natural.

## Compatibilidade temporária

`aiProvider`, `aiModel`, `geminiApiKey` e `openaiApiKey` continuam existindo porque o runtime 2.2.1 ainda possui consumidores legados. O metadata V1 é a trilha de migração para a conexão única e não deve ser interpretado como autorização para remover esses campos antes da troca dos consumidores.

## Gate

A Etapa 1 só deve ser marcada como concluída depois que a PR correspondente passar CI Quality Gate e Windows Desktop Runtime Test no head final.
