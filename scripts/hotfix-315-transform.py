from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    source = file.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, got {count}: {old[:80]!r}")
    file.write_text(source.replace(old, new, 1), encoding="utf-8")


# 1) Version bump.
replace_once("package.json", '"version": "3.1.4"', '"version": "3.1.5"')
replace_once("src/utils/reliability.ts", 'export const APP_VERSION = "3.1.4";', 'export const APP_VERSION = "3.1.5";')

# 2) Root-level Markdown must never masquerade as the canonical Inbox.
replace_once(
    "src/services/api.ts",
    'const OBSIDIAN_VAULT_IGNORED_SEGMENTS = new Set([".obsidian", ".trash", ".git", ".hg", ".svn", "node_modules"]);',
    'const OBSIDIAN_VAULT_IGNORED_SEGMENTS = new Set([".obsidian", ".trash", ".git", ".hg", ".svn", "node_modules"]);\nexport const OBSIDIAN_VAULT_ROOT_LABEL = "Raiz do Vault";',
)
replace_once(
    "src/services/api.ts",
    '''                const content = typeof noteRes.data.data === "string" ? noteRes.data.data : "";
                const pathParts = itemRelativePath.split("/");
                const filename = pathParts.pop() || "Sem Título.md";
                const title = filename.replace(/\\.md$/i, "");
                const folder = pathParts.join("/") || "00_Inbox";''',
    '''                const content = typeof noteRes.data.data === "string" ? noteRes.data.data : "";
                const pathParts = itemRelativePath.split("/");
                const filename = pathParts.pop() || "Sem Título.md";
                const title = filename.replace(/\\.md$/i, "");
                const folder = pathParts.join("/") || OBSIDIAN_VAULT_ROOT_LABEL;''',
)

# 3) Native select popup: make the Windows/Electron dark palette explicit.
replace_once(
    "src/components/AddKnowledgeView.tsx",
    '''                    }} className="w-full bg-transparent text-text-primary text-xs outline-none">\n                      {vaultFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}\n                    </select>''',
    '''                    }} className="w-full bg-transparent text-text-primary text-xs outline-none" style={{ colorScheme: "dark" }}>\n                      {vaultFolders.map((folder) => (\n                        <option\n                          key={folder}\n                          value={folder}\n                          style={{ backgroundColor: "#111827", color: "#ffffff" }}\n                        >\n                          {folder}\n                        </option>\n                      ))}\n                    </select>''',
)

# 4) Wire the already-existing sync callback into the navbar.
replace_once(
    "src/components/Navbar.tsx",
    '''  Plus,\n  Settings,''',
    '''  Plus,\n  RefreshCw,\n  Settings,''',
)
replace_once(
    "src/components/Navbar.tsx",
    '''  apiConfig,\n  onOpenSettings,\n  onQuickNewCampaign,''',
    '''  apiConfig,\n  onOpenSettings,\n  onSyncNow,\n  isSyncing,\n  onQuickNewCampaign,''',
)
replace_once(
    "src/components/Navbar.tsx",
    '''            <div className="hidden md:block">{connectionWarning}</div>\n\n            <div className="relative">''',
    '''            <div className="hidden md:block">{connectionWarning}</div>\n\n            {isBaseConnected && (\n              <button\n                type="button"\n                onClick={onSyncNow}\n                disabled={isSyncing}\n                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-surface-variant text-text-secondary hover:text-text-primary border border-outline-border transition-all text-[11px] font-bold disabled:opacity-50 disabled:cursor-wait"\n                title="Reler agora o Vault ativo do Obsidian"\n              >\n                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />\n                <span className="hidden xl:inline">{isSyncing ? "Sincronizando..." : "Sincronizar agora"}</span>\n              </button>\n            )}\n\n            <div className="relative">''',
)
replace_once(
    "src/components/Navbar.tsx",
    '''          </div>\n\n          <div className="grid grid-cols-2 gap-2">\n            {PRIMARY_NAVIGATION.map((item) => {''',
    '''          </div>\n\n          {isBaseConnected && (\n            <button\n              type="button"\n              onClick={onSyncNow}\n              disabled={isSyncing}\n              className="w-full px-3 py-2.5 rounded-xl bg-surface-container-low border border-outline-border text-text-primary text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"\n            >\n              <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />\n              {isSyncing ? "Sincronizando..." : "Sincronizar agora"}\n            </button>\n          )}\n\n          <div className="grid grid-cols-2 gap-2">\n            {PRIMARY_NAVIGATION.map((item) => {''',
)

# 5) Real auto-sync. Silent background cycles reconcile deletions/renames without opening Settings.
replace_once(
    "src/App.tsx",
    '''  const firedReminderKeysRef = useRef<Set<string>>(\n    new Set(''',
    '''  const autoSyncBootstrappedRef = useRef(false);\n  const firedReminderKeysRef = useRef<Set<string>>(\n    new Set(''',
)
replace_once(
    "src/App.tsx",
    'const handleSyncNow = useCallback(async () => {',
    'const handleSyncNow = useCallback(async (options: { silent?: boolean } = {}) => {',
)
replace_once(
    "src/App.tsx",
    '''      await storage.logAudit({\n        action: "VAULT_SYNCED",\n        entityType: "VAULT",\n        entityId: detectedVault,\n        details: `${synchronizedNotes.length} fonte(s) reconciliada(s) com o Vault ativo via Local REST API em ${syncedAt}.`,\n      });\n      showToast("success", "Base atualizada", `${synchronizedNotes.length} fonte(s) disponíveis para o fluxo de marketing.`);\n    } catch (error: any) {\n      showToast("warning", "Falha ao atualizar a Base", error?.message || "Não foi possível ler o Vault.");\n      setIsSettingsOpen(true);''',
    '''      if (!options.silent) {\n        await storage.logAudit({\n          action: "VAULT_SYNCED",\n          entityType: "VAULT",\n          entityId: detectedVault,\n          details: `${synchronizedNotes.length} fonte(s) reconciliada(s) com o Vault ativo via Local REST API em ${syncedAt}.`,\n        });\n        showToast("success", "Base atualizada", `${synchronizedNotes.length} fonte(s) disponíveis para o fluxo de marketing.`);\n      }\n    } catch (error: any) {\n      if (!options.silent) {\n        showToast("warning", "Falha ao atualizar a Base", error?.message || "Não foi possível ler o Vault.");\n        setIsSettingsOpen(true);\n      } else {\n        console.warn("Sincronização automática do Obsidian falhou sem derrubar a sessão.", error);\n      }''',
)
replace_once(
    "src/App.tsx",
    '''  }, [apiConfig, isSyncing, showToast, updateAndSaveApiConfig]);\n\n  const handleTestConnection = useCallback(''',
    '''  }, [apiConfig, isSyncing, showToast, updateAndSaveApiConfig]);\n\n  useEffect(() => {\n    const canAutoSync =\n      apiConfig.autoSync &&\n      apiConfig.connectionStatus === "connected" &&\n      api.isObsidianSessionVerified();\n\n    if (!canAutoSync) {\n      autoSyncBootstrappedRef.current = false;\n      return;\n    }\n\n    if (!autoSyncBootstrappedRef.current) {\n      autoSyncBootstrappedRef.current = true;\n      void handleSyncNow({ silent: true });\n    }\n\n    const intervalSeconds = Math.max(30, Number(apiConfig.syncIntervalSeconds) || 60);\n    const runAutoSync = () => void handleSyncNow({ silent: true });\n    const timer = window.setInterval(runAutoSync, intervalSeconds * 1000);\n    return () => window.clearInterval(timer);\n  }, [apiConfig.autoSync, apiConfig.connectionStatus, apiConfig.syncIntervalSeconds, handleSyncNow]);\n\n  const handleTestConnection = useCallback(''',
)

print("hotfix 3.1.5 transform complete")
