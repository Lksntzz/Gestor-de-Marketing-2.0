import { contextBridge, ipcRenderer } from "electron";

const UPDATE_OVERLAY_ID = "nisti-desktop-update-overlay";

function restoreRendererStateAfterUpdate(): void {
  try {
    const snapshot = ipcRenderer.sendSync("renderer-state:bootstrap");
    const values = snapshot?.localStorage;
    if (!values || typeof values !== "object" || Array.isArray(values)) return;

    let restored = 0;
    for (const [key, value] of Object.entries(values)) {
      if (restored >= 5000) break;
      if (typeof key !== "string" || typeof value !== "string") continue;
      if (key.length > 512 || value.length > 5_000_000) continue;
      window.localStorage.setItem(key, value);
      restored += 1;
    }
  } catch {
    // First run / development builds have no migration snapshot. Fail closed
    // and let the application initialize with its ordinary defaults.
  }
}

function ensureUpdateOverlay(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(UPDATE_OVERLAY_ID);
  if (existing) return existing;

  const overlay = document.createElement("div");
  overlay.id = UPDATE_OVERLAY_ID;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:rgba(7,10,24,.96)",
    "color:#fff",
    "font-family:Segoe UI,Arial,sans-serif",
  ].join(";");
  overlay.innerHTML = `
    <div style="width:min(520px,calc(100vw - 48px));padding:34px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#10172a;box-shadow:0 24px 80px rgba(0,0,0,.4);text-align:center">
      <div style="width:42px;height:42px;margin:0 auto 20px;border:4px solid rgba(255,255,255,.18);border-top-color:#ec4899;border-radius:50%;animation:nistiUpdateSpin .8s linear infinite"></div>
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f472b6;margin-bottom:10px">Atualização do Nisti</div>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 10px;font-weight:800">Instalando atualização…</h1>
      <p style="font-size:14px;line-height:1.6;color:#cbd5e1;margin:0">Suas configurações e conexões estão sendo preservadas. O aplicativo fechará por alguns segundos e abrirá sozinho na nova versão.</p>
      <div style="height:4px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin-top:24px"><div style="width:72%;height:100%;background:#ec4899;border-radius:999px;animation:nistiUpdateBar 1.2s ease-in-out infinite"></div></div>
    </div>
  `;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes nistiUpdateSpin { to { transform: rotate(360deg); } }
    @keyframes nistiUpdateBar { 0% { transform: translateX(-120%); } 100% { transform: translateX(150%); } }
  `;
  overlay.appendChild(style);
  document.documentElement.appendChild(overlay);
  return overlay;
}

function hideUpdateOverlay(): void {
  try {
    document.getElementById(UPDATE_OVERLAY_ID)?.remove();
  } catch {
    // Renderer may already be shutting down for NSIS.
  }
}

// Preload runs before the React bundle. Restoring here guarantees that the new
// version sees the previous renderer state on its first render, even if the
// desktop backend origin changed between versions.
restoreRendererStateAfterUpdate();

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  selectVault: () => ipcRenderer.invoke("vault:select"),
  // 3.1.7: o renderer não usa mais um caminho físico como autoridade para
  // decidir onde gravar. Escritas operacionais passam pela Local REST API
  // autenticada; o caminho local permanece encapsulado no processo principal
  // apenas para compatibilidade, indexação e manutenção do Vault.
  getVaultPath: async () => null,
  setObsidianConnectionState: (connected: boolean) => ipcRenderer.invoke("vault:connection-state", connected),
  listVaultFolders: () => ipcRenderer.invoke("vault:list-folders"),
  auditVault: () => ipcRenderer.invoke("vault:audit"),
  repairVault: () => ipcRenderer.invoke("vault:repair"),

  readNotes: () => ipcRenderer.invoke("notes:read-all"),
  queryKnowledge: (query: string, preferredPaths?: string[]) => ipcRenderer.invoke("knowledge:query", query, preferredPaths),
  commitKnowledge: (payload: any) => ipcRenderer.invoke("knowledge:commit", payload),
  writeNote: (...args: any[]) => {
    // Compatibility for pre-v0.1.5 callers that still pass vaultPath first.
    // The renderer-provided root is deliberately discarded and never reaches IPC.
    const normalized = args.length >= 5 ? args.slice(1) : args;
    const [folder, title, content, frontmatter] = normalized;
    return ipcRenderer.invoke("notes:write", { folder, title, content, frontmatter });
  },
  appendNote: (folder: string, title: string, contentToAppend: string) =>
    ipcRenderer.invoke("notes:append", { folder, title, contentToAppend }),
  upsertNoteSection: (folder: string, title: string, sectionId: string, heading: string, content: string) =>
    ipcRenderer.invoke("notes:upsert-section", { folder, title, sectionId, heading, content }),
  deleteNote: (folder: string, title: string) =>
    ipcRenderer.invoke("notes:delete", { folder, title }),

  setSecret: (name: string, value: string) => ipcRenderer.invoke("secret:set", name, value),
  getSecret: (name: string) => ipcRenderer.invoke("secret:get", name),
  hasSecret: (name: string) => ipcRenderer.invoke("secret:has", name),
  deleteSecret: (name: string) => ipcRenderer.invoke("secret:delete", name),
  setAIConfig: (config: { provider: "gemini" | "openai"; model?: string }) => ipcRenderer.invoke("ai:config:set", config),

  // Credential provisioning is intentionally separate from the operational
  // single-connection bridge below. The active key is write-only to renderer.
  setAIConnectionCredential: (credential: string) =>
    ipcRenderer.invoke("ai-connection:set-credential", credential),
  clearAIConnectionCredential: () =>
    ipcRenderer.invoke("ai-connection:clear-credential"),

  // New single-connection bridge. Credentials and discovered model lists never
  // cross from the renderer into these operational IPC calls.
  getAIConnectionState: () => ipcRenderer.invoke("ai-connection:get-state"),
  resetAIConnectionState: () => ipcRenderer.invoke("ai-connection:reset"),
  confirmAIProvider: (provider: "gemini" | "openai") =>
    ipcRenderer.invoke("ai-connection:confirm-provider", { provider }),
  validateAIModel: (provider: "gemini" | "openai", model: string) =>
    ipcRenderer.invoke("ai-connection:validate-model", { provider, model }),

  getSystemStatus: () => ipcRenderer.invoke("system:status"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: async () => {
    ensureUpdateOverlay();
    try {
      const result = await ipcRenderer.invoke("update:install");
      if (!result?.success) hideUpdateOverlay();
      return result;
    } catch (error) {
      hideUpdateOverlay();
      throw error;
    }
  },
  onUpdateStatus: (callback: (state: any) => void) => {
    const listener = (_event: any, state: any) => callback(state);
    ipcRenderer.on("update:status", listener);
    return () => {
      ipcRenderer.removeListener("update:status", listener);
    };
  },
  editorialList: () => ipcRenderer.invoke("editorial:list"),
  editorialUpsert: (item: any) => ipcRenderer.invoke("editorial:upsert", item),
  editorialDelete: (id: string) => ipcRenderer.invoke("editorial:delete", id)
});
