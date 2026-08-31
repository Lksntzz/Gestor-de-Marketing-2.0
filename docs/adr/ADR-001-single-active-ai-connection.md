# ADR-001 — Uma única conexão de IA ativa

Status: **Aceito**

Data: 31/08/2026

## Contexto

O produto existente suporta OpenAI e Gemini por configuração de provedor e mantém credenciais separadas por provedor. A arquitetura futura chegou a considerar múltiplas conexões e fallback automático.

Esse modelo aumenta o número de estados possíveis, torna a origem efetiva de uma resposta menos previsível e cria risco de tratamento incorreto de credenciais caso uma chave seja testada exploratoriamente em provedores diferentes.

## Decisão

O Nisti Marketing terá somente **uma conexão de IA ativa por vez**.

Uma conexão válida é composta por:

- `connectionId` interno;
- provedor confirmado;
- referência segura para uma única credencial;
- modelo escolhido e confirmado;
- capacidades validadas;
- estado explícito da conexão;
- timestamps de confirmação/teste quando aplicável.

A chave bruta não faz parte do objeto de domínio persistido no estado comum da aplicação.

Trocar a chave:

1. desativa a conexão atual;
2. invalida provedor, modelos, capacidades e validações;
3. remove a credencial anterior do armazenamento seguro quando a troca for efetivada;
4. reinicia o processo completo de confirmação.

Trocar somente o modelo preserva a credencial/provedor confirmados, mas exige novo teste do modelo.

## Estados previstos

- `SEM_CHAVE`
- `ANALISANDO_LOCALMENTE`
- `PROVEDOR_POSSIVEL`
- `AGUARDANDO_CONFIRMACAO_DE_PROVEDOR`
- `VALIDANDO_CREDENCIAL`
- `CHAVE_INVALIDA`
- `SEM_PERMISSAO`
- `LIMITE_OU_COTA`
- `PROVEDOR_INDISPONIVEL`
- `CHAVE_CONFIRMADA`
- `DESCOBRINDO_MODELOS`
- `AGUARDANDO_MODELO`
- `VALIDANDO_MODELO`
- `CONEXAO_ATIVA`

Estados de erro não podem ser convertidos silenciosamente em conexão válida.

## Segurança

- uma chave nunca é enviada a múltiplos provedores para descobrir onde funciona;
- análise de formato é apenas local e produz candidatos, não confirmação;
- formato ambíguo exige escolha do provedor antes de qualquer transmissão;
- confirmação ocorre somente no endpoint autorizado do provedor selecionado;
- credencial deve permanecer em `safeStorage`/processo confiável;
- logs, auditoria, backup e Markdown não recebem a chave;
- custom provider, se introduzido futuramente, exige ADR/critério próprio de HTTPS e SSRF.

## Migração

A introdução do novo contrato deve ser compatível por etapas.

A Etapa 1 pode reconhecer metadados legados (`aiProvider`, `aiModel`) para formar um rascunho de migração, mas **não pode apagar as credenciais legadas enquanto o renderer e os consumidores existentes ainda dependerem delas**.

A remoção dos nomes de segredo legados e a consolidação física da credencial só ocorre quando o novo orquestrador estiver integrado e coberto por testes.

## Consequências

Positivas:

- estado mais simples e auditável;
- menor superfície para vazamento de chave;
- respostas associadas a provedor/modelo conhecidos;
- troca de IA explícita e reproduzível.

Trade-offs:

- não há failover automático entre provedores;
- indisponibilidade do provedor ativo exige ação explícita do usuário;
- migração precisa preservar compatibilidade até o fluxo novo estar completo.

## Alternativas rejeitadas

- múltiplas IAs ativas simultaneamente;
- provedor primário + fallback automático;
- enviar uma chave a vários endpoints até algum aceitá-la;
- persistir chave no estado normal do React, `localStorage`, Markdown ou backup.
