import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import http from "http";
import net from "net";
import crypto from "crypto";
import * as path from "path";

const STABLE_USER_DATA_NAME = "Nisti Print PKM Marketing Hub";
const stableUserDataPath = path.join(app.getPath("appData"), STABLE_USER_DATA_NAME);
app.setPath("userData", stableUserDataPath);
app.setName("Nisti Marketing");

const LOOPBACK_HOST = "127.0.0.1";
const ALLOWED_SECRET_NAMES = new Set(["obsidianApiKey", "geminiApiKey"]);
let backendProcess: ChildProcess | null = null;
let appUrl = "";
let backendInstanceId = "";

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
  if (!value) {
    delete store[name];
  } else {
    store[name] = safeStorage.encryptString(value).toString("base64");
  }
  await writeSecretStore(store);
  return { success: true };
});

ipcMain.handle("secret:get", async (_, name: string) => {
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  if (!safeStorage.isEncryptionAvailable()) return "";

  try {
    const store = await readSecretStore();
    const encrypted = store[name];
    if (!encrypted) return "";
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return "";
  }
});

ipcMain.handle("secret:delete", async (_, name: string) => {
  if (!ALLOWED_SECRET_NAMES.has(name)) throw new Error("Secret name not allowed.");
  const store = await readSecretStore();
  delete store[name];
  await writeSecretStore(store);
  return { success: true };
});

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
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Backend local não iniciou dentro do tempo esperado."));
        return;
      }
      setTimeout(probe, 250);
    };

    const probe = () => {
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

async function startBackend(): Promise<void> {
  const port = await reserveEphemeralPort();
  backendInstanceId = crypto.randomBytes(16).toString("hex");
  appUrl = `http://${LOOPBACK_HOST}:${port}`;

  const serverPath = path.join(__dirname, "server.cjs");
  backendProcess = spawn(process.execPath, [serverPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      NISTI_APP_PORT: String(port),
      NISTI_INSTANCE_ID: backendInstanceId,
    },
    stdio: "ignore",
    windowsHide: true,
  });

  backendProcess.on("exit", () => {
    backendProcess = null;
  });
}

const backendStartup = startBackend();
const originalLoadFile = BrowserWindow.prototype.loadFile;

BrowserWindow.prototype.loadFile = function (..._args: any[]) {
  return backendStartup
    .then(() => waitForBackend())
    .then(() => this.loadURL(appUrl))
    .catch(async () => originalLoadFile.call(this, path.join(__dirname, "index.html")));
};

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

process.env.NODE_ENV = "production";

void import("./electron-main.ts");
