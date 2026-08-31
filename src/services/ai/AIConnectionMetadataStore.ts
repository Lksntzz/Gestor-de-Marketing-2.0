import type { ObsidianApiConfig } from "../../types";
import {
  createEmptyAIConnection,
  migrateAIConnectionConfig,
  parsePersistedAIConnection,
  type PersistedAIConnectionState,
} from "../../domain/aiConnection";

export const AI_CONNECTION_METADATA_STORAGE_KEY = "nisti_ai_connection_metadata_v1";

const PROVISIONAL_STATUSES = new Set<PersistedAIConnectionState["status"]>([
  "SEM_CHAVE",
  "PROVEDOR_POSSIVEL",
]);

type LegacyAIConfig = Pick<
  ObsidianApiConfig,
  "aiProvider" | "aiModel" | "geminiApiKey" | "openaiApiKey"
>;

function canUseLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/**
 * Reads only the secret-free V1 metadata. Invalid payloads are ignored rather
 * than partially trusted.
 */
export function readAIConnectionMetadata(): PersistedAIConnectionState | null {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = localStorage.getItem(AI_CONNECTION_METADATA_STORAGE_KEY);
    if (!raw) return null;
    return parsePersistedAIConnection(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Converts the legacy provider/model + presence of provider-specific secrets
 * into a V1 unconfirmed connection state. Raw credentials are reduced to
 * booleans before they reach the domain migration and are never serialized.
 *
 * Provisional states are re-derived from the current legacy configuration on
 * each call so changing the old UI during the transition cannot permanently
 * stale the migration metadata. Once a later stage writes a non-provisional
 * state, this Stage 1 migrator stops overriding it.
 */
export function ensureAIConnectionMetadataMigration(
  config: LegacyAIConfig,
): PersistedAIConnectionState {
  const existing = readAIConnectionMetadata();
  const preserveExisting = existing && !PROVISIONAL_STATUSES.has(existing.status)
    ? existing
    : undefined;

  const migrated = migrateAIConnectionConfig(
    {
      aiConnection: preserveExisting,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
    },
    {
      legacySecrets: {
        gemini: Boolean(config.geminiApiKey?.trim()),
        openai: Boolean(config.openaiApiKey?.trim()),
      },
    },
  );

  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(AI_CONNECTION_METADATA_STORAGE_KEY, JSON.stringify(migrated));
    } catch (error) {
      console.warn("Could not persist AI connection migration metadata:", error);
    }
  }

  return migrated;
}

export function clearAIConnectionMetadata(): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(AI_CONNECTION_METADATA_STORAGE_KEY);
  } catch {
    // Factory reset/local storage recovery remains fail-safe even if storage is unavailable.
  }
}

export function getSafeAIConnectionMetadataSnapshot(): PersistedAIConnectionState {
  return readAIConnectionMetadata() || createEmptyAIConnection();
}
