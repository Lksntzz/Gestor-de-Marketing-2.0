import { contextBridge, ipcRenderer } from "electron";

// Secure desktop bridge. The renderer never supplies the filesystem vault root;
// that privileged state is owned exclusively by Electron's main process.
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  // Vault Selection
  selectVault: () => ipcRenderer.invoke("vault:select"),
  getVaultPath: () => ipcRenderer.invoke("vault:get-path"),

  // Note Storage and Management
  readNotes: () => ipcRenderer.invoke("notes:read-all"),
  writeNote: (folder: string, title: string, content: string, frontmatter?: any) =>
    ipcRenderer.invoke("notes:write", { folder, title, content, frontmatter }),
  appendNote: (folder: string, title: string, contentToAppend: string) =>
    ipcRenderer.invoke("notes:append", { folder, title, contentToAppend }),
  deleteNote: (folder: string, title: string) =>
    ipcRenderer.invoke("notes:delete", { folder, title }),

  // OS-backed secrets (Electron safeStorage)
  setSecret: (name: string, value: string) => ipcRenderer.invoke("secret:set", name, value),
  getSecret: (name: string) => ipcRenderer.invoke("secret:get", name),
  deleteSecret: (name: string) => ipcRenderer.invoke("secret:delete", name),

  // AI Gateway delegation via main process
  processKnowledgeLocal: (payload: any) => ipcRenderer.invoke("ai:process-knowledge", payload),
  generateCampaignLocal: (payload: any) => ipcRenderer.invoke("ai:generate-campaign", payload),

  // System indicators
  getSystemStatus: () => ipcRenderer.invoke("system:status")
});
