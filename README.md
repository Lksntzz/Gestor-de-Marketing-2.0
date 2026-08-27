# Nisti Marketing

Sistema local-first de gestão de marketing integrado ao Obsidian e IA Gemini.

## Versão 1.0.1

A versão 1.0.1 consolida o aplicativo desktop **Nisti Marketing** com backend local protegido, integração com Gemini e Obsidian e um workspace de conhecimento orientado à síntese.

### Obsidian como fonte de verdade

O acesso ao banco de conhecimento permanece bloqueado até a conexão com o Obsidian Local REST API ser validada e a pasta física do Vault ser selecionada. Depois da conexão, o aplicativo varre recursivamente pastas e subpastas do Vault.

O cofre do Nisti Marketing usa uma interface fixa em três áreas: pastas, arquivos e painel de síntese. O conteúdo integral continua no Obsidian; o aplicativo prioriza resumo, pontos importantes, origem e estado epistemológico.

### Análise de conhecimento

No desktop, a sincronização reconhece arquivos Markdown e também fontes `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp` e `.txt` existentes no Vault. Quando uma chave Gemini está configurada, fontes novas ou alteradas podem ser analisadas para gerar:

- resumo curto;
- pontos importantes;
- texto visível relevante, quando aplicável;
- categoria e palavras-chave;
- estado `CONFIRMADO`, `HIPÓTESE` ou `PENDENTE`.

A análise não deve promover inferências a fatos. Arquivos sem chave de IA, acima do limite automático ou que falhem no processamento permanecem como análise pendente, sem fabricação de conteúdo.

Para reduzir chamadas de API, o índice analítico é armazenado localmente e reutilizado enquanto caminho, tamanho e data de modificação do arquivo não mudarem.

### Interface

- navegação lateral fixa no desktop;
- barra inferior compacta com estado do Obsidian e do motor de IA;
- Início reorganizado em prioridades, indicadores e conhecimento recente;
- Cofre dentro da altura da janela com rolagem interna;
- Planejamento em interface clara, sem recomendações comerciais inventadas quando não houver dados reais.

## Segurança

As credenciais do Gemini e do Obsidian não devem ser persistidas em texto puro. No Electron, o armazenamento de segredos utiliza `safeStorage` do sistema operacional. O backend de produção é local, limitado ao loopback e usa sessão autenticada para as rotas protegidas.

## Desenvolvimento

```bash
bun install --frozen-lockfile
bun run verify
```

Para gerar os executáveis Windows:

```bash
bun run electron:build
```
