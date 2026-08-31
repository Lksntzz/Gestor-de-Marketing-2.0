# Etapa 1 — Contratos e migração da configuração de IA

Status: **pronta para implementação após merge da baseline arquitetural**.

## Objetivo

Criar o contrato de domínio e a migração compatível necessários para substituir gradualmente a configuração multi-provedor legada por uma única conexão de IA, sem ainda realizar identificação externa de chave, descoberta de modelos ou redesenho completo da interface.

## Escopo obrigatório

### Contrato de domínio

Deve existir um tipo dedicado para a conexão de IA contendo, no mínimo:

- versão do schema;
- `connectionId` opcional enquanto não confirmada;
- `status` explícito;
- provedor candidato/confirmado quando aplicável;
- modelo selecionado/confirmado quando aplicável;
- capacidades confirmadas quando aplicável;
- timestamps de validação quando aplicável;
- referência ao segredo sem chave bruta.

### Configuração persistida

O objeto persistido não pode conter:

- API key bruta;
- authorization header;
- token do provedor;
- cópia reversível da credencial.

### Migração legada

A migração deve reconhecer metadados atuais, incluindo:

- `aiProvider`;
- `aiModel`.

Regras:

1. migração é idempotente;
2. entrada ausente/inválida falha para estado seguro;
3. provedor legado não confirmado não vira automaticamente `CONEXAO_ATIVA`;
4. modelo legado não confirmado não vira modelo validado;
5. nenhuma credencial legada é apagada enquanto consumidores antigos ainda dependerem dela;
6. nenhuma chave é copiada para configuração comum;
7. a migração registra versão de schema suficiente para não reaplicar transformações destrutivas.

### Compatibilidade

Até a conclusão do novo orquestrador:

- funções existentes não podem perder acesso à credencial de que ainda dependem;
- UI antiga não pode ser apresentada falsamente como conexão confirmada pelo novo contrato;
- novos contratos devem coexistir temporariamente com os campos legados necessários, com dívida explicitamente marcada para remoção.

## Fora do escopo

A Etapa 1 não implementa:

- chamada a endpoint de provedor para confirmar chave;
- análise de prefixo/formato como decisão final;
- descoberta/listagem de modelos;
- teste estruturado de modelo;
- troca completa de IA;
- remoção física das chaves legadas;
- provedor customizado;
- Chat no Vault;
- camada completa de linguagem natural;
- manifesto novo do Vault.

## Casos de teste mínimos

1. sem configuração legada → estado `SEM_CHAVE`/não confirmado;
2. `gemini` + modelo legado → rascunho migrado, nunca `CONEXAO_ATIVA`;
3. `openai` + modelo legado → rascunho migrado, nunca `CONEXAO_ATIVA`;
4. provedor desconhecido → configuração rejeitada/normalizada para estado seguro;
5. modelo vazio → permitido como metadado ausente;
6. executar migração duas vezes → mesmo resultado;
7. chave bruta presente por engano no payload comum → removida/rejeitada antes da persistência;
8. backup/exportação → novo contrato sem segredo;
9. parser de schema inválido → fail-closed sem inventar provedor/modelo;
10. configuração nova válida → parser round-trip preserva somente campos permitidos.

## Gate de conclusão

A Etapa 1 só pode ser marcada como concluída quando:

- contrato estiver isolado do componente React;
- schema/validação estiver centralizado;
- migração idempotente possuir testes;
- nenhum segredo novo aparecer em `localStorage`, backup, Markdown ou config comum;
- `bun test`, testes Node, TypeScript e build estiverem verdes;
- Windows runtime continuar verde;
- revisão confirmar que nenhuma chamada externa de identificação/descoberta foi introduzida antecipadamente.

## Próxima etapa autorizada depois do gate

**Etapa 2 — análise segura de chave e descoberta de modelos**, seguindo ADR-001. Ela deve ser implementada em PR independente.
