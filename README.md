# Nisti Print PKM Marketing Hub 🚀

Gestor de Marketing e PKM Local-First integrado ao **Obsidian**, com suporte a **IA Gemini**, automação de tarefas e roteiros criativos de campanhas.

---

## 📥 Download do Instalador Pronto (.exe)

Você pode baixar os instaladores prontos para Windows diretamente pelo GitHub:

1. Acesse a aba **[Releases / Lançamentos](../../releases)** do repositório no GitHub.
2. Na versão mais recente, clique no arquivo executável:
   - **`Nisti Print PKM Marketing Hub Setup X.X.X.exe`** (Instalador NSIS completo do Windows com assistente).
   - **`Nisti Print PKM Marketing Hub X.X.X.exe`** (Versão portátil para rodar direto sem instalar).
3. Dê 2 cliques no arquivo baixado e instale normalmente no seu computador!

---

## ⚙️ Como os Instaladores são Gerados Automaticamente no GitHub

Este repositório possui uma automação configurada via **GitHub Actions** (`.github/workflows/release.yml`):

- Sempre que uma nova tag/versão for lançada (ou acionada manualmente na aba **Actions > Release & Build Installers**), o GitHub compila o código em uma máquina Windows na nuvem e anexa o arquivo `.exe` pronto para download nos **Releases**.

---

## 💻 Desenvolvimento Local (Opcional)

Se preferir rodar ou compilar em sua máquina local:

```bash
# 1. Instalar dependências
bun install # ou npm install

# 2. Rodar em modo desenvolvimento
bun run dev

# 3. Gerar instalador localmente
bun run electron:build
```

Os executáveis gerados localmente ficarão na pasta `dist-electron/`.
