import { contextBridge, ipcRenderer } from "electron";

// Define the shape of our secure desktop bridge
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,
  
  // Vault Selection
  selectVault: () => ipcRenderer.invoke("vault:select"),
  getVaultPath: () => ipcRenderer.invoke("vault:get-path"),
  
  // Note Storage and Management
  readNotes: (vaultPath: string) => ipcRenderer.invoke("notes:read-all", vaultPath),
  writeNote: (vaultPath: string, folder: string, title: string, content: string, frontmatter?: any) => 
    ipcRenderer.invoke("notes:write", { vaultPath, folder, title, content, frontmatter }),
  appendNote: (vaultPath: string, folder: string, title: string, contentToAppend: string) => 
    ipcRenderer.invoke("notes:append", { vaultPath, folder, title, contentToAppend }),
  deleteNote: (vaultPath: string, folder: string, title: string) => 
    ipcRenderer.invoke("notes:delete", { vaultPath, folder, title }),
    
  // AI Gateway delegation via main process
  processKnowledgeLocal: (payload: any) => ipcRenderer.invoke("ai:process-knowledge", payload),
  generateCampaignLocal: (payload: any) => ipcRenderer.invoke("ai:generate-campaign", payload),
  
  // System indicators
  getSystemStatus: () => ipcRenderer.invoke("system:status")
});
