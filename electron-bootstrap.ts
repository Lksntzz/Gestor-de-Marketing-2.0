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
let backendProcess: ChildProcess | null = null;
let appUrl = "";
let backendInstanceId = "";
let internalSyncToken = "";

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

    // Resolve unified single active credential based on active provider
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

  // Re-saving the exact same secret is idempotent. This matters while legacy
  // settings code still persists configuration more than once.
  if (previousValue === nextValue) return { success: true };

  // Revoke metadata/proposals before changing the credential. If revocation
  // fails, the secret is left untouched; if the subsequent write fails, the
  // runtime remains safely disconnected rather than trusting stale metadata.
  await revokeAIConnectionSecretStoreKey(name);

  if (!nextValue) {
    delete store[name];
  } else {
    store[name] = safeStorage.encryptString(nextValue).toString("base64");
  }
  await writeSecretStore(store);
  
  // Dynamically sync secrets with background server
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
    
    // SECURE CREDENTIAL ISOLATION: Never expose plaintext keys to the renderer!
    // Returning "saved-in-secure-storage" ensures that the renderer can only know
    // whether the secret exists, but can never leak real credentials.
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

  // Always revoke first: metadata may still reference a key even when the
  // encrypted slot is already absent or unreadable.
  await revokeAIConnectionSecretStoreKey(name);

  const store = await readSecretStore();
  delete store[name];
  await writeSecretStore(store);
  
  // Dynamically sync secrets with background server
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

  // Re-saving the same active credential must not destroy a validated
  // connection. This makes Save/close/reopen cycles idempotent.
  if (previousValue === nextValue) return { success: true, changed: false };

  // A new single credential starts a new trust chain. Clear canonical metadata
  // before persisting the secret so a write failure cannot leave stale trust.
  const reset = await resetAIConnectionRuntimeState();
  if (!reset.success) throw new Error(reset.message || "Could not reset AI connection metadata.");

  store[AI_CONNECTION_SECRET_NAME] = safeStorage.encryptString(nextValue).toString("base64");
  await writeSecretStore(store);
  
  // Dynamically sync secrets with background server
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
  
  // Dynamically sync secrets with background server
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

// Register Vault and Notes direct filesystem IPC handlers
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

  // Read and decrypt secure secrets to seed backend environment
  let obsidianKey = "";
  let geminiKey = "";
  let openaiKey = "";
  try {
    const store = await readSecretStore();
    obsidianKey = readStoredSecretValue(store, "obsidianApiKey") || "";
    geminiKey = readStoredSecretValue(store, "geminiApiKey") || "";
    openaiKey = readStoredSecretValue(store, "openaiApiKey") || "";

    // Resolve unified single active credential based on active provider
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
    console.warn("Could not decrypt initial backend secrets:", err);
  }

  internalSyncToken = crypto.randomBytes(32).toString("hex");
  const serverPath = path.join(__dirname, "server.cjs");
  backendProcess = spawn(process.execPath, [serverPath], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      NISTI_APP_PORT: String(port),
      NISTI_INSTANCE_ID: backendInstanceId,
      NISTI_INTERNAL_SYNC_TOKEN: internalSyncToken,
      OBSIDIAN_API_KEY: obsidianKey,
      GEMINI_API_KEY: geminiKey,
      OPENAI_API_KEY: openaiKey,
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
