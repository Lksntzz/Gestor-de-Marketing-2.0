# Nisti Marketing 3.1.1

Hotfix de conexão com o Obsidian Local REST API no desktop Windows.

## Correção principal

- O Electron agora aceita o certificado HTTPS autoassinado do Obsidian somente no endpoint local oficial `127.0.0.1:27124`, `localhost:27124` ou `[::1]:27124`.
- A política não altera a validação TLS global do processo e não usa `NODE_TLS_REJECT_UNAUTHORIZED=0` nem `rejectUnauthorized: false`.
- Demais erros de certificado continuam sendo rejeitados pelo aplicativo.

## Motivo

O Local REST API usa certificado autoassinado por padrão. No Nisti 3.1.0, isso podia impedir o `fetch` do renderer Electron mesmo com o plugin ativo, endpoint correto e API Key válida.

## Validação esperada

1. Obsidian aberto com Local REST API with MCP ativo.
2. Endpoint `https://127.0.0.1:27124`.
3. API Key válida.
4. O botão `Testar, Conectar e Salvar Obsidian` deve autenticar, criar/validar `Nisti Marketing/` e iniciar a sincronização.
