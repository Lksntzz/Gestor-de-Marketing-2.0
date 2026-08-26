import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import http from "http";
import * as path from "path";

const APP_URL = "http://127.0.0.1:3000";
const ALLOWED_SECRET_NAMES = new Set(["obsidianApiKey"]);
let backendProcess: ChildProcess | null = null;

function getSecretsFilePath(): string {
  return path.join(app.getPath("userData"), "nisti_secure_secrets.json");
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

ipcMain.handle("secret:set", async (_, name: string, value: string) => {
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("OS secure storage is unavailable.");

  const store = await readSecretStore();
  store[name] = safeStorage.encryptString(value || "").toString("base64");
  await writeSecretStore(store);
  return { success: true };
});

ipcMain.handle("secret:get", async (_, name: string) => {
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  if (!safeStorage.isEncryptionAvailable()) return "";

  const store = await readSecretStore();
  const encrypted = store[name];
  if (!encrypted) return "";
  return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
});

ipcMain.handle("secret:delete", async (_, name: string) => {
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  const store = await readSecretStore();
  delete store[name];
  await writeSecretStore(store);
  return { success: true };
});

function waitForBackend(timeoutMs = 12000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`${APP_URL}/api/health`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Backend local não iniciou dentro do tempo esperado."));
        return;
      }
      setTimeout(probe, 250);
    };

    probe();
  });
}

function startBackend(): void {
  const serverPath = path.join(__dirname, "server.cjs");
  backendProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

const originalLoadFile = BrowserWindow.prototype.loadFile;
BrowserWindow.prototype.loadFile = function (..._args: any[]) {
  return waitForBackend()
    .then(() => this.loadURL(APP_URL))
    .catch(async () => {
      return originalLoadFile.call(this, path.join(__dirname, "index.html"));
    });
};

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

process.env.NODE_ENV = "production";
startBackend();

void import("./electron-main.ts");
