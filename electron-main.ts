import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import { GoogleGenAI } from "@google/genai";

let mainWindow: BrowserWindow | null = null;
let selectedVaultPath: string | null = null;

// Standard Obsidian vault folders from the prompt
const STANDARD_FOLDERS = [
  "00_Inbox",
  "01_Estrategia",
  "02_Produtos",
  "03_Conteudos",
  "04_Campanhas",
  "05_Reunioes",
  "06_Influenciadores_UGC",
  "07_Pesquisas",
  "08_Aprendizados",
  "99_Templates"
];

// Local Config Path to persist vault selection and settings offline
const configDir = app.getPath("userData");
const configFilePath = path.join(configDir, "nisti_config.json");

// Load stored config on startup
async function loadConfig() {
  try {
    if (existsSync(configFilePath)) {
      const data = await fs.readFile(configFilePath, "utf8");
      const config = JSON.parse(data);
      if (config.vaultPath && existsSync(config.vaultPath)) {
        selectedVaultPath = config.vaultPath;
        console.log("Vault path loaded from config:", selectedVaultPath);
      }
    }
  } catch (err) {
    console.error("Failed to load local config:", err);
  }
}

// Save config helper
async function saveConfig(updates: any) {
  try {
    let currentConfig: any = {};
    if (existsSync(configFilePath)) {
      const data = await fs.readFile(configFilePath, "utf8");
      currentConfig = JSON.parse(data);
    }
    const finalConfig = { ...currentConfig, ...updates };
    await fs.writeFile(configFilePath, JSON.stringify(finalConfig, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}

// Security sandbox helper to prevent path traversal
function validateAndResolvePath(vaultPath: string, folder: string, filename: string): string {
  // Clean elements and resolve
  const resolvedVault = path.resolve(vaultPath);
  const targetFilePath = path.resolve(resolvedVault, folder, filename);

  // Strictly check if the resulting path stays within the authorized vault directory
  if (!targetFilePath.startsWith(resolvedVault)) {
    throw new Error("Acesso de arquivo não autorizado: Fora do limite do Vault do Obsidian.");
  }
  return targetFilePath;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Nisti Marketing Local-First Desktop",
    webPreferences: {
      preload: path.join(__dirname, "dist", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load from local build or dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Initialize Electron app
app.whenReady().then(async () => {
  await loadConfig();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handler: Selection of Obsidian Vault
ipcMain.handle("vault:select", async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione o seu Vault do Obsidian",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const vaultPath = result.filePaths[0];
  selectedVaultPath = vaultPath;

  // Scaffold the standard directories as requested if they don't already exist
  for (const folder of STANDARD_FOLDERS) {
    const fullFolderPath = path.join(vaultPath, folder);
    if (!existsSync(fullFolderPath)) {
      await fs.mkdir(fullFolderPath, { recursive: true });
    }
  }

  // Persist the vault path in local storage
  await saveConfig({ vaultPath });

  return {
    vaultPath,
    foldersCreated: STANDARD_FOLDERS
  };
});

ipcMain.handle("vault:get-path", () => {
  return selectedVaultPath;
});

// IPC Handler: Read all Markdown files from Vault
ipcMain.handle("notes:read-all", async (_, vaultPath: string) => {
  if (!vaultPath || !existsSync(vaultPath)) {
    return [];
  }

  const notes: any[] = [];

  async function scanDirectory(currentDir: string, relativeDir: string = "") {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.join(relativeDir, entry.name);

        if (entry.isDirectory()) {
          // Recursively read markdown vaults
          await scanDirectory(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const content = await fs.readFile(fullPath, "utf8");
          const stats = await fs.stat(fullPath);

          // Simple Frontmatter Parser for local indexing without dependencies
          let frontmatter: any = {};
          let body = content;
          const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          
          if (fmMatch) {
            body = content.slice(fmMatch[0].length).trim();
            const fmLines = fmMatch[1].split("\n");
            for (const line of fmLines) {
              const colonIndex = line.indexOf(":");
              if (colonIndex > -1) {
                const key = line.slice(0, colonIndex).trim();
                const value = line.slice(colonIndex + 1).trim().replace(/^['"]|['"]$/g, "");
                frontmatter[key] = value;
              }
            }
          }

          notes.push({
            title: entry.name.replace(".md", ""),
            folder: relativeDir || "00_Inbox",
            content: body,
            frontmatter,
            size: stats.size,
            mtime: stats.mtimeMs
          });
        }
      }
    } catch (err) {
      console.error("Error scanning directory:", currentDir, err);
    }
  }

  await scanDirectory(vaultPath);
  return notes;
});

// IPC Handler: Write Note
ipcMain.handle("notes:write", async (_, { vaultPath, folder, title, content, frontmatter }) => {
  try {
    const filename = `${title}.md`;
    const resolvedPath = validateAndResolvePath(vaultPath, folder, filename);

    // Create target directory if it doesn't exist
    const dirPath = path.dirname(resolvedPath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    // Build frontmatter block
    let fileContent = "";
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      fileContent += "---\n";
      for (const [key, value] of Object.entries(frontmatter)) {
        fileContent += `${key}: "${value}"\n`;
      }
      fileContent += "---\n\n";
    }
    fileContent += content;

    await fs.writeFile(resolvedPath, fileContent, "utf8");
    return { success: true, path: resolvedPath };
  } catch (err: any) {
    console.error("Failed to write note:", err);
    return { success: false, error: err.message };
  }
});

// IPC Handler: Delete Note
ipcMain.handle("notes:delete", async (_, { vaultPath, folder, title }) => {
  try {
    const filename = `${title}.md`;
    const resolvedPath = validateAndResolvePath(vaultPath, folder, filename);

    if (existsSync(resolvedPath)) {
      await fs.unlink(resolvedPath);
      return { success: true };
    }
    return { success: false, error: "Nota não encontrada" };
  } catch (err: any) {
    console.error("Failed to delete note:", err);
    return { success: false, error: err.message };
  }
});

// IPC Handler: System and Online/Offline state status
ipcMain.handle("system:status", () => {
  return {
    isOffline: false, // Can check network interface, defaults to false
    os: process.platform,
    configDir,
    configFilePath
  };
});
