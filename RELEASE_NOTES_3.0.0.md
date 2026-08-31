# Nisti Marketing 3.0.0

## Marco da versão

A versão 3.0.0 consolida o produto em torno do fluxo operacional único:

Base → Criar → Planejar → Executar → Aprender.

## Principais mudanças

- consolidação do shell principal e remoção de handlers/estados legados conflitantes;
- Vault físico como fonte principal no desktop;
- leitura e reconciliação correta de notas Markdown `.md`;
- parser compartilhado de frontmatter com suporte a YAML estruturado e tags;
- Base canônica integrada ao contexto de criação e IA;
- conhecimento de PDFs e imagens indexado e disponibilizado ao contexto;
- campanhas sem datas operacionais inventadas;
- tarefas sem prazos, horários, lembretes ou prioridade fabricados;
- prioridade ausente preservada explicitamente como não definida;
- pipeline de segurança de credenciais e sessão local mantido;
- testes de regressão para frontmatter, snapshots do Vault, contexto de conhecimento e extração de tarefas.

## Compatibilidade

- Windows x64 via instalador NSIS e build portátil;
- dados locais e Vault permanecem preservados durante atualização/desinstalação conforme configuração do instalador;
- credenciais continuam armazenadas pelo armazenamento seguro do Electron.
