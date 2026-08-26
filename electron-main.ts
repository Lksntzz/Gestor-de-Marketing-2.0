import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";

let mainWindow: BrowserWindow | null = null;
let selectedVaultPath: string | null = null;

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

const configDir = app.getPath("userData");
const configFilePath = path.join(configDir, "nisti_config.json");

async function loadConfig() {
  try {
    if (existsSync(configFilePath)) {
      const data = await fs.readFile(configFilePath, "utf8");
      const config = JSON.parse(data);
      if (config.vaultPath && existsSync(config.vaultPath)) {
        selectedVaultPath = path.resolve(config.vaultPath);
      }
    }
  } catch (err) {
    console.error("Failed to load local config:", err);
  }
}

async function saveConfig(updates: any) {
  try {
    let currentConfig: any = {};
    if (existsSync(configFilePath)) {
      const data = await fs.readFile(configFilePath, "utf8");
      currentConfig = JSON.parse(data);
    }

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

function requireSelectedVault(): string {
  if (!selectedVaultPath) {
    throw new Error("Vault do Obsidian não selecionado.");
  }

  const resolvedVault = path.resolve(selectedVaultPath);
  if (!existsSync(resolvedVault)) {
    selectedVaultPath = null;
    throw new Error("Vault configurado não existe mais ou não está acessível.");
  }

  return resolvedVault;
}

function validateAndResolvePath(folder: string, filename: string): string {
  const resolvedVault = requireSelectedVault();

  const cleanFilename = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\.+/g, "_")
    .trim();

  if (!cleanFilename) {
    throw new Error("Nome de arquivo inválido.");
  }

  const cleanFolder = STANDARD_FOLDERS.includes(folder) ? folder : "00_Inbox";
  const targetFilePath = path.resolve(resolvedVault, cleanFolder, cleanFilename);

  if (!targetFilePath.startsWith(resolvedVault + path.sep)) {
    throw new Error("Violação de segurança: tentativa de acesso fora do limite do Vault Obsidian.");
  }

  return targetFilePath;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSectionId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "managed-section";
}

function upsertManagedBlock(rawContent: string, sectionId: string, heading: string, body: string): string {
  const safeId = normalizeSectionId(sectionId);
  const start = `<!-- nisti:start:${safeId} -->`;
  const end = `<!-- nisti:end:${safeId} -->`;
  const block = `${start}\n## ${heading}\n${body.trim()}\n${end}`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, "m");

  if (pattern.test(rawContent)) {
    return rawContent.replace(pattern, block);
  }

  const trimmed = rawContent.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
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

ipcMain.handle("vault:select", async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione o seu Vault do Obsidian (Nisti Print PKM)",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const vaultPath = path.resolve(result.filePaths[0]);
  selectedVaultPath = vaultPath;

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

ipcMain.handle("vault:get-path", () => selectedVaultPath);

ipcMain.handle("notes:read-all", async () => {
  let targetVault: string;
  try {
    targetVault = requireSelectedVault();
  } catch {
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

ipcMain.handle("notes:write", async (_, payload: { folder: string; title: string; content: string; frontmatter?: any }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);

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

ipcMain.handle("notes:append", async (_, payload: { folder: string; title: string; contentToAppend: string }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);

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

ipcMain.handle("notes:upsert-section", async (_, payload: { folder: string; title: string; sectionId: string; heading: string; content: string }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);
    const dirPath = path.dirname(resolvedPath);

    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const existingContent = existsSync(resolvedPath) ? await fs.readFile(resolvedPath, "utf8") : "";
    const updatedContent = upsertManagedBlock(existingContent, payload.sectionId, payload.heading, payload.content);
    await fs.writeFile(resolvedPath, updatedContent, "utf8");

    return { success: true, path: resolvedPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("notes:delete", async (_, payload: { folder: string; title: string }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);

    if (existsSync(resolvedPath)) {
      await fs.unlink(resolvedPath);
      return { success: true };
    }
    return { success: false, error: "Nota não encontrada." };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("system:status", () => ({
  os: process.platform,
  vaultPath: selectedVaultPath,
  runtime: "electron",
  isDesktop: true,
}));
