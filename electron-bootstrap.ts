import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import http from "http";
import net from "net";
import crypto from "crypto";
import * as path from "path";
import {
  confirmAIConnectionProvider,
  getAIConnectionRuntimeState,
  resetAIConnectionRuntimeState,
  revokeAIConnectionSecretStoreKey,
  validateAIConnectionModel,
} from "./src/electron/ai/registerAIConnectionRuntimeIpc";
import { assertTrustedIpcSender } from "./src/electron/security/trustedRenderer";
import { registerVaultIpcHandlers } from "./src/electron/knowledge/registerVaultIpc";

const STABLE_USER_DATA_NAME = "Nisti Print PKM Marketing Hub";
const stableUserDataPath = path.join(app.getPath("appData"), STABLE_USER_DATA_NAME);
app.setPath("userData", stableUserDataPath);
app.setName("Nisti Marketing");

const LOOPBACK_HOST = "127.0.0.1";
const ALLOWED_SECRET_NAMES = new Set(["obsidianApiKey", "geminiApiKey", "openaiApiKey"]);
const AI_CONNECTION_SECRET_NAME = "aiConnectionKey";
const STARTUP_LOG_MAX_BYTES = 512 * 1024;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

let backendProcess: ChildProcess | null = null;
let appUrl = "";
let backendInstanceId = "";
let internalSyncToken = "";
let apiSessionToken = "";
let startupWindow: BrowserWindow | null = null;
let startupTitle = "Iniciando Nisti Marketing";
let startupMessage = "Preparando o backend local e carregando suas configurações...";
let startupError = false;

if (!hasSingleInstanceLock) {
  app.quit();
}

function getSecretsFilePath(): string {
  return path.join(app.getPath("userData"), "nisti_secure_secrets.json");
}

function getStartupLogPath(): string {
  return path.join(app.getPath("userData"), "startup.log");
}

async function appendStartupLog(message: string): Promise<void> {
  try {
    const logPath = getStartupLogPath();
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    try {
      const stat = await fs.stat(logPath);
      if (stat.size > STARTUP_LOG_MAX_BYTES) {
        await fs.writeFile(logPath, "", "utf8");
      }
    } catch {
      // First run: log file does not exist yet.
    }
    const safeMessage = String(message || "").replace(/[\r\n]+/g, " ").slice(0, 4000);
    await fs.appendFile(logPath, `[${new Date().toISOString()}] ${safeMessage}\n`, "utf8");
  } catch {
    // Startup diagnostics must never prevent the app from opening.
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function startupDataUrl(): string {
  const accent = startupError ? "#b91c1c" : "#111827";
  const statusLabel = startupError ? "Falha na inicialização" : "Inicializando";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nisti Marketing</title>
<style>
  html,body{height:100%;margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f5f5f4;color:#1c1917}
  body{display:flex;align-items:center;justify-content:center}
  .card{width:min(520px,calc(100vw - 48px));background:#fff;border:1px solid #e7e5e4;border-radius:18px;padding:30px;box-shadow:0 18px 50px rgba(28,25,23,.12)}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};margin-bottom:10px}
  h1{font-size:25px;line-height:1.2;margin:0 0 12px}
  p{font-size:14px;line-height:1.55;color:#57534e;margin:0}
  .bar{height:4px;background:#e7e5e4;border-radius:99px;overflow:hidden;margin-top:24px}
  .bar::after{content:"";display:block;width:38%;height:100%;background:${accent};border-radius:99px;animation:move 1.2s ease-in-out infinite}
  .path{font-size:11px;color:#78716c;margin-top:18px;word-break:break-all}
  @keyframes move{0%{transform:translateX(-110%)}100%{transform:translateX(300%)}}
</style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">${statusLabel}</div>
    <h1>${escapeHtml(startupTitle)}</h1>
    <p>${escapeHtml(startupMessage)}</p>
    ${startupError ? `<div class="path">Log de diagnóstico: ${escapeHtml(getStartupLogPath())}</div>` : `<div class="bar"></div>`}
  </main>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function renderStartupStatus(): Promise<void> {
  if (!startupWindow || startupWindow.isDestroyed()) return;
  try {
    await startupWindow.loadURL(startupDataUrl());
  } catch {
    // The main application window may already be taking over.
  }
}

async function setStartupStatus(title: string, message: string, isError = false): Promise<void> {
  startupTitle = title;
  startupMessage = message;
  startupError = isError;
  await renderStartupStatus();
}

function createStartupWindow(): void {
  if (startupWindow && !startupWindow.isDestroyed()) return;
  startupWindow = new BrowserWindow({
    width: 600,
    height: 360,
    minWidth: 520,
    minHeight: 320,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#f5f5f4",
    title: "Nisti Marketing",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  startupWindow.setMenuBarVisibility(false);
  startupWindow.on("closed", () => {
    startupWindow = null;
  });
  void renderStartupStatus();
}

function closeStartupWindow(): void {
  if (startupWindow && !startupWindow.isDestroyed()) {
    startupWindow.close();
  }
  startupWindow = null;
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
    const target = windows.find((window) => window !== startupWindow) || startupWindow || windows[0];
    if (!target) return;
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
  });

  app.whenReady().then(() => {
    createStartupWindow();
    void appendStartupLog("Electron ready; startup window displayed.");
  });
}

async function readSecretStore(): Promise<Record<string, string>> {
  try {
    const filePath = getSecretsFilePath();
    if (!existsSync(filePath)) return {};
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function writeSecretStore(store: Record<string, string>): Promise<void> {
  const filePath = getSecretsFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
}

function readStoredSecretValue(store: Record<string, string>, name: string): string | null {
  const encrypted = store[name];
  if (!encrypted) return "";
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    // An unreadable previous value cannot be proven equivalent to the new one.
    // Treat it as a credential change and revoke dependent AI metadata first.
    return null;
  }
}

async function syncAllSecretsWithBackend(): Promise<void> {
  if (!appUrl) return;
  try {
    const store = await readSecretStore();
    let obsidianKey = readStoredSecretValue(store, "obsidianApiKey") || "";
    let geminiKey = readStoredSecretValue(store, "geminiApiKey") || "";
    let openaiKey = readStoredSecretValue(store, "openaiApiKey") || "";

    const stateSnapshot = await getAIConnectionRuntimeState();
    const activeProvider = stateSnapshot?.state?.provider;
    const aiConnKey = readStoredSecretValue(store, AI_CONNECTION_SECRET_NAME) || "";

    if (aiConnKey) {
      if (activeProvider === "gemini") {
        geminiKey = aiConnKey;
      } else if (activeProvider === "openai") {
        openaiKey = aiConnKey;
      }
    }

    const req = http.request(
      `${appUrl}/api/internal/update-secrets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nisti-internal-sync-token": internalSyncToken,
          "x-app-session-token": apiSessionToken,
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          console.error(`Sincronização de segredos local falhou com status: ${res.statusCode}`);
        }
        res.resume();
      }
    );
    req.on("error", () => {});
    req.write(
      JSON.stringify({
        obsidianApiKey: obsidianKey,
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
      })
    );
    req.end();
  } catch (err) {
    console.error("Failed to sync secrets with local backend:", err);
  }
}

ipcMain.handle("secret:set", async (event, name: string, value: string) => {
  assertTrustedIpcSender(event);
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("OS secure storage is unavailable.");

  const store = await readSecretStore();
  const previousValue = readStoredSecretValue(store, name);
  const nextValue = value || "";

  if (previousValue === nextValue) return { success: true };

  await revokeAIConnectionSecretStoreKey(name);

  if (!nextValue) {
    delete store[name];
  } else {
    store[name] = safeStorage.encryptString(nextValue).toString("base64");
  }
  await writeSecretStore(store);
  void syncAllSecretsWithBackend();
  return { success: true };
});

ipcMain.handle("secret:get", async (event, name: string) => {
  assertTrustedIpcSender(event);
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  if (!safeStorage.isEncryptionAvailable()) return "";

  try {
    const store = await readSecretStore();
    const encrypted = store[name];
    if (!encrypted) return "";
    return "saved-in-secure-storage";
  } catch {
    return "";
  }
});

ipcMain.handle("secret:has", async (event, name: string) => {
  assertTrustedIpcSender(event);
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  try {
    const store = await readSecretStore();
    const encrypted = store[name];
    return !!encrypted;
  } catch {
    return false;
  }
});

ipcMain.handle("secret:delete", async (event, name: string) => {
  assertTrustedIpcSender(event);
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");

  await revokeAIConnectionSecretStoreKey(name);

  const store = await readSecretStore();
  delete store[name];
  await writeSecretStore(store);
  void syncAllSecretsWithBackend();
  return { success: true };
});

ipcMain.handle("ai-connection:set-credential", async (event, value: unknown) => {
  assertTrustedIpcSender(event);
  if (!safeStorage.isEncryptionAvailable()) throw new Error("OS secure storage is unavailable.");
  if (typeof value !== "string") throw new Error("AI credential must be a string.");

  const nextValue = value.trim();
  if (!nextValue || nextValue.length > 4096) throw new Error("AI credential is invalid.");

  const store = await readSecretStore();
  const previousValue = readStoredSecretValue(store, AI_CONNECTION_SECRET_NAME);

  if (previousValue === nextValue) return { success: true, changed: false };

  const reset = await resetAIConnectionRuntimeState();
  if (!reset.success) throw new Error(reset.message || "Could not reset AI connection metadata.");

  store[AI_CONNECTION_SECRET_NAME] = safeStorage.encryptString(nextValue).toString("base64");
  await writeSecretStore(store);
  void syncAllSecretsWithBackend();
  return { success: true, changed: true };
});

ipcMain.handle("ai-connection:clear-credential", async (event) => {
  assertTrustedIpcSender(event);

  const reset = await resetAIConnectionRuntimeState();
  if (!reset.success) throw new Error(reset.message || "Could not reset AI connection metadata.");

  const store = await readSecretStore();
  delete store[AI_CONNECTION_SECRET_NAME];
  await writeSecretStore(store);
  void syncAllSecretsWithBackend();
  return { success: true };
});

ipcMain.handle("ai-connection:get-state", async (event) => {
  assertTrustedIpcSender(event);
  return getAIConnectionRuntimeState();
});

ipcMain.handle("ai-connection:reset", async (event) => {
  assertTrustedIpcSender(event);
  return resetAIConnectionRuntimeState();
});

ipcMain.handle("ai-connection:confirm-provider", async (event, input: unknown) => {
  assertTrustedIpcSender(event);
  return confirmAIConnectionProvider(input);
});

ipcMain.handle("ai-connection:validate-model", async (event, input: unknown) => {
  assertTrustedIpcSender(event);
  return validateAIConnectionModel(input);
});

registerVaultIpcHandlers(ipcMain);

async function reserveEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else if (!port) reject(new Error("Não foi possível reservar uma porta local para o backend."));
        else resolve(port);
      });
    });
  });
}

function waitForBackend(timeoutMs = 12000): Promise<void> {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (!backendProcess) {
        reject(new Error("O processo do backend local encerrou antes de ficar pronto."));
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Backend local não iniciou dentro do tempo esperado."));
        return;
      }
      setTimeout(probe, 250);
    };

    const probe = () => {
      if (!backendProcess) {
        reject(new Error("O processo do backend local não está em execução."));
        return;
      }
      const req = http.get(`${appUrl}/api/health`, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          if (body.length < 16384) body += chunk;
        });
        res.on("end", () => {
          try {
            const payload = JSON.parse(body || "{}");
            const isExpectedBackend =
              res.statusCode === 200 &&
              payload?.runtime === "nisti-secure-local" &&
              payload?.instanceId === backendInstanceId;
            if (isExpectedBackend) {
              resolve();
              return;
            }
          } catch {
            // Retry until timeout.
          }
          retry();
        });
      });
      req.on("error", retry);
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };

    probe();
  });
}

function attachBackendDiagnostics(processRef: ChildProcess): void {
  processRef.stdout?.on("data", (chunk) => {
    void appendStartupLog(`[backend stdout] ${String(chunk).trim()}`);
  });
  processRef.stderr?.on("data", (chunk) => {
    void appendStartupLog(`[backend stderr] ${String(chunk).trim()}`);
  });
  processRef.once("error", (error) => {
    void appendStartupLog(`Backend spawn error: ${error.message}`);
  });
  processRef.once("exit", (code, signal) => {
    void appendStartupLog(`Backend exited. code=${String(code)} signal=${String(signal)}`);
    if (backendProcess === processRef) backendProcess = null;
  });
}

async function startBackend(): Promise<void> {
  const port = await reserveEphemeralPort();
  backendInstanceId = crypto.randomBytes(16).toString("hex");
  appUrl = `http://${LOOPBACK_HOST}:${port}`;
  await appendStartupLog(`Starting backend on ${appUrl}.`);

  let obsidianKey = "";
  let geminiKey = "";
  let openaiKey = "";
  try {
    const store = await readSecretStore();
    obsidianKey = readStoredSecretValue(store, "obsidianApiKey") || "";
    geminiKey = readStoredSecretValue(store, "geminiApiKey") || "";
    openaiKey = readStoredSecretValue(store, "openaiApiKey") || "";

    const stateSnapshot = await getAIConnectionRuntimeState();
    const activeProvider = stateSnapshot?.state?.provider;
    const aiConnKey = readStoredSecretValue(store, AI_CONNECTION_SECRET_NAME) || "";

    if (aiConnKey) {
      if (activeProvider === "gemini") {
        geminiKey = aiConnKey;
      } else if (activeProvider === "openai") {
        openaiKey = aiConnKey;
      }
    }
  } catch (err) {
    await appendStartupLog(`Could not decrypt initial backend secrets: ${err instanceof Error ? err.message : String(err)}`);
  }

  internalSyncToken = crypto.randomBytes(32).toString("hex");
  apiSessionToken = crypto.randomBytes(32).toString("hex");
  const serverPath = path.join(__dirname, "server.cjs");
  const spawned = spawn(process.execPath, [serverPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      NISTI_APP_PORT: String(port),
      NISTI_INSTANCE_ID: backendInstanceId,
      NISTI_INTERNAL_SYNC_TOKEN: internalSyncToken,
      API_SESSION_SECRET: apiSessionToken,
      OBSIDIAN_API_KEY: obsidianKey,
      GEMINI_API_KEY: geminiKey,
      OPENAI_API_KEY: openaiKey,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  backendProcess = spawned;
  attachBackendDiagnostics(spawned);
}

const backendStartup = hasSingleInstanceLock
  ? startBackend()
  : Promise.reject(new Error("Secondary instance blocked."));
const originalLoadFile = BrowserWindow.prototype.loadFile;

BrowserWindow.prototype.loadFile = function (..._args: any[]) {
  const targetWindow = this;
  void setStartupStatus("Iniciando Nisti Marketing", "Conectando ao backend local seguro...");

  return backendStartup
    .then(() => waitForBackend())
    .then(async () => {
      await appendStartupLog("Backend health check succeeded; loading renderer.");
      const result = await targetWindow.loadURL(appUrl);
      closeStartupWindow();
      return result;
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao iniciar o backend local.";
      await appendStartupLog(`Startup failed: ${message}`);
      if (!targetWindow.isDestroyed()) targetWindow.hide();
      await setStartupStatus(
        "Não foi possível iniciar o Nisti Marketing",
        `${message} Feche o aplicativo e tente novamente. Se o problema persistir, consulte o startup.log.`,
        true,
      );
      throw error;
    });
};

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

process.env.NODE_ENV = "production";

if (hasSingleInstanceLock) {
  void import("./electron-main.ts");
}
