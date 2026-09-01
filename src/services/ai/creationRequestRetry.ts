export const CREATION_AI_MAX_ATTEMPTS = 3;

const RETRYABLE_CODES = new Set([
  "RATE_LIMIT",
  "SERVICE_UNAVAILABLE",
  "INVALID_RESPONSE",
  "UNKNOWN",
]);

export function isRetryableCreationAIErrorCode(code: unknown): boolean {
  return RETRYABLE_CODES.has(String(code || "").trim().toUpperCase());
}

export function creationAIRetryDelayMs(completedAttempt: number): number {
  const attempt = Math.max(1, Math.floor(Number(completedAttempt) || 1));
  return Math.min(2_500, 600 * (2 ** (attempt - 1)));
}

export function creationAIErrorMessage(input: {
  error?: unknown;
  warning?: unknown;
  errorCode?: unknown;
  status?: number;
}): string {
  const detail = String(input.error || input.warning || "").trim();
  const code = String(input.errorCode || "").trim().toUpperCase();
  if (detail) return detail;
  if (code === "RATE_LIMIT") return "O provedor de IA atingiu o limite de uso. Aguarde alguns instantes e tente novamente.";
  if (code === "SERVICE_UNAVAILABLE") return "O provedor de IA está temporariamente indisponível. Tente novamente em instantes.";
  if (code === "INVALID_RESPONSE") return "O provedor de IA não retornou uma resposta estruturada válida.";
  if (input.status) return `Falha HTTP ${input.status} na geração criativa.`;
  return "O provedor de IA não respondeu com uma geração válida.";
}
