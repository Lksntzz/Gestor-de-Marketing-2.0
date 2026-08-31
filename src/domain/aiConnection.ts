import { z } from "zod";

export const AI_CONNECTION_SCHEMA_VERSION = 1 as const;

export const AIConnectionProviderSchema = z.enum(["gemini", "openai"]);
export type AIConnectionProvider = z.infer<typeof AIConnectionProviderSchema>;

export const AIConnectionStatusSchema = z.enum([
  "SEM_CHAVE",
  "ANALISANDO_LOCALMENTE",
  "PROVEDOR_POSSIVEL",
  "AGUARDANDO_CONFIRMACAO_DE_PROVEDOR",
  "VALIDANDO_CREDENCIAL",
  "CHAVE_INVALIDA",
  "SEM_PERMISSAO",
  "LIMITE_OU_COTA",
  "PROVEDOR_INDISPONIVEL",
  "CHAVE_CONFIRMADA",
  "DESCOBRINDO_MODELOS",
  "AGUARDANDO_MODELO",
  "VALIDANDO_MODELO",
  "CONEXAO_ATIVA",
]);
export type AIConnectionStatus = z.infer<typeof AIConnectionStatusSchema>;

export const AISecretReferenceSchema = z.enum([
  "legacy:geminiApiKey",
  "legacy:openaiApiKey",
  "active:aiConnectionKey",
]);
export type AISecretReference = z.infer<typeof AISecretReferenceSchema>;

const IsoTimestampSchema = z.string().datetime({ offset: true });

function legacySecretRefMatchesProvider(
  provider: AIConnectionProvider,
  secretRef: AISecretReference,
): boolean {
  if (secretRef === "active:aiConnectionKey") return true;
  if (provider === "openai") return secretRef === "legacy:openaiApiKey";
  return secretRef === "legacy:geminiApiKey";
}

/**
 * Persisted metadata for the single AI connection.
 *
 * This object is intentionally secret-free. The credential itself stays in
 * Electron safeStorage (or volatile memory in the web sandbox) and is only
 * referenced by `secretRef`.
 */
export const PersistedAIConnectionSchema = z.object({
  schemaVersion: z.literal(AI_CONNECTION_SCHEMA_VERSION),
  status: AIConnectionStatusSchema,
  connectionId: z.string().min(1).max(128).optional(),
  providerCandidate: AIConnectionProviderSchema.optional(),
  provider: AIConnectionProviderSchema.optional(),
  modelCandidate: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  secretRef: AISecretReferenceSchema.optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  credentialConfirmedAt: IsoTimestampSchema.optional(),
  modelConfirmedAt: IsoTimestampSchema.optional(),
}).strict().superRefine((state, ctx) => {
  if (state.status === "SEM_CHAVE") {
    if (state.secretRef || state.connectionId || state.credentialConfirmedAt || state.modelConfirmedAt) {
      ctx.addIssue({
        code: "custom",
        message: "SEM_CHAVE não pode carregar referência de segredo ou validações confirmadas.",
      });
    }
  }

  const referencedProvider = state.provider ?? state.providerCandidate;
  if (
    referencedProvider &&
    state.secretRef &&
    !legacySecretRefMatchesProvider(referencedProvider, state.secretRef)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "secretRef legado deve corresponder ao provedor associado à conexão.",
    });
  }

  if (state.status === "CONEXAO_ATIVA") {
    if (
      !state.connectionId ||
      !state.provider ||
      !state.model ||
      !state.secretRef ||
      !state.credentialConfirmedAt ||
      !state.modelConfirmedAt
    ) {
      ctx.addIssue({
        code: "custom",
        message: "CONEXAO_ATIVA exige identidade, provedor, modelo, secretRef e timestamps de confirmação.",
      });
    }
  }
});

export type PersistedAIConnectionState = z.infer<typeof PersistedAIConnectionSchema>;

export interface LegacyAISecretPresence {
  gemini: boolean;
  openai: boolean;
}

export interface AIConnectionMigrationOptions {
  legacySecrets?: Partial<LegacyAISecretPresence>;
}

type LegacyAIConfigLike = {
  aiConnection?: unknown;
  aiProvider?: unknown;
  aiModel?: unknown;
};

export function createEmptyAIConnection(): PersistedAIConnectionState {
  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status: "SEM_CHAVE",
  };
}

export function parsePersistedAIConnection(input: unknown): PersistedAIConnectionState | null {
  const parsed = PersistedAIConnectionSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function normalizeLegacyProvider(value: unknown): AIConnectionProvider | undefined {
  const parsed = AIConnectionProviderSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function normalizeLegacyModel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const model = value.trim();
  if (!model || model.length > 200) return undefined;
  return model;
}

function legacySecretRef(provider: AIConnectionProvider): AISecretReference {
  return provider === "openai" ? "legacy:openaiApiKey" : "legacy:geminiApiKey";
}

/**
 * Builds the V1 metadata without moving or deleting any credential.
 *
 * Existing valid V1 metadata wins, making the migration idempotent. Legacy
 * provider/model values are only treated as hints; they never become a
 * confirmed or active connection.
 */
export function migrateAIConnectionConfig(
  input: LegacyAIConfigLike | null | undefined,
  options: AIConnectionMigrationOptions = {},
): PersistedAIConnectionState {
  const existing = parsePersistedAIConnection(input?.aiConnection);
  if (existing) return existing;

  const selectedProvider = normalizeLegacyProvider(input?.aiProvider);
  const modelCandidate = normalizeLegacyModel(input?.aiModel);
  const geminiSecret = options.legacySecrets?.gemini === true;
  const openaiSecret = options.legacySecrets?.openai === true;

  let providerCandidate = selectedProvider;
  if (!providerCandidate) {
    if (geminiSecret && !openaiSecret) providerCandidate = "gemini";
    if (openaiSecret && !geminiSecret) providerCandidate = "openai";
  }

  const selectedSecretPresent = providerCandidate === "gemini"
    ? geminiSecret
    : providerCandidate === "openai"
      ? openaiSecret
      : false;

  if (!providerCandidate || !selectedSecretPresent) {
    return createEmptyAIConnection();
  }

  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status: "PROVEDOR_POSSIVEL",
    providerCandidate,
    ...(modelCandidate ? { modelCandidate } : {}),
    secretRef: legacySecretRef(providerCandidate),
  };
}

/**
 * Imported backup metadata cannot carry proof that a credential is still
 * available or valid on this machine. Downgrade it to an unconfirmed hint and
 * remove all connection identifiers, secret references and validation claims.
 */
export function downgradeImportedAIConnection(
  input: unknown,
): PersistedAIConnectionState | undefined {
  const parsed = parsePersistedAIConnection(input);
  if (!parsed) return undefined;

  const providerCandidate = parsed.provider ?? parsed.providerCandidate;
  const modelCandidate = parsed.model ?? parsed.modelCandidate;

  return {
    schemaVersion: AI_CONNECTION_SCHEMA_VERSION,
    status: "SEM_CHAVE",
    ...(providerCandidate ? { providerCandidate } : {}),
    ...(modelCandidate ? { modelCandidate } : {}),
  };
}
