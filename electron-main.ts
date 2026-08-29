import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import crypto from "crypto";
import { DEFAULT_AI_MODELS, executeWithModelFallback } from "./src/services/ai/AIProviderFactory";
import type { AIProviderName } from "./src/services/ai/AIProvider";
import { KnowledgeIndex } from "./src/services/knowledge/index/KnowledgeIndex";
import { VaultIndexer } from "./src/services/knowledge/index/VaultIndexer";
import { VaultWatcher } from "./src/services/knowledge/index/VaultWatcher";
import { knowledgeContextService } from "./src/services/knowledge/KnowledgeContextService";
import { AutoUpdateService } from "./src/electron/update/AutoUpdateService";

let mainWindow: BrowserWindow | null = null;
let selectedVaultPath: string | null = null;
let obsidianConnectionAuthorized = false;

let knowledgeIndex: KnowledgeIndex | null = null;
let vaultWatcher: VaultWatcher | null = null;

function requireKnowledgeIndex(): KnowledgeIndex {
  if (!knowledgeIndex) {
    const dbPath = path.join(app.getPath("userData"), "knowledge_index.sqlite");
    knowledgeIndex = new KnowledgeIndex(dbPath);
  }
  return knowledgeIndex;
}

function startVaultWatcher(vaultPath: string) {
  if (vaultWatcher) vaultWatcher.stop();
  const index = requireKnowledgeIndex();
  const vaultId = crypto.createHash("sha256").update(vaultPath).digest("hex");
  const indexer = new VaultIndexer(index, vaultPath, vaultId, callAIForAsset);
  vaultWatcher = new VaultWatcher(indexer, vaultPath);
  vaultWatcher.start();
}

const STANDARD_FOLDERS = [
  "00_Inbox",
  "00_Base",
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
const PERSISTABLE_SOURCE_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const MAX_AI_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_PERSISTED_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_ASSET_CHARS = 120_000;
const GEMINI_ASSET_MODELS = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.7-flash"];

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

interface KnowledgeCommitPayload {
  folder: string;
  title: string;
  content: string;
  frontmatter?: Record<string, unknown>;
  failIfExists?: boolean;
  asset?: {
    fileName: string;
    dataUrl: string;
  };
}

type AssetIndex = Record<string, CachedAssetEntry>;

async function ensureStandardFolders(vaultPath: string): Promise<void> {
  for (const folder of STANDARD_FOLDERS) {
    const fullFolderPath = path.join(vaultPath, folder);
    if (!existsSync(fullFolderPath)) await fs.mkdir(fullFolderPath, { recursive: true });
  }
}

async function loadConfig() {
  try {
    if (existsSync(configFilePath)) {
      const data = await fs.readFile(configFilePath, "utf8");
      const config = JSON.parse(data);
      if (config.vaultPath && existsSync(config.vaultPath)) {
        selectedVaultPath = path.resolve(config.vaultPath);
        await ensureStandardFolders(selectedVaultPath);
        startVaultWatcher(selectedVaultPath);
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
    delete safeUpdates.openaiApiKey;
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

async function getSecureSecret(key: string): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(secretsFilePath)) return null;
  try {
    const store = JSON.parse(await fs.readFile(secretsFilePath, "utf8"));
    const encrypted = store?.[key];
    if (!encrypted) return null;
    return safeStorage.decryptString(Buffer.from(encrypted, "base64")).trim();
  } catch {
    return null;
  }
}

async function getAIConfig(): Promise<{ provider: AIProviderName; model: string; apiKey: string; hasExplicitModel: boolean }> {
  let persisted: { aiProvider?: AIProviderName; aiModel?: string } = {};
  try {
    if (existsSync(configFilePath)) persisted = JSON.parse(await fs.readFile(configFilePath, "utf8"));
  } catch {
    persisted = {};
  }
  const provider = persisted.aiProvider === "openai" ? "openai" : "gemini";
  const apiKey = (await getSecureSecret(provider === "openai" ? "openaiApiKey" : "geminiApiKey")) || "";
  const configuredModel = persisted.aiModel?.trim() || "";
  return {
    provider,
    model: configuredModel || DEFAULT_AI_MODELS[provider],
    apiKey,
    hasExplicitModel: Boolean(configuredModel),
  };
}

ipcMain.handle("ai:config:set", async (_, config: { provider?: string; model?: string }) => {
  const provider = config?.provider === "openai" ? "openai" : "gemini";
  await saveConfig({ aiProvider: provider, aiModel: String(config?.model || "").trim() });
  return { success: true };
});

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

function vaultRelativePath(fullPath: string): string {
  const targetVault = requireSelectedVault();
  return path.relative(targetVault, fullPath).replace(/\\/g, "/");
}

async function requireExistingVaultFolder(folder: string): Promise<string> {
  requireObsidianConnection();
  const targetVault = requireSelectedVault();
  const cleanFolder = normalizeVaultFolder(folder);
  const folderPath = path.resolve(targetVault, cleanFolder);
  const vaultPrefix = targetVault.endsWith(path.sep) ? targetVault : `${targetVault}${path.sep}`;
  if (!folderPath.startsWith(vaultPrefix) || !existsSync(folderPath)) {
    throw new Error("A pasta selecionada não existe no Vault atual. Atualize a lista de pastas antes de salvar.");
  }
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) throw new Error("O destino selecionado não é uma pasta válida do Vault.");
  return cleanFolder;
}

async function resolveUniqueVaultPath(folder: string, requestedFileName: string): Promise<string> {
  const extension = path.extname(requestedFileName);
  const stem = path.basename(requestedFileName, extension) || "Arquivo";
  for (let index = 1; index <= 999; index += 1) {
    const candidate = index === 1 ? requestedFileName : `${stem} (${index})${extension}`;
    const resolved = validateAndResolvePath(folder, candidate);
    if (!existsSync(resolved)) return resolved;
  }
  throw new Error("Não foi possível gerar um nome de arquivo livre no Vault sem sobrescrever conteúdo existente.");
}

function serializeFrontmatter(frontmatter?: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) return "";
  let output = "---\n";
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      output += `${key}:\n`;
      for (const item of value) output += `  - "${String(item).replace(/"/g, "'")}"\n`;
    } else {
      output += `${key}: "${String(value).replace(/"/g, "'")}"\n`;
    }
  }
  return `${output}---\n\n`;
}

function decodePersistedAsset(fileName: string, dataUrl: string): { buffer: Buffer; extension: string } {
  const extension = path.extname(fileName).toLowerCase();
  if (!PERSISTABLE_SOURCE_EXTENSIONS.has(extension)) {
    throw new Error("Somente PDF, PNG, JPG/JPEG e WEBP podem ser preservados como fonte binária nesta etapa.");
  }

  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new Error("A fonte binária recebida não está em um Data URL base64 válido.");

  const allowedMimeByExtension: Record<string, string[]> = {
    ".pdf": ["application/pdf"],
    ".png": ["image/png"],
    ".jpg": ["image/jpeg"],
    ".jpeg": ["image/jpeg"],
    ".webp": ["image/webp"],
  };
  const mime = match[1].toLowerCase();
  if (!allowedMimeByExtension[extension]?.includes(mime)) {
    throw new Error("O tipo real da fonte não corresponde à extensão informada.");
  }

  const buffer = Buffer.from(match[2].replace(/[\r\n]/g, ""), "base64");
  if (buffer.length === 0) throw new Error("A fonte binária está vazia.");
  if (buffer.length > MAX_PERSISTED_ASSET_BYTES) {
    throw new Error("A fonte excede o limite de preservação local de 20 MB.");
  }
  return { buffer, extension };
}

function assetKindForExtension(extension: string): "pdf" | "image" {
  return extension === ".pdf" ? "pdf" : "image";
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

async function callAIForAsset(fullPath: string, relativePath: string, ext: string): Promise<AssetAnalysis> {
  const aiConfig = await getAIConfig();
  const stats = await fs.stat(fullPath);
  const fallbackSummary = `Arquivo ${path.basename(relativePath)} detectado no Vault. Análise inteligente pendente.`;
  if (!aiConfig.apiKey) return normalizeAnalysis({}, `${fallbackSummary} Configure a chave do provedor ${aiConfig.provider} para interpretar o conteúdo automaticamente.`);
  if (stats.size > MAX_AI_ASSET_BYTES) return normalizeAnalysis({}, `${fallbackSummary} O arquivo excede o limite automático de 10 MB.`);

  const prompt = [
    "Você é o indexador de conhecimento do Nisti Marketing.",
    `Analise SOMENTE o conteúdo do arquivo '${path.basename(relativePath)}'.`,
    "Não invente preço, prazo, produto, métrica ou regra que não esteja visível no arquivo.",
    "Separe fatos explicitamente presentes de inferências. Se houver dúvida, use PENDENTE.",
    "Retorne JSON puro com: summary (máximo 5 frases), keyFacts (máximo 6 itens), visibleText (texto relevante visível, se houver), category, keywords e epistemicStatus (CONFIRMADO, HIPÓTESE ou PENDENTE).",
    "O resumo deve ser enxuto para aparecer no painel; o arquivo original permanece como fonte completa no Obsidian."
  ].join("\n");

  let attachment: { mimeType: string; data: string; fileName: string } | undefined;
  let textPart = "";
  if (ext === ".txt") {
    textPart = (await fs.readFile(fullPath, "utf8")).slice(0, MAX_TEXT_ASSET_CHARS);
  } else {
    const buffer = await fs.readFile(fullPath);
    attachment = { mimeType: mimeForExtension(ext), data: buffer.toString("base64"), fileName: path.basename(relativePath) };
  }

  try {
    const models = aiConfig.provider === "gemini" && !aiConfig.hasExplicitModel
      ? GEMINI_ASSET_MODELS
      : [aiConfig.model];
    const result = await executeWithModelFallback<any>(aiConfig, models, {
      prompt: textPart ? `${prompt}\n\nCONTEÚDO DE TEXTO:\n${textPart}` : prompt,
      temperature: aiConfig.provider === "gemini" ? 0.1 : undefined,
      schemaName: "vault_asset_analysis",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          keyFacts: { type: "array", items: { type: "string" } },
          visibleText: { type: "string" },
          category: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          epistemicStatus: { type: "string" },
        },
        required: ["summary", "keyFacts", "epistemicStatus"],
      },
      attachments: attachment ? [attachment] : [],
    });
    return normalizeAnalysis(result.data, fallbackSummary, result.model);
  } catch (error) {
    console.warn("Automatic Vault asset analysis failed:", error);
    return normalizeAnalysis({}, fallbackSummary);
  }
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

  const curatedAssetVersions = new Map<string, number>();
  for (const note of notes) {
    const assetPath = String(note.frontmatter?.asset_path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const assetMtime = Number(note.frontmatter?.asset_mtime);
    if (assetPath && Number.isFinite(assetMtime)) curatedAssetVersions.set(assetPath, assetMtime);
  }

  const index = await loadAssetIndex();
  let indexChanged = false;
  for (const asset of assets) {
    const cacheKey = asset.relativePath.replace(/\\/g, "/");
    const curatedMtime = curatedAssetVersions.get(cacheKey);
    if (curatedMtime !== undefined && Math.abs(curatedMtime - asset.mtimeMs) < 1) {
      continue;
    }

    let analysis = index[cacheKey]?.analysis;
    if (!analysis || index[cacheKey].mtime !== asset.mtimeMs || index[cacheKey].size !== asset.size) {
      analysis = await callAIForAsset(asset.fullPath, asset.relativePath, asset.ext);
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
  mainWindow.webContents.on("did-finish-load", () => {
    AutoUpdateService.getInstance().startBackgroundChecks();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await loadConfig();

  const updateService = AutoUpdateService.getInstance();
  updateService.setCleanupHandler(async () => {
    if (vaultWatcher) {
      try { vaultWatcher.stop(); } catch {}
    }
    if (knowledgeIndex) {
      try { knowledgeIndex.close(); } catch {}
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  AutoUpdateService.getInstance().destroy();
  if (vaultWatcher) {
    vaultWatcher.stop();
  }
  if (knowledgeIndex) {
    knowledgeIndex.close();
  }
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
  startVaultWatcher(vaultPath);
  await ensureStandardFolders(vaultPath);
  await saveConfig({ vaultPath });
  return { vaultPath, foldersCreated: STANDARD_FOLDERS };
});

ipcMain.handle("vault:get-path", () => selectedVaultPath);
ipcMain.handle("vault:connection-state", (_event, connected: boolean) => {
  obsidianConnectionAuthorized = connected === true;
  return { success: true, connected: obsidianConnectionAuthorized };
});
ipcMain.handle("vault:list-folders", async () => await listVaultFolders());
ipcMain.handle("knowledge:query", async (_, query: string, preferredPaths?: string[]) => {
  if (!selectedVaultPath) return { sources: [] };
  const vaultId = crypto.createHash("sha256").update(selectedVaultPath).digest("hex");
  const index = requireKnowledgeIndex();
  const docs = index.getDocumentsByVault(vaultId);
  
  const notes = docs.map(doc => ({
    id: doc.id,
    path: doc.relative_path,
    title: doc.title,
    folder: path.dirname(doc.relative_path).replace(/\\/g, "/"),
    content: doc.content,
    frontmatter: JSON.parse(doc.metadata_json || "{}"),
    tags: [],
    wikilinks: [],
    lastModified: new Date(doc.modified_at).toISOString(),
    sizeBytes: doc.size,
  }));

  const selection = knowledgeContextService.select({
    query,
    notes,
    preferredSourcePaths: preferredPaths,
  });

  return { sources: selection.sources, warning: selection.warning };
});
ipcMain.handle("notes:read-all", async () => await scanVaultKnowledge());

ipcMain.handle("knowledge:commit", async (_, payload: KnowledgeCommitPayload) => {
  let persistedAssetPath: string | null = null;
  try {
    const folder = await requireExistingVaultFolder(payload.folder);
    const title = String(payload.title || "Novo Conhecimento").trim();
    const content = String(payload.content || "").trim();
    if (!title || !content) throw new Error("Título e conteúdo são obrigatórios para gravar conhecimento.");

    let assetMetadata: {
      relativePath: string;
      storedFileName: string;
      mtimeMs: number;
      size: number;
      kind: "pdf" | "image";
    } | null = null;

    if (payload.asset) {
      const decoded = decodePersistedAsset(payload.asset.fileName, payload.asset.dataUrl);
      const assetPath = await resolveUniqueVaultPath(folder, payload.asset.fileName);
      await fs.writeFile(assetPath, decoded.buffer, { flag: "wx" });
      persistedAssetPath = assetPath;
      const stats = await fs.stat(assetPath);
      assetMetadata = {
        relativePath: vaultRelativePath(assetPath),
        storedFileName: path.basename(assetPath),
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        kind: assetKindForExtension(decoded.extension),
      };
    }

    const requestedNotePath = validateAndResolvePath(folder, `${title}.md`);
    if (payload.failIfExists && existsSync(requestedNotePath)) {
      throw new Error(`O documento canônico ${vaultRelativePath(requestedNotePath)} já existe. A gravação foi bloqueada para evitar duplicação.`);
    }
    const notePath = payload.failIfExists
      ? requestedNotePath
      : await resolveUniqueVaultPath(folder, `${title}.md`);
    const noteTitle = path.basename(notePath, ".md");
    const frontmatter: Record<string, unknown> = { ...(payload.frontmatter || {}) };
    let noteBody = content;

    if (assetMetadata) {
      frontmatter.source_type = "curated_asset";
      frontmatter.asset_kind = assetMetadata.kind;
      frontmatter.asset_path = assetMetadata.relativePath;
      frontmatter.asset_mtime = String(assetMetadata.mtimeMs);
      frontmatter.asset_size = String(assetMetadata.size);
      frontmatter.origem = assetMetadata.relativePath;
      noteBody = `${noteBody.trim()}\n\n## Fonte original\n[[${assetMetadata.relativePath}]]`;
    }

    await fs.writeFile(notePath, `${serializeFrontmatter(frontmatter)}${noteBody}`, { encoding: "utf8", flag: "wx" });

    return {
      success: true,
      noteTitle,
      noteRelativePath: vaultRelativePath(notePath),
      assetRelativePath: assetMetadata?.relativePath,
      assetFileName: assetMetadata?.storedFileName,
      assetMtimeMs: assetMetadata?.mtimeMs,
      assetSize: assetMetadata?.size,
    };
  } catch (err: any) {
    if (persistedAssetPath && existsSync(persistedAssetPath)) {
      try {
        await fs.unlink(persistedAssetPath);
      } catch (cleanupError) {
        console.warn("Could not roll back knowledge asset after note failure:", cleanupError);
      }
    }
    return { success: false, error: err.message || "Falha ao gravar conhecimento no Vault." };
  }
});

ipcMain.handle("notes:write", async (_, payload: { folder: string; title: string; content: string; frontmatter?: any }) => {
  try {
    const filename = payload.title.endsWith(".md") ? payload.title : `${payload.title}.md`;
    const resolvedPath = validateAndResolvePath(payload.folder, filename);
    const dirPath = path.dirname(resolvedPath);
    if (!existsSync(dirPath)) await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(resolvedPath, `${serializeFrontmatter(payload.frontmatter)}${payload.content}`, "utf8");
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

ipcMain.handle("editorial:list", async () => {
  const index = requireKnowledgeIndex();
  return index.getEditorialItems().map(row => ({
    id: row.id,
    title: row.title,
    contentType: row.content_type,
    platform: row.platform,
    objective: row.objective,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    status: row.status,
    priority: row.priority,
    ideaId: row.idea_id,
    scriptId: row.script_id,
    campaignId: row.campaign_id,
    obsidianPath: row.obsidian_path,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
});

ipcMain.handle("editorial:upsert", async (_, item: any) => {
  const index = requireKnowledgeIndex();
  index.upsertEditorialItem(item);
  return { success: true };
});

ipcMain.handle("editorial:delete", async (_, id: string) => {
  const index = requireKnowledgeIndex();
  index.deleteEditorialItem(id);
  return { success: true };
});

ipcMain.handle("system:status", () => ({
  os: process.platform,
  appName: "Nisti Marketing",
  vaultPath: selectedVaultPath,
  obsidianConnectionAuthorized,
  runtime: "electron",
  isDesktop: true,
}));

ipcMain.handle("update:get-status", async () => {
  return AutoUpdateService.getInstance().getState();
});

ipcMain.handle("update:check", async () => {
  return AutoUpdateService.getInstance().checkForUpdates();
});

ipcMain.handle("update:install", async () => {
  return AutoUpdateService.getInstance().installUpdate();
});
