from pathlib import Path

path = Path('src/App.tsx')
source = path.read_text(encoding='utf-8')
old = '''    try {
      let detectedVault = apiConfig.vaultName || "MarketingVault";
      let physicalNotes: ObsidianNote[] = [];
      let folders: string[] = [];

      if (window.electronAPI) {
        const verification = await api.probeObsidianConnection(apiConfig);
        if (!verification.success) throw new Error(verification.message);

        detectedVault = verification.detectedVaultName || detectedVault;
        physicalNotes = (await storage.readDesktopNotesForApp()) || [];
        folders = await window.electronAPI.listVaultFolders().catch(() => []);
      } else {
        if (!apiConfig.endpoint.trim() || !apiConfig.apiKey.trim()) {
          throw new Error("Configure o endpoint e a chave do Obsidian Local REST API antes de sincronizar no modo web.");
        }
        const verification = await api.probeObsidianConnection(apiConfig);
        if (!verification.success) throw new Error(verification.message);
        detectedVault = verification.detectedVaultName || detectedVault;
        physicalNotes = await api.syncWebObsidianNotes(apiConfig);
        folders = Array.from(new Set(physicalNotes.map((note) => note.folder).filter(Boolean)));
      }

      publishObsidianSnapshot(physicalNotes, folders);
      const syncedAt = new Date().toISOString();'''
new = '''    try {
      let detectedVault = apiConfig.vaultName || "MarketingVault";

      if (!apiConfig.endpoint.trim() || !apiConfig.apiKey.trim()) {
        throw new Error("Configure o endpoint e a chave do Obsidian Local REST API antes de sincronizar.");
      }

      const verification = await api.probeObsidianConnection(apiConfig);
      if (!verification.success) throw new Error(verification.message);
      detectedVault = verification.detectedVaultName || detectedVault;

      const synchronizedNotes = await api.syncWebObsidianNotes(apiConfig);
      const folders = verification.localFolders?.length
        ? verification.localFolders
        : Array.from(new Set(synchronizedNotes.map((note) => note.folder).filter(Boolean)));

      publishObsidianSnapshot(synchronizedNotes, folders);
      const syncedAt = new Date().toISOString();'''
if old not in source:
    raise RuntimeError('manual sync legacy block not found')
source = source.replace(old, new, 1)
source = source.replace(
    'details: `${physicalNotes.length} fonte(s) reconciliada(s) com o Vault físico em ${syncedAt}.`,',
    'details: `${synchronizedNotes.length} fonte(s) reconciliada(s) com o Vault ativo via Local REST API em ${syncedAt}.`,',
    1,
)
source = source.replace(
    'showToast("success", "Base atualizada", `${physicalNotes.length} fonte(s) disponíveis para o fluxo de marketing.`);',
    'showToast("success", "Base atualizada", `${synchronizedNotes.length} fonte(s) disponíveis para o fluxo de marketing.`);',
    1,
)
source = source.replace('      if (!window.electronAPI) setIsSettingsOpen(true);', '      setIsSettingsOpen(true);', 1)
path.write_text(source, encoding='utf-8')
print('REST-first manual sync patched.')
