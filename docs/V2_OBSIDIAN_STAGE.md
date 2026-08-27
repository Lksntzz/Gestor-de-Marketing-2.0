# Etapa 0.2 — Obsidian e Base de Conhecimento

Objetivo: tornar o Obsidian a fonte obrigatória da base de conhecimento da versão 2.0.

Regras do checkpoint:
- sem REST API validada e sem Vault físico selecionado, leitura e gravação do cofre permanecem bloqueadas;
- o runtime Electron só autoriza IPC de leitura/gravação após a conexão ser validada;
- PDF, imagem e texto existentes no Vault entram na varredura recursiva e recebem síntese inteligente com estado CONFIRMADO, HIPÓTESE ou PENDENTE;
- ingestão manual deve usar o cliente autenticado da aplicação;
- ao perder a conexão, o gate deve fechar novamente.
