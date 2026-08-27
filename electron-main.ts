import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";

let mainWindow: BrowserWindow | null = null;
let selectedVaultPath: string | null = null;
let obsidianConnectionAuthorized = false;

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

const SUPPORTED_KNOWLEDGE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt"]);
const MAX_AI_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_ASSET_CHARS = 120_000;
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.7-flash"];

const configDir = app.getPath("userData");
const configFilePath = path.join(configDir, "nisti_config.json");
const secretsFilePath = path.join(configDir, "nisti_secure_secrets.json");
const assetIndexFilePath = path.join(configDir, "nisti_asset_index.json");

interface AssetAnalysis {
  summary: string;
  keyFacts: string[];
  visibleText?: string;
  category?: string;
  keywords?: string[];
  epistemicStatus: "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";
  analyzedAt: string;
  model?: string;
}

interface CachedAssetEntry {
  mtime: number;
  size: number;
  analysis: AssetAnalysis;
}

type AssetIndex = Record<string, CachedAssetEntry>;

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
      currentConfig = JSON.parse(await fs.readFile(configFilePath, "utf8"));
    }
    const safeUpdates = { ...updates };
    delete safeUpdates.apiKey;
    delete safeUpdates.geminiApiKey;
    delete safeUpdates.token;
    delete safeUpdates.authorization;
    await fs.writeFile(configFilePath, JSON.stringify({ ...currentConfig, ...safeUpdates }, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}

async function loadAssetIndex(): Promise<AssetIndex> {
  try {
    if (!existsSync(assetIndexFilePath)) return {};
    const parsed = JSON.parse(await fs.readFile(assetIndexFilePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveAssetIndex(index: AssetIndex): Promise<void> {
  try {
    await fs.writeFile(assetIndexFilePath, JSON.stringify(index, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    console.warn("Could not persist knowledge asset index:", err);
  }
}

async function getSecureGeminiKey(): Promise<string> {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(secretsFilePath)) return "";
  try {
    const store = JSON.parse(await fs.readFile(secretsFilePath, "utf8"));
    const encrypted = store?.geminiApiKey;
    if (!encrypted) return "";
    return safeStorage.decryptString(Buffer.from(encrypted, "base64")).trim();
  } catch {
    return "";
  }
}

function requireObsidianConnection(): void {
  if (!obsidianConnectionAuthorized) {
    throw new Error("Obsidian não está conectado. Conecte e sincronize o Vault antes de acessar o banco de conhecimento.");
  }
}

function requireSelectedVault(): string {
  if (!selectedVaultPath) throw new Error("Vault do Obsidian não selecionado.");
  const resolvedVault = path.resolve(selectedVaultPath);
  if (!existsSync(resolvedVault)) {
    selectedVaultPath = null;
    obsidianConnectionAuthorized = false;
    throw new Error("Vault configurado não existe mais ou não está acessível.");
  }
  return resolvedVault;
}

function normalizeVaultFolder(folder: string): string {
  const normalized = String(folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) return "00_Inbox";
  const segments = normalized.split("/").filter(Boolean);
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === ".." || segment.startsWith(".") || /[<>:"|?*\x00-\x1F]/.test(segment))
  ) {
    throw new Error("Pasta inválida dentro do Vault do Obsidian.");
  }
  return segments.join(path.sep);
}

function validateAndResolvePath(folder: string, filename: string): string {
  requireObsidianConnection();
  const resolvedVault = requireSelectedVault();
  const cleanFilename = filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\.\.+/g, "_").trim();
  if (!cleanFilename) throw new Error("Nome de arquivo inválido.");
  const cleanFolder = normalizeVaultFolder(folder);
  const targetFilePath = path.resolve(resolvedVault, cleanFolder, cleanFilename);
  const vaultPrefix = resolvedVault.endsWith(path.sep) ? resolvedVault : `${resolvedVault}${path.sep}`;
  if (!targetFilePath.startsWith(vaultPrefix)) throw new Error("Violação de segurança: tentativa de acesso fora do limite do Vault Obsidian.");
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
  if (pattern.test(rawContent)) return rawContent.replace(pattern, block);
  const trimmed = rawContent.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

async function listVaultFolders(): Promise<string[]> {
  requireObsidianConnection();
  const targetVault = requireSelectedVault();
  const folders: string[] = [];
  async function scan(currentDir: string, relativeDir = "") {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      folders.push(relativePath.replace(/\\/g, "/"));
      await scan(path.join(currentDir, entry.name), relativePath);
    }
  }
  await scan(targetVault);
  return Array.from(new Set(folders)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeAnalysis(input: any, fallbackSummary: string, model?: string): AssetAnalysis {
  const keyFacts = Array.isArray(input?.keyFacts)
    ? input.keyFacts.map(String).map((v: string) => v.trim()).filter(Boolean).slice(0, 6)
    : [];
  const status = ["CONFIRMADO", "HIPÓTESE", "PENDENTE"].includes(String(input?.epistemicStatus).toUpperCase())
    ? String(input.epistemicStatus).toUpperCase() as AssetAnalysis["epistemicStatus"]
    : "PENDENTE";
  return {
    summary: String(input?.summary || fallbackSummary).trim().slice(0, 1200),
    keyFacts,
    visibleText: String(input?.visibleText || "").trim().slice(0, 3000) || undefined,
    category: String(input?.category || "Conhecimento do Vault").trim(),
    keywords: Array.isArray(input?.keywords) ? input.keywords.map(String).map((v: string) => v.trim()).filter(Boolean).slice(0, 10) : [],
    epistemicStatus: status,
    analyzedAt: new Date().toISOString(),
    model,
  };
}

function mimeForExtension(ext: string): string {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "text/plain";
}

async function callGeminiForAsset(fullPath: string, relativePath: string, ext: string): Promise<AssetAnalysis> {
  const apiKey = await getSecureGeminiKey();
  const stats = await fs.stat(fullPath);
  const fallbackSummary = `Arquivo ${path.basename(relativePath)} detectado no Vault. Análise inteligente pendente.`;
  if (!apiKey) return normalizeAnalysis({}, `${fallbackSummary} Configure a chave Gemini para interpretar o conteúdo automaticamente.`);
  if (stats.size > MAX_AI_ASSET_BYTES) return normalizeAnalysis({}, `${fallbackSummary} O arquivo excede o limite automático de 10 MB.`);

  const prompt = [
    "Você é o indexador de conhecimento do Nisti Marketing.",
    `Analise SOMENTE o conteúdo do arquivo '${path.basename(relativePath)}'.`,
    "Não invente preço, prazo, produto, métrica ou regra que não esteja visível no arquivo.",
    "Separe fatos explicitamente presentes de inferências. Se houver dúvida, use PENDENTE.",
    "Retorne JSON puro com: summary (máximo 5 frases), keyFacts (máximo 6 itens), visibleText (texto relevante visível, se houver), category, keywords e epistemicStatus (CONFIRMADO, HIPÓTESE ou PENDENTE).",
    "O resumo deve ser enxuto para aparecer no painel; o arquivo original permanece como fonte completa no Obsidian."
  ].join("\n");

  let mediaPart: any = null;
  let textPart = "";
  if (ext === ".txt") {
    textPart = (await fs.readFile(fullPath, "utf8")).slice(0, MAX_TEXT_ASSET_CHARS);
  } else {
    const buffer = await fs.readFile(fullPath);
    mediaPart = { inline_data: { mime_type: mimeForExtension(ext), data: buffer.toString("base64") } };
  }

  let lastError: unknown = null;
  for (const model of GEMINI_MODELS) {
    try {
      const parts: any[] = [{ text: textPart ? `${prompt}\n\nCONTEÚDO DE TEXTO:\n${textPart}` : prompt }];
      if (mediaPart) parts.push(mediaPart);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );
      if (!response.ok) {
        lastError = new Error(`Gemini HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json();
      const raw = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("") || "{}";
      const parsed = JSON.parse(stripJsonFence(raw));
      return normalizeAnalysis(parsed, fallbackSummary, model);
    } catch (err) {
      lastError = err;
    }
  }

  console.warn("Automatic Vault asset analysis failed:", lastError);
  return normalizeAnalysis({}, fallbackSummary);
}

function buildAssetKnowledgeNote(relativePath: string, relativeDir: string, ext: string, stats: { size: number; mtimeMs: number }, analysis: AssetAnalysis) {
  const fileName = path.basename(relativePath);
  const title = fileName.replace(/\.[^/.]+$/, "");
  const kind = ext === ".pdf" ? "pdf" : ext === ".txt" ? "text" : "image";
  const facts = analysis.keyFacts.length
    ? analysis.keyFacts.map((fact) => `- ${fact}`).join("\n")
    : "- Nenhum ponto confirmado foi extraído automaticamente.";
  const visible = analysis.visibleText ? `\n\n## Texto visível / extraído\n${analysis.visibleText}` : "";

  return {
    title,
    folder: (relativeDir || "00_Inbox").replace(/\\/g, "/"),
    content: `# ${title}\n\n## Resumo inteligente\n${analysis.summary}\n\n## Pontos importantes\n${facts}${visible}\n\n> Fonte completa: ${relativePath}\n> Estado epistemológico: ${analysis.epistemicStatus}`,
    frontmatter: {
      tipo: kind === "pdf" ? "Documento PDF" : kind === "image" ? "Ativo Visual" : "Documento de Texto",
      status: "EM REVISÃO",
      source_type: "vault_asset",
      asset_kind: kind,
      asset_path: relativePath.replace(/\\/g, "/"),
      asset_mtime: String(stats.mtimeMs),
      summary: analysis.summary,
      key_facts: analysis.keyFacts,
      visible_text: analysis.visibleText || "",
      category: analysis.category || "Conhecimento do Vault",
      epistemic_status: analysis.epistemicStatus,
      origem: relativePath.replace(/\\/g, "/"),
      tags: analysis.keywords || [],
      analyzed_at: analysis.analyzedAt,
      analyzed_model: analysis.model || "pending",
    },
    size: stats.size,
    mtime: stats.mtimeMs,
  };
}

async function scanVaultKnowledge(): Promise<any[]> {
  requireObsidianConnection();
  const targetVault = requireSelectedVault();
  const notes: any[] = [];
  const assets: Array<{ fullPath: string; relativePath: string; relativeDir: string; ext: string; size: number; mtimeMs: number }> = [];

  async function scanDirectory(currentDir: string, relativeDir = "") {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) await scanDirectory(fullPath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const stats = await fs.stat(fullPath);

      if (ext === ".md") {
        const content = await fs.readFile(fullPath, "utf8");
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
          folder: (relativeDir || "00_Inbox").replace(/\\/g, "/"),
          content: body,
          frontmatter,
          size: stats.size,
          mtime: stats.mtimeMs,
        });
      } else if (SUPPORTED_KNOWLEDGE_EXTENSIONS.has(ext)) {
        assets.push({ fullPath, relativePath, relativeDir, ext, size: stats.size, mtimeMs: stats.mtimeMs });
      }
    }
  }

  await scanDirectory(targetVault);

  const index = await loadAssetIndex();
  let indexChanged = false;
  for (const asset of assets) {
    const cacheKey = asset.relativePath.replace(/\\/g, "/");
    let analysis = index[cacheKey]?.analysis;
    if (!analysis || index[cacheKey].mtime !== asset.mtimeMs || index[cacheKey].size !== asset.size) {
      analysis = await callGeminiForAsset(asset.fullPath, asset.relativePath, asset.ext);
      index[cacheKey] = { mtime: asset.mtimeMs, size: asset.size, analysis };
      indexChanged = true;
    }
    notes.push(buildAssetKnowledgeNote(asset.relativePath, asset.relativeDir, asset.ext, asset, analysis));
  }

  const existingKeys = new Set(assets.map((asset) => asset.relativePath.replace(/\\/g, "/")));
  for (const key of Object.keys(index)) {
    if (!existingKeys.has(key)) {
      delete index[key];
      indexChanged = true;
    }
  }
  if (indexChanged) await saveAssetIndex(index);
  return notes;
}

function createWindow() {
  const baseDir = __dirname.endsWith("dist") ? __dirname : path.join(__dirname, "dist");
  const indexPath = path.join(baseDir, "index.html");
  const preloadPath = path.join(baseDir, "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    title: "Nisti Marketing",
    autoHideMenuBar: true,
    backgroundColor: "#f5f5f4",
    webPreferences: {
      preload: existsSync(preloadPath) ? preloadPath : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });
  mainWindow.setMenuBarVisibility(false);
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(indexPath).catch((err) => console.error("Erro ao carregar index.html:", err));
  }
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => console.error("Falha ao carregar conteúdo:", errorCode, errorDescription));
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await loadConfig();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("vault:select", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione a pasta raiz do Vault do Obsidian — Nisti Marketing",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const vaultPath = path.resolve(result.filePaths[0]);
  selectedVaultPath = vaultPath;
  for (const folder of STANDARD_FOLDERS) {
    const fullFolderPath = path.join(vaultPath, folder);
    if (!existsSync(fullFolderPath)) await fs.mkdir(fullFolderPath, { recursive: true });
  }
  await saveConfig({ vaultPath });
  return { vaultPath, foldersCreated: STANDARD_FOLDERS };
});

ipcMain.handle("vault:get-path", () => selectedVaultPath);
ipcMain.handle("vault:connection-state", (_event, connected: boolean) => {
  obsidianConnectionAuthorized = connected === true;
  return { success: true, connected: obsidianConnectionAuthorized };
});
ipcMain.handle("vault:list-folders", async () => await listVaultFolders());
ipcMain.handle("notes:read-all", async () => await scanVaultKnowledge());

ipcMain.handle("notes:write", async (_, payload: { folder: string; title: string; content: string; frontmatter?: any }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);
    const dirPath = path.dirname(resolvedPath);
    if (!existsSync(dirPath)) await fs.mkdir(dirPath, { recursive: true });
    let fileContent = "";
    if (payload.frontmatter && Object.keys(payload.frontmatter).length > 0) {
      fileContent += "---\n";
      for (const [key, value] of Object.entries(payload.frontmatter)) {
        if (Array.isArray(value)) {
          fileContent += `${key}:\n`;
          for (const item of value) fileContent += `  - "${item}"\n`;
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
    if (!existsSync(dirPath)) await fs.mkdir(dirPath, { recursive: true });
    const existingContent = existsSync(resolvedPath) ? await fs.readFile(resolvedPath, "utf8") : "";
    const separator = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
    await fs.writeFile(resolvedPath, existingContent ? `${existingContent}${separator}${payload.contentToAppend}` : payload.contentToAppend, "utf8");
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
    if (!existsSync(dirPath)) await fs.mkdir(dirPath, { recursive: true });
    const existingContent = existsSync(resolvedPath) ? await fs.readFile(resolvedPath, "utf8") : "";
    await fs.writeFile(resolvedPath, upsertManagedBlock(existingContent, payload.sectionId, payload.heading, payload.content), "utf8");
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
  appName: "Nisti Marketing",
  vaultPath: selectedVaultPath,
  obsidianConnectionAuthorized,
  runtime: "electron",
  isDesktop: true,
}));
