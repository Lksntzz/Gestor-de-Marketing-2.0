import { app, safeStorage } from "electron";
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

const LEGACY_CONFIG_FILE_NAME = "nisti_config.json";
const AI_CONNECTION_FILE_NAME = "nisti_ai_connection.json";
const SECRETS_FILE_NAME = "nisti_secure_secrets.json";
const ALLOWED_PROVIDER_KEYS = new Set(["provider"]);
const ALLOWED_MODEL_KEYS = new Set(["provider", "model"]);

type LegacyConfigRecord = Record<string, unknown> & {
  aiConnection?: unknown;
  aiProvider?: unknown;
  aiModel?: unknown;
};

function legacyConfigFilePath(): string {
  return path.join(app.getPath("userData"), LEGACY_CONFIG_FILE_NAME);
}

function connectionFilePath(): string {
  return path.join(app.getPath("userData"), AI_CONNECTION_FILE_NAME);
}

function secretsFilePath(): string {
  return path.join(app.getPath("userData"), SECRETS_FILE_NAME);
}

async function readLegacyConfig(): Promise<LegacyConfigRecord> {
  const filePath = legacyConfigFilePath();
  if (!existsSync(filePath)) return {};
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as LegacyConfigRecord
      : {};
  } catch {
    return {};
  }
}

async function readConnectionFile(): Promise<{
  exists: boolean;
  state: PersistedAIConnectionState | null;
}> {
  const filePath = connectionFilePath();
  if (!existsSync(filePath)) return { exists: false, state: null };

  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
    return {
      exists: true,
      state: parsePersistedAIConnection(raw),
    };
  } catch {
    return { exists: true, state: null };
  }
}

async function persistConnectionState(
  input: PersistedAIConnectionState,
): Promise<PersistedAIConnectionState> {
  const parsed = parsePersistedAIConnection(input);
  if (!parsed) throw new Error("Invalid AI connection metadata.");

  const filePath = connectionFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(parsed, null, 2),
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
  const persisted = await readConnectionFile();
  if (persisted.state) return persisted.state;

  // A present but unreadable/future canonical file is preserved on passive
  // reads. This binary fails closed without destructively downgrading metadata
  // it does not understand.
  if (persisted.exists) return createEmptyAIConnection();

  const legacyConfig = await readLegacyConfig();

  // Transitional compatibility for development builds that may already have
  // written V1 metadata inside nisti_config.json before the dedicated file was
  // introduced. The legacy file is read-only for the new runtime.
  const embeddedState = parsePersistedAIConnection(legacyConfig.aiConnection);
  if (embeddedState) return persistConnectionState(embeddedState);
  if (legacyConfig.aiConnection !== undefined) return createEmptyAIConnection();

  const [geminiSecret, openaiSecret] = await Promise.all([
    readEncryptedSecretByStoreKey("geminiApiKey"),
    readEncryptedSecretByStoreKey("openaiApiKey"),
  ]);

  const migrated = migrateAIConnectionConfig(
    {
      aiProvider: legacyConfig.aiProvider,
      aiModel: legacyConfig.aiModel,
    },
    {
      legacySecrets: {
        gemini: Boolean(geminiSecret),
        openai: Boolean(openaiSecret),
      },
    },
  );

  return migrated.status === "SEM_CHAVE"
    ? migrated
    : persistConnectionState(migrated);
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

export async function getAIConnectionRuntimeState() {
  try {
    return await runtime.getSnapshot();
  } catch {
    return {
      state: createEmptyAIConnection(),
      code: "RUNTIME_ERROR",
      message: "Não foi possível carregar o estado da conexão de IA.",
    };
  }
}

export async function confirmAIConnectionProvider(input: unknown) {
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
}

export async function validateAIConnectionModel(input: unknown) {
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
}
