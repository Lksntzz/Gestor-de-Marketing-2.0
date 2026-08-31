import type { AIConnectionProvider, AIConnectionStatus } from "./aiConnection";

export interface LocalAICredentialAnalysis {
  status: Extract<
    AIConnectionStatus,
    "SEM_CHAVE" | "PROVEDOR_POSSIVEL" | "AGUARDANDO_CONFIRMACAO_DE_PROVEDOR"
  >;
  candidates: AIConnectionProvider[];
  providerCandidate?: AIConnectionProvider;
}

const GEMINI_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{20,}$/;
const OPENAI_KEY_PATTERN = /^sk-[0-9A-Za-z_-]{16,}$/;

/**
 * Performs a local-only heuristic analysis of a credential.
 *
 * Prefix/shape matches are hints, never proof. The function deliberately does
 * not return any portion, hash, mask or identifier derived from the secret.
 */
export function analyzeAICredentialLocally(secret: string | null | undefined): LocalAICredentialAnalysis {
  const value = typeof secret === "string" ? secret.trim() : "";
  if (!value) {
    return {
      status: "SEM_CHAVE",
      candidates: [],
    };
  }

  const candidates: AIConnectionProvider[] = [];
  if (GEMINI_KEY_PATTERN.test(value)) candidates.push("gemini");
  if (OPENAI_KEY_PATTERN.test(value)) candidates.push("openai");

  if (candidates.length === 1) {
    return {
      status: "PROVEDOR_POSSIVEL",
      candidates,
      providerCandidate: candidates[0],
    };
  }

  return {
    status: "AGUARDANDO_CONFIRMACAO_DE_PROVEDOR",
    candidates: ["gemini", "openai"],
  };
}
