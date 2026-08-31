import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: () => true,

  selectVault: () => ipcRenderer.invoke("vault:select"),
  getVaultPath: () => ipcRenderer.invoke("vault:get-path"),
  setObsidianConnectionState: (connected: boolean) => ipcRenderer.invoke("vault:connection-state", connected),
  listVaultFolders: () => ipcRenderer.invoke("vault:list-folders"),

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
  deleteSecret: (name: string) => ipcRenderer.invoke("secret:delete", name),
  setAIConfig: (config: { provider: "gemini" | "openai"; model?: string }) => ipcRenderer.invoke("ai:config:set", config),

  // New single-connection bridge. The active credential is write-only from the
  // renderer: there is deliberately no getter for aiConnectionKey.
  setAIConnectionCredential: (apiKey: string) =>
    ipcRenderer.invoke("ai-connection:set-credential", apiKey),
  clearAIConnectionCredential: () =>
    ipcRenderer.invoke("ai-connection:clear-credential"),
  getAIConnectionState: () => ipcRenderer.invoke("ai-connection:get-state"),
  resetAIConnectionState: () => ipcRenderer.invoke("ai-connection:reset"),
  confirmAIProvider: (provider: "gemini" | "openai") =>
    ipcRenderer.invoke("ai-connection:confirm-provider", { provider }),
  validateAIModel: (provider: "gemini" | "openai", model: string) =>
    ipcRenderer.invoke("ai-connection:validate-model", { provider, model }),

  getSystemStatus: () => ipcRenderer.invoke("system:status"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get-status"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
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
