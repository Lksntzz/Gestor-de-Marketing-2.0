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

## Motor automático de curadoria do Inbox

Depois que a conexão de IA e o Vault estiverem confirmados, o Nisti poderá iniciar um worker local de curadoria. Esse worker observa somente fontes novas ou alteradas e usa hash de conteúdo para não analisar o mesmo material repetidamente.

### Entradas suportadas

- texto digitado ou arquivo `.txt`/`.md`;
- PDF;
- imagem e captura de tela;
- página pública em HTTP/HTTPS;
- link de vídeo;
- arquivos explicitamente importados pelo usuário.

O tipo da fonte deve ser reconhecido por MIME, assinatura do arquivo e URL validada, não apenas pela extensão ou pelo nome.

### Estados do processamento

1. `DESCOBERTO`
2. `NA_FILA`
3. `ANALISANDO`
4. `CURADO`
5. `AGUARDANDO_REVISAO`
6. `FALHOU`

O estado, hash e versão do analisador ficam registrados para que reiniciar o aplicativo não duplique trabalhos nem notas.

### Pipeline de curadoria

1. preservar o original em `00_Inbox/Originais` ou manter referência segura ao arquivo já existente;
2. calcular hash e verificar duplicidade;
3. extrair texto e metadados disponíveis;
4. selecionar contexto relevante da Base Inicial;
5. enviar somente o material necessário ao modelo confirmado;
6. exigir uma resposta estruturada com resumo, fatos, hipóteses, pendências, tags, fontes e destino sugerido;
7. validar o resultado contra o schema e a taxonomia do Vault;
8. criar uma nota derivada na pasta canônica adequada;
9. marcar a nota como `PENDENTE` ou `HIPÓTESE`, nunca `CONFIRMADO` automaticamente;
10. registrar vínculo, hash, provedor e modelo usados;
11. encaminhar classificações ambíguas para `00_Inbox/Para_Revisar`.

### Roteamento por conteúdo

- informações sobre marca, posicionamento e público: `01_Estrategia`;
- produtos, especificações e ofertas: `02_Produtos`;
- ideias, referências criativas e roteiros: `03_Conteudos`;
- planos e materiais de campanha: `04_Campanhas`;
- atas, decisões e briefings: `05_Reunioes`;
- influenciadores, parceiros e UGC: `06_Influenciadores_UGC`;
- pesquisas, concorrência e mercado: `07_Pesquisas`;
- resultados, evidências e aprendizados: `08_Aprendizados`;
- conteúdo sem classificação segura: `00_Inbox/Para_Revisar`.

`00_Base` não recebe alterações automáticas vindas da curadoria. O sistema pode sugerir uma atualização da Base, mas a incorporação depende de confirmação explícita. `99_Templates` também não é um destino automático.

### Regras por tipo de fonte

#### Texto e Markdown

- preservar títulos, listas e referências;
- extrair resumo e pontos importantes;
- separar afirmações, hipóteses e pendências;
- preservar links internos e campos desconhecidos.

#### Imagem e captura de tela

- usar visão/OCR somente se o modelo confirmado declarar essa capacidade;
- preservar a imagem original;
- registrar texto visível, descrição objetiva e limitações de leitura;
- nunca inferir preço, identidade ou contexto não visível.

#### Página pública

- aceitar somente HTTP/HTTPS após validação contra SSRF;
- aplicar limite de tamanho, redirecionamentos e tempo;
- registrar URL, título, data de captura e hash;
- distinguir texto da página de interpretações feitas pela IA.

#### Link de vídeo

- registrar URL e metadados públicos disponíveis;
- analisar descrição ou transcrição somente quando realmente acessível e autorizada;
- se não houver transcrição, declarar `CONTEUDO_DO_VIDEO_NAO_ANALISADO`;
- nunca gerar um resumo do vídeo apenas a partir do título ou da miniatura;
- permitir que o usuário anexe uma transcrição ou arquivo compatível para análise completa.

### Proteções operacionais

- o original nunca é apagado nem movido silenciosamente;
- a nota curada mantém `source_id`, `source_hash` e localização da origem;
- a criação é idempotente por hash e versão do analisador;
- o worker não reprocessa notas geradas por ele próprio;
- nenhuma tarefa, campanha, publicação ou alteração da Base é criada automaticamente;
- falha de análise mantém a fonte no Inbox e não produz fallback sintético;
- operações e custos podem ser pausados pelo usuário;
- o processamento respeita limites de fila, tamanho, taxa e orçamento configurado;
- correções de pasta feitas pelo usuário ficam registradas para auditoria, mas não viram regra global sem confirmação.

### Critérios de aceite da curadoria

- texto novo gera uma nota rastreável na pasta correta;
- imagem ou print preserva o original e registra apenas informações visíveis;
- página pública registra origem e conteúdo realmente obtido;
- vídeo sem transcrição não recebe resumo inventado;
- item duplicado não gera nova análise ou nova nota;
- classificação insegura permanece em `00_Inbox/Para_Revisar`;
- nenhuma curadoria altera automaticamente `00_Base`;
- reiniciar o aplicativo preserva a fila e não duplica resultados;
- toda nota derivada informa fonte, hash, provedor, modelo e estado epistemológico.

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

### Inteligência criativa e memória de ideias

A inteligência do produto é uma combinação de regras determinísticas do Nisti com geração da IA. A IA não decide sozinha se uma ideia é nova. O sistema mantém e consulta o histórico criativo antes e depois de cada geração.

#### Memória criativa

O `CreativeIndex` será um índice derivado e reconstruível a partir das fontes canônicas de:

- ideias salvas;
- roteiros aprovados;
- campanhas;
- itens planejados no Calendário;
- conteúdos publicados;
- conteúdos arquivados ou rejeitados com motivo;
- projetos anteriores presentes no Vault e em backups importados.

O índice não será uma nova fonte de verdade. IDs e vínculos continuam pertencendo às entidades canônicas; o índice existe para busca, comparação e reconstrução.

Cada registro criativo deve preservar:

- `idea_id` e `project_id`;
- título e conceito central;
- objetivo, público, canal e formato;
- gancho, mensagem principal e CTA;
- fontes utilizadas;
- roteiro, campanha e publicação vinculados;
- estado do workflow;
- data de criação e de uso;
- motivo de rejeição, quando informado;
- `derived_from`, quando for reaproveitamento explícito.

#### Comparação de similaridade

O sistema não deve comparar apenas títulos. A análise combina:

- hash normalizado para duplicidade exata;
- palavras e entidades principais;
- conceito central;
- gancho;
- público e objetivo;
- mensagem e CTA;
- formato e canal;
- similaridade semântica quando a conexão confirmada oferecer essa capacidade.

Trocar palavras mantendo o mesmo conceito não transforma uma ideia usada em ideia nova.

#### Geração em duas barreiras

Antes da geração:

1. pesquisar informações relevantes no Obsidian;
2. recuperar ideias anteriores semanticamente próximas;
3. enviar à IA as fontes permitidas e uma lista resumida do que não deve ser repetido;
4. pedir diversidade de conceito, não apenas variação de redação.

Depois da geração:

1. validar o schema das cinco ideias;
2. comparar cada candidata com o histórico e com as outras candidatas do mesmo lote;
3. bloquear duplicidade exata;
4. rejeitar ou sinalizar similaridade alta;
5. permitir uma única nova tentativa controlada para substituir candidatas repetidas;
6. mostrar nível de novidade, referências e diferenças reais da proposta.

Se não houver dados suficientes no Obsidian para propor algo fundamentado e diferente, o sistema deve informar a limitação em vez de preencher a lista com ideias genéricas.

#### Política por estado

- `PUBLICADO`, `PLANEJADO` ou `APROVADO`: forte barreira contra repetição;
- `IDEIA_SALVA`: comparação obrigatória e alerta de proximidade;
- `REJEITADO`: evitar pelo motivo registrado, mas permitir revisão consciente;
- candidato ainda não salvo no lote atual: impedir duplicação dentro das cinco ideias;
- item arquivado: manter no histórico; arquivar não apaga a memória criativa.

#### Reaproveitamento intencional

Quando o usuário pedir adaptação, o sistema usa um modo explícito `REAPROVEITAR`, não apresenta o resultado como ideia inédita e registra:

- conteúdo de origem;
- transformação solicitada;
- novo canal ou formato;
- vínculo `derived_from`;
- diferenças em relação ao original.

#### Uso dos resultados

Métricas registradas podem ajudar a priorizar ou evitar padrões, mas não autorizam conclusões causais automáticas. O sistema pode dizer que uma característica está associada a resultados observados; não pode afirmar que ela causou o resultado sem evidência suficiente.

#### Critérios de aceite da memória criativa

- uma ideia idêntica é bloqueada mesmo com título diferente;
- as cinco candidatas do mesmo lote não repetem o mesmo conceito;
- ideia publicada em projeto anterior aparece na comparação;
- diferença apenas de redação não recebe estado de novidade alta;
- público ou objetivo diferente só libera a proposta quando a mudança for material;
- reaproveitamento explícito preserva `derived_from` e não se apresenta como inédito;
- conteúdo arquivado continua protegendo contra repetição;
- ausência de histórico suficiente impede alegação absoluta de originalidade;
- cada sugestão mostra quais dados do Obsidian fundamentaram sua criação.

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
10. motor incremental de curadoria do Inbox;
11. auditoria, reparo e homologação ponta a ponta.
