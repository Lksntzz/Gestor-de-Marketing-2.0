import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";

let mainWindow: BrowserWindow | null = null;
let selectedVaultPath: string | null = null;

// Official 10 Obsidian vault folders
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

// Local Config Path
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
    // Strictly strip any secrets or API tokens from being stored in plain JSON config
    const safeUpdates = { ...updates };
    delete safeUpdates.apiKey;
    delete safeUpdates.geminiApiKey;
    delete safeUpdates.token;
    delete safeUpdates.authorization;

    const finalConfig = { ...currentConfig, ...safeUpdates };
    await fs.writeFile(configFilePath, JSON.stringify(finalConfig, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}

// P0 Security: Strict path resolution preventing directory traversal and escape
function validateAndResolvePath(vaultPath: string, folder: string, filename: string): string {
  if (!vaultPath || typeof vaultPath !== "string") {
    throw new Error("Caminho do Vault inválido ou não configurado.");
  }

  const cleanFilename = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim();

  if (!cleanFilename) {
    throw new Error("Nome de arquivo inválido.");
  }

  const cleanFolder = STANDARD_FOLDERS.includes(folder) ? folder : "00_Inbox";
  const resolvedVault = path.resolve(vaultPath);
  const targetFilePath = path.resolve(resolvedVault, cleanFolder, cleanFilename);

  // Strict boundary check: target must be inside resolvedVault
  if (!targetFilePath.startsWith(resolvedVault + path.sep) && targetFilePath !== resolvedVault) {
    throw new Error("Violação de segurança: Tentativa de acesso fora do limite do Vault Obsidian.");
  }

  return targetFilePath;
}

function createWindow() {
  const baseDir = __dirname.endsWith("dist") ? __dirname : path.join(__dirname, "dist");

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    title: "Nisti Print PKM Marketing Hub (Desktop Local-First)",
    webPreferences: {
      preload: path.join(baseDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(baseDir, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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
    title: "Selecione o seu Vault do Obsidian (Nisti Print PKM)",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const vaultPath = result.filePaths[0];
  selectedVaultPath = vaultPath;

  // Auto-scaffold the 10 standard directories
  for (const folder of STANDARD_FOLDERS) {
    const fullFolderPath = path.join(vaultPath, folder);
    if (!existsSync(fullFolderPath)) {
      await fs.mkdir(fullFolderPath, { recursive: true });
    }
  }

  await saveConfig({ vaultPath });

  return {
    vaultPath,
    foldersCreated: STANDARD_FOLDERS
  };
});

ipcMain.handle("vault:get-path", () => {
  return selectedVaultPath;
});

// IPC Handler: Read all Markdown files safely
ipcMain.handle("notes:read-all", async (_, vaultPath: string) => {
  const targetVault = vaultPath || selectedVaultPath;
  if (!targetVault || !existsSync(targetVault)) {
    return [];
  }

  const notes: any[] = [];

  async function scanDirectory(currentDir: string, relativeDir: string = "") {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

        if (entry.isDirectory()) {
          // Skip hidden folders (.obsidian, .git)
          if (!entry.name.startsWith(".")) {
            await scanDirectory(fullPath, relativePath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const content = await fs.readFile(fullPath, "utf8");
          const stats = await fs.stat(fullPath);

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
            title: entry.name.replace(/\.md$/, ""),
            folder: relativeDir || "00_Inbox",
            content: body,
            frontmatter,
            size: stats.size,
            mtime: stats.mtimeMs
          });
        }
      }
    } catch (err) {
      console.error("Error scanning vault directory:", err);
    }
  }

  await scanDirectory(targetVault);
  return notes;
});

// IPC Handler: Write Note with P0 Path Validation
ipcMain.handle("notes:write", async (_, payload: { vaultPath?: string; folder: string; title: string; content: string; frontmatter?: any }) => {
  try {
    const vault = payload.vaultPath || selectedVaultPath;
    if (!vault) throw new Error("Vault path is missing.");

    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(vault, payload.folder, filename);

    const dirPath = path.dirname(resolvedPath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    let fileContent = "";
    if (payload.frontmatter && Object.keys(payload.frontmatter).length > 0) {
      fileContent += "---\n";
      for (const [key, value] of Object.entries(payload.frontmatter)) {
        if (Array.isArray(value)) {
          fileContent += `${key}:\n`;
          for (const item of value) {
            fileContent += `  - "${item}"\n`;
          }
        } else {
          fileContent += `${key}: "${value}"\n`;
        }
      }
      fileContent += "---\n\n";
    }
    fileContent += payload.content;

    await fs.writeFile(resolvedPath, fileContent, "utf8");
    return { success: true, path: resolvedPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// IPC Handler: Append to Note safely preserving existing content
ipcMain.handle("notes:append", async (_, payload: { vaultPath?: string; folder: string; title: string; contentToAppend: string }) => {
  try {
    const vault = payload.vaultPath || selectedVaultPath;
    if (!vault) throw new Error("Vault path is missing.");

    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(vault, payload.folder, filename);

    const dirPath = path.dirname(resolvedPath);
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    let existingContent = "";
    if (existsSync(resolvedPath)) {
      existingContent = await fs.readFile(resolvedPath, "utf8");
    }

    const separator = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
    const updatedContent = existingContent ? `${existingContent}${separator}${payload.contentToAppend}` : payload.contentToAppend;

    await fs.writeFile(resolvedPath, updatedContent, "utf8");
    return { success: true, path: resolvedPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// IPC Handler: Delete Note safely
ipcMain.handle("notes:delete", async (_, payload: { vaultPath?: string; folder: string; title: string }) => {
  try {
    const vault = payload.vaultPath || selectedVaultPath;
    if (!vault) throw new Error("Vault path is missing.");

    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(vault, payload.folder, filename);

    if (existsSync(resolvedPath)) {
      await fs.unlink(resolvedPath);
      return { success: true };
    }
    return { success: false, error: "Nota não encontrada." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// IPC Handler: System Info
ipcMain.handle("system:status", () => {
  return {
    os: process.platform,
    vaultPath: selectedVaultPath,
    runtime: "electron",
    isDesktop: true,
  };
});
