from pathlib import Path

path = Path('src/components/ObsidianApiSettingsModal.tsx')
source = path.read_text(encoding='utf-8')

replacements = [
    (
        'Configure os parâmetros do Obsidian. O status conectado só é liberado depois que a API e o Vault físico são validados.',
        'Informe o endpoint e a API Key do Local REST API. Após validar a conexão, o Nisti cria e mantém automaticamente a pasta “Nisti Marketing” dentro do Vault ativo.'
    ),
    (
        'A conexão não foi liberada. No desktop, confirme que o Obsidian está aberto, o plugin Local REST API está ativo, o token está correto e a pasta física do Vault foi selecionada.',
        'A conexão não foi liberada. Confirme que o Obsidian está aberto, o plugin Local REST API está ativo, o endpoint está correto e a API Key corresponde ao Vault ativo.'
    ),
    (
        'disabled={isTesting || (!window.electronAPI && (!(formData.endpoint || "").trim() || !(formData.apiKey || "").trim()))}',
        'disabled={isTesting || !(formData.endpoint || "").trim() || !(formData.apiKey || "").trim()}'
    ),
]
for old, new in replacements:
    if old not in source:
        raise RuntimeError(f'Anchor not found: {old[:80]}')
    source = source.replace(old, new, 1)

marker = '''                {/* Seção de Integridade e Reparo do Vault Local */}
                {window.electronAPI && ('''
replacement = '''                <div className="mt-4 pt-4 border-t border-outline-border">
                  <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-[11px] text-text-secondary leading-relaxed">
                    <span className="font-bold text-emerald-300 block mb-1">Estrutura automática do Nisti</span>
                    Depois da autenticação, o Nisti prepara <strong>Nisti Marketing/00_Inbox</strong> e as pastas de Estratégia, Produtos, Conteúdos, Campanhas, Reuniões, Influenciadores, Pesquisas, Aprendizados e Templates diretamente no Vault ativo. Nenhuma seleção manual de pasta é necessária no fluxo padrão.
                  </div>
                </div>

                {/* Manutenção física legada mantida no código apenas para compatibilidade; não faz parte do fluxo REST-first. */}
                {false && ('''
if marker not in source:
    raise RuntimeError('Legacy audit section anchor not found')
source = source.replace(marker, replacement, 1)

path.write_text(source, encoding='utf-8')
print('REST-first settings copy patched.')
