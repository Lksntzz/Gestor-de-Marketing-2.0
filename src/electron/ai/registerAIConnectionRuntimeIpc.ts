import { app, ipcMain, safeStorage } from "electron";
import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import {
  AIConnectionProviderSchema,
  createEmptyAIConnection,
  migrateAIConnectionConfig,
  parsePersistedAIConnection,
  type AISecretReference,
  type PersistedAIConnectionState,
} from "../../domain/aiConnection";
import { AIConnectionTrustedRuntimeService } from "../../services/ai/AIConnectionTrustedRuntimeService";
import { assertTrustedIpcSender } from "../security/trustedRenderer";

const CONFIG_FILE_NAME = "nisti_config.json";
const SECRETS_FILE_NAME = "nisti_secure_secrets.json";
const ALLOWED_PROVIDER_KEYS = new Set(["provider"]);
const ALLOWED_MODEL_KEYS = new Set(["provider", "model"]);

let registered = false;

type ConfigRecord = Record<string, unknown> & {
  aiConnection?: unknown;
  aiProvider?: unknown;
  aiModel?: unknown;
};

function configFilePath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILE_NAME);
}

function secretsFilePath(): string {
  return path.join(app.getPath("userData"), SECRETS_FILE_NAME);
}

async function readConfig(): Promise<ConfigRecord> {
  const filePath = configFilePath();
  if (!existsSync(filePath)) return {};
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as ConfigRecord
    : {};
}

function stripSecretFields(input: Record<string, unknown>): Record<string, unknown> {
  const output = { ...input };
  delete output.apiKey;
  delete output.geminiApiKey;
  delete output.openaiApiKey;
  delete output.token;
  delete output.authorization;
  return output;
}

async function persistConnectionState(
  input: PersistedAIConnectionState,
): Promise<PersistedAIConnectionState> {
  const parsed = parsePersistedAIConnection(input);
  if (!parsed) throw new Error("Invalid AI connection metadata.");

  const current = stripSecretFields(await readConfig());
  const filePath = configFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify({ ...current, aiConnection: parsed }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  return parsed;
}

function secretStoreKey(secretRef: AISecretReference): string {
  if (secretRef === "legacy:openaiApiKey") return "openaiApiKey";
  if (secretRef === "legacy:geminiApiKey") return "geminiApiKey";
  return "aiConnectionKey";
}

async function readEncryptedSecretByStoreKey(storeKey: string): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) return "";
  const filePath = secretsFilePath();
  if (!existsSync(filePath)) return "";

  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
    const encrypted = raw?.[storeKey];
    if (typeof encrypted !== "string" || !encrypted) return "";
    return safeStorage.decryptString(Buffer.from(encrypted, "base64")).trim();
  } catch {
    return "";
  }
}

async function readSecret(secretRef: AISecretReference): Promise<string> {
  return readEncryptedSecretByStoreKey(secretStoreKey(secretRef));
}

async function loadConnectionState(): Promise<PersistedAIConnectionState> {
  const config = await readConfig();
  const existing = parsePersistedAIConnection(config.aiConnection);
  if (existing) return existing;

  const [geminiSecret, openaiSecret] = await Promise.all([
    readEncryptedSecretByStoreKey("geminiApiKey"),
    readEncryptedSecretByStoreKey("openaiApiKey"),
  ]);

  const migrated = migrateAIConnectionConfig(
    {
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
    },
    {
      legacySecrets: {
        gemini: Boolean(geminiSecret),
        openai: Boolean(openaiSecret),
      },
    },
  );

  return persistConnectionState(migrated);
}

const runtime = new AIConnectionTrustedRuntimeService({
  loadState: loadConnectionState,
  persistState: persistConnectionState,
  readSecret,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(input).every((key) => allowed.has(key));
}

function parseProviderInput(input: unknown): { provider: "gemini" | "openai" } | null {
  if (!isPlainObject(input) || !hasOnlyKeys(input, ALLOWED_PROVIDER_KEYS)) return null;
  const parsed = AIConnectionProviderSchema.safeParse(input.provider);
  return parsed.success ? { provider: parsed.data } : null;
}

function parseModelInput(input: unknown): { provider: "gemini" | "openai"; model: string } | null {
  if (!isPlainObject(input) || !hasOnlyKeys(input, ALLOWED_MODEL_KEYS)) return null;
  const provider = AIConnectionProviderSchema.safeParse(input.provider);
  if (!provider.success || typeof input.model !== "string") return null;
  const model = input.model.trim();
  if (!model || model.length > 200) return null;
  return { provider: provider.data, model };
}

async function safeSnapshot() {
  try {
    return await runtime.getSnapshot();
  } catch {
    return { state: createEmptyAIConnection() };
  }
}

async function invalidRequest(message: string) {
  const snapshot = await safeSnapshot();
  return {
    success: false,
    ...snapshot,
    code: "INVALID_REQUEST",
    message,
  };
}

export function registerAIConnectionRuntimeIpc(): void {
  if (registered) return;
  registered = true;

  ipcMain.handle("ai-connection:get-state", async (event) => {
    assertTrustedIpcSender(event);
    try {
      return await runtime.getSnapshot();
    } catch {
      return {
        state: createEmptyAIConnection(),
        code: "RUNTIME_ERROR",
        message: "Não foi possível carregar o estado da conexão de IA.",
      };
    }
  });

  ipcMain.handle("ai-connection:confirm-provider", async (event, input: unknown) => {
    assertTrustedIpcSender(event);
    const parsed = parseProviderInput(input);
    if (!parsed) {
      return invalidRequest("A confirmação aceita somente um provedor válido.");
    }

    try {
      return await runtime.confirmProvider(parsed.provider);
    } catch {
      const snapshot = await safeSnapshot();
      return {
        success: false,
        ...snapshot,
        provider: parsed.provider,
        code: "RUNTIME_ERROR",
        message: "Não foi possível confirmar o provedor neste momento.",
      };
    }
  });

  ipcMain.handle("ai-connection:validate-model", async (event, input: unknown) => {
    assertTrustedIpcSender(event);
    const parsed = parseModelInput(input);
    if (!parsed) {
      return invalidRequest("A validação aceita somente provedor e modelo válidos.");
    }

    try {
      return await runtime.validateModel(parsed.provider, parsed.model);
    } catch {
      const snapshot = await safeSnapshot();
      return {
        success: false,
        ...snapshot,
        provider: parsed.provider,
        model: parsed.model,
        code: "RUNTIME_ERROR",
        message: "Não foi possível validar o modelo neste momento.",
      };
    }
  });
}

registerAIConnectionRuntimeIpc();
