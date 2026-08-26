import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  selectVault: () => ipcRenderer.invoke("vault:select"),
  getVaultPath: () => ipcRenderer.invoke("vault:get-path"),

  readNotes: () => ipcRenderer.invoke("notes:read-all"),
  writeNote: (folder: string, title: string, content: string, frontmatter?: any) =>
    ipcRenderer.invoke("notes:write", { folder, title, content, frontmatter }),
  appendNote: (folder: string, title: string, contentToAppend: string) =>
    ipcRenderer.invoke("notes:append", { folder, title, contentToAppend }),
  upsertNoteSection: (folder: string, title: string, sectionId: string, heading: string, content: string) =>
    ipcRenderer.invoke("notes:upsert-section", { folder, title, sectionId, heading, content }),
  deleteNote: (folder: string, title: string) =>
    ipcRenderer.invoke("notes:delete", { folder, title }),

  setSecret: (name: string, value: string) => ipcRenderer.invoke("secret:set", name, value),
  getSecret: (name: string) => ipcRenderer.invoke("secret:get", name),
  deleteSecret: (name: string) => ipcRenderer.invoke("secret:delete", name),

  processKnowledgeLocal: (payload: any) => ipcRenderer.invoke("ai:process-knowledge", payload),
  generateCampaignLocal: (payload: any) => ipcRenderer.invoke("ai:generate-campaign", payload),

  getSystemStatus: () => ipcRenderer.invoke("system:status")
});
