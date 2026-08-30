# Arquitetura aprovada — Conexão de IA e Vault Nisti

Status: **planejamento aprovado; implementação ainda não iniciada**.

Este documento registra as decisões funcionais e técnicas aprovadas para as próximas duas etapas do Nisti Marketing.

## Decisões consolidadas

- somente uma conexão de IA pode ficar ativa por vez;
- a entrada da conexão começa pela chave, sem exigir a escolha antecipada do provedor quando a identificação for segura;
- a chave só pode ser confirmada por uma resposta do endpoint oficial do provedor;
- modelos permanecem ocultos até a chave ser confirmada;
- cada modelo precisa passar por um teste antes de receber o estado `CONFIRMADO`;
- remover ou substituir a chave revoga provedor, modelos e validações anteriores;
- uma nova chave sempre reinicia o procedimento completo;
- não haverá fallback automático entre provedores;
- o Obsidian usará um Vault dedicado, criado e administrado pelo Nisti;
- o Nisti não alterará automaticamente plugins ou configurações internas de `.obsidian`;
- a IA propõe e estrutura conteúdo, mas não promove sugestões para fatos, compromissos ou publicações sem confirmação do usuário.

---

# Etapa 1 — Conexão inteligente de uma IA

## Objetivo

Receber uma chave, identificar com segurança um provedor suportado, confirmar a credencial no servidor oficial, descobrir modelos compatíveis e ativar somente um modelo testado.

## Estados da conexão

1. `SEM_CHAVE`
2. `ANALISANDO_LOCALMENTE`
3. `PROVEDOR_POSSIVEL`
4. `AGUARDANDO_CONFIRMACAO_DE_PROVEDOR`, quando o formato for ambíguo
5. `VALIDANDO_CREDENCIAL`
6. `CHAVE_INVALIDA`, `SEM_PERMISSAO`, `LIMITE_OU_COTA` ou `PROVEDOR_INDISPONIVEL`
7. `CHAVE_CONFIRMADA`
8. `DESCOBRINDO_MODELOS`
9. `AGUARDANDO_MODELO`
10. `VALIDANDO_MODELO`
11. `CONEXAO_ATIVA`

## Identificação segura

O sistema manterá um registro extensível de provedores com:

- identificador e nome público;
- padrões locais conhecidos da chave;
- endpoint oficial;
- forma de autenticação;
- operação de descoberta de modelos;
- capacidades exigidas pelo Nisti;
- adaptador de geração e respostas estruturadas.

OpenAI e Gemini serão os primeiros adaptadores.

Uma análise de prefixo é apenas uma hipótese. Quando existir exatamente um candidato seguro, a chave será enviada somente ao endpoint oficial correspondente. Quando o formato for ambíguo, nenhum envio ocorrerá até o usuário escolher o provedor.

Uma chave desconhecida não pode revelar sozinha onde deve ser usada. A conexão personalizada exigirá nome do provedor e URL oficial, com HTTPS, proteção contra SSRF e confirmação explícita.

## Descoberta e confirmação de modelos

Depois da chave ser aceita:

1. consultar a lista de modelos acessíveis;
2. excluir modelos incompatíveis com geração de texto estruturado;
3. mostrar somente os modelos restantes;
4. permitir a seleção de um modelo;
5. executar uma geração mínima com schema controlado;
6. ativar a conexão somente se a resposta for válida.

O sistema pode confirmar acesso atual, mas não deve afirmar saldo, crédito futuro ou disponibilidade permanente.

## Troca de IA

Ao escolher `Trocar IA`, o sistema deve:

1. desativar imediatamente a conexão;
2. remover a chave do armazenamento seguro;
3. apagar a lista de modelos descoberta;
4. apagar provedor e modelo confirmados;
5. invalidar timestamps e capacidades anteriores;
6. voltar para `SEM_CHAVE`;
7. exigir o procedimento completo para a próxima chave.

Trocar somente o modelo preserva a chave confirmada, mas exige testar e confirmar o novo modelo.

## Segurança da credencial

- a chave fica no renderer apenas durante a digitação;
- depois do envio, o processo confiável do Electron assume a credencial;
- a chave é protegida por `safeStorage`;
- funções do produto usam um identificador da conexão, não a chave bruta;
- a chave não entra em logs, auditoria, backup, Markdown ou `localStorage`;
- respostas de erro são sanitizadas;
- alterar a chave invalida imediatamente a conexão anterior;
- o sistema nunca envia uma chave a múltiplos provedores para tentar descobrir onde ela funciona.

## Critérios de aceite

- chave Gemini reconhecida e confirmada sem seleção antecipada quando não houver ambiguidade;
- chave OpenAI reconhecida e confirmada sem envio exploratório a outros provedores;
- chave ambígua exige seleção antes de qualquer chamada externa;
- chave inválida não libera modelos;
- modelos ficam ocultos antes da confirmação;
- modelo ativo passa por teste estruturado;
- somente uma conexão permanece ativa;
- troca de chave remove todos os dados de validação anteriores;
- nenhuma credencial aparece em persistência insegura ou telemetria.

---

# Etapa 2 — Vault dedicado administrado pelo Nisti

## Objetivo

Criar, validar, ler e manter a estrutura necessária para o funcionamento do Nisti e sua interoperabilidade com o Obsidian, sem exigir montagem manual do Vault.

## Estrutura canônica

- `00_Base`
- `00_Inbox`
- `01_Estrategia`
- `02_Produtos`
- `03_Conteudos`
- `04_Campanhas`
- `05_Reunioes`
- `06_Influenciadores_UGC`
- `07_Pesquisas`
- `08_Aprendizados`
- `99_Templates`

O diretório interno `.nisti` armazenará apenas o manifesto versionado da estrutura. O índice SQLite continuará fora do Vault para evitar conflitos de sincronização.

## Bootstrap do Vault

1. selecionar ou criar uma pasta destinada ao Vault Nisti;
2. verificar se a pasta está vazia ou já pertence ao Nisti;
3. criar as pastas canônicas ausentes;
4. criar `.nisti/manifest.json`;
5. criar templates versionados;
6. iniciar o Onboarding da Base Inicial;
7. executar indexação incremental;
8. emitir relatório de integridade.

O procedimento será idempotente: repetir a operação não pode duplicar nem sobrescrever notas existentes.

## Schema comum das notas gerenciadas

- `id`
- `type`
- `workflow_status`
- `epistemic_status`
- `created_at`
- `updated_at`
- `source_ids`
- `tags`
- `schema_version`
- `owner`

`workflow_status` descreve o andamento operacional. `epistemic_status` descreve a confiabilidade da informação. Um não pode alterar automaticamente o outro.

## Templates previstos

- Base Inicial;
- fonte de conhecimento;
- ideia;
- roteiro;
- campanha;
- reunião;
- resultado e aprendizado.

## Regras de leitura e escrita

- no desktop, o sistema de arquivos é a fonte primária;
- a REST API do Obsidian é opcional;
- o tipo da nota vem do frontmatter, não do nome do arquivo;
- conteúdo não classificado entra em `00_Inbox`;
- criação nunca sobrescreve um arquivo existente;
- atualização gerenciada é atômica;
- campos desconhecidos do usuário são preservados;
- `.obsidian`, `.nisti`, arquivos temporários e destinos externos não são indexados;
- alterações feitas pelo Obsidian são detectadas incrementalmente;
- caminhos inseguros, travessia de diretório e symlinks externos são bloqueados.

## Auditoria e reparo

A verificação do Vault deve identificar:

- pastas ausentes;
- manifesto ausente ou incompatível;
- templates ausentes;
- Base Inicial incompleta;
- duplicações canônicas;
- problemas de permissão;
- índice desatualizado.

`Reparar estrutura` pode recriar somente elementos gerenciados ausentes. O sistema não pode apagar, mover ou renomear arquivos pessoais automaticamente.

---

# Como a IA opera dentro do Nisti

## Princípio

A IA é um processador assistido, não uma autoridade autônoma. Ela pode analisar fontes, propor estruturas e gerar rascunhos. Escritas operacionais ou promoções de status exigem regras determinísticas e, quando aplicável, confirmação humana.

## Pipeline de uma operação

1. **Solicitação explícita** — uma ação do usuário inicia a operação.
2. **Verificação de pré-condições** — conexão confirmada, modelo confirmado, Base pronta e dados obrigatórios presentes.
3. **Consulta do índice** — o Nisti pesquisa o `KnowledgeIndex` por relevância.
4. **Seleção de contexto** — somente trechos necessários são selecionados, com limites por fonte e por requisição.
5. **Sanitização** — segredos, caminhos absolutos e instruções potencialmente maliciosas são neutralizados.
6. **Construção do prompt** — instrução do sistema, tarefa, contexto, estados epistemológicos e schema de saída.
7. **Chamada do provedor** — somente a conexão ativa e o modelo confirmado são usados.
8. **Validação da resposta** — JSON/schema, campos obrigatórios, limites e regras do domínio.
9. **Apresentação da proposta** — fontes, provedor e modelo realmente usados ficam visíveis.
10. **Confirmação ou ação determinística** — o usuário aprova quando a operação altera o fluxo de trabalho.
11. **Persistência canônica** — Obsidian para conhecimento, SQLite para calendário e armazenamento apropriado para cada entidade.
12. **Auditoria sem segredos** — resultado, fontes, modelo e horário podem ser registrados, nunca a chave.

## Operação por área

### Base

- o onboarding continua dirigido por respostas do usuário;
- a IA pode ajudar a organizar uma resposta, mas não inventa fatos;
- ausência permanece `PENDENTE`;
- hipótese permanece `HIPÓTESE` até confirmação explícita.

### Conhecimento

- resume, classifica e extrai informações de fontes selecionadas;
- preserva referência ao arquivo físico;
- não promove automaticamente conteúdo importado para `CONFIRMADO`;
- instruções encontradas dentro de documentos não substituem as regras do sistema.

### Criar

- recebe briefing explícito;
- consulta apenas fontes relevantes da Base;
- gera cinco ideias estruturadas;
- desenvolve roteiro a partir de uma ideia escolhida;
- mostra fontes, provedor e modelo utilizados;
- salvar e aprovar são ações separadas da geração.

### Planejar

- pode sugerir campanha, canais e organização editorial;
- não inventa data, horário, prioridade ou orçamento;
- somente escolhas explícitas entram no Calendário.

### Executar

- a IA pode sugerir ações para revisão;
- não executa tarefas, publicações ou automações sozinha;
- tarefas editoriais derivam deterministicamente do Calendário.

### Aprender

- analisa somente métricas e evidências registradas;
- valor ausente não vira zero;
- não cria tendência ou conclusão sem dados suficientes;
- aprendizados permanecem rastreáveis às evidências.

## Falha segura

Se conexão, contexto ou resposta não forem válidos:

- nenhuma gravação canônica é realizada;
- nenhum dado sintético é usado como fallback;
- a tela informa a causa e a ação necessária;
- o modo local continua disponível apenas para operações determinísticas suportadas.

---

# Ordem de implementação futura

1. registro de provedores e contrato de conexão única;
2. identificação e confirmação segura da chave;
3. descoberta e confirmação de modelos;
4. broker seguro da credencial;
5. migração da configuração atual;
6. testes reais de OpenAI e Gemini;
7. manifesto e taxonomia única do Vault;
8. bootstrap de pastas e templates;
9. consolidação de leitura, escrita e indexação;
10. auditoria, reparo e homologação ponta a ponta.

