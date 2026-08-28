export type AIProviderName = "gemini" | "openai";

export type AIErrorCode =
  | "INVALID_API_KEY"
  | "INVALID_MODEL"
  | "RATE_LIMIT"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "MISSING_CONFIG"
  | "UNKNOWN";

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

export interface GenerationAttachment {
  mimeType: string;
  data: string;
  fileName?: string;
}

export interface GenerationRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  schema?: Record<string, unknown>;
  schemaName?: string;
  attachments?: GenerationAttachment[];
}

export interface GenerationResult<T = string> {
  provider: AIProviderName;
  model: string;
  text: string;
  data: T;
}

export interface ConnectionTestResult {
  success: true;
  provider: AIProviderName;
  model: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generateText(request: GenerationRequest): Promise<GenerationResult<string>>;
  generateJson<T>(request: GenerationRequest): Promise<GenerationResult<T>>;
  analyzeDocument<T>(request: GenerationRequest): Promise<GenerationResult<T>>;
  testConnection(): Promise<ConnectionTestResult>;
}

export class AIProviderError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly provider?: AIProviderName,
    public readonly status?: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AIProviderError";
  }
}

export function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function normalizeAIError(error: unknown, provider?: AIProviderName): AIProviderError {
  if (error instanceof AIProviderError) return error;

  const input = error as { status?: number; statusCode?: number; code?: string | number; message?: string } | undefined;
  const status = Number(input?.status || input?.statusCode || 0) || undefined;
  const rawMessage = String(input?.message || error || "Erro desconhecido");
  const message = rawMessage.toLowerCase();

  if (status === 401 || status === 403 || /api.?key|unauthori|permission|credential/.test(message)) {
    return new AIProviderError("INVALID_API_KEY", `A chave de API do provedor ${provider || "de IA"} é inválida ou não tem permissão.`, provider, status, { cause: error });
  }
  if (status === 404 || /model.*(?:not found|invalid|unsupported|does not exist)|invalid.*model/.test(message)) {
    return new AIProviderError("INVALID_MODEL", `O modelo configurado para ${provider || "o provedor de IA"} é inválido ou não está disponível.`, provider, status, { cause: error });
  }
  if (status === 429 || /rate.?limit|quota|resource_exhausted/.test(message)) {
    return new AIProviderError("RATE_LIMIT", `O provedor ${provider || "de IA"} atingiu o limite de uso. Tente novamente mais tarde.`, provider, status, { cause: error });
  }
  if ((status && status >= 500) || /unavailable|timeout|timed out|econn|fetch failed|network/.test(message)) {
    return new AIProviderError("SERVICE_UNAVAILABLE", `O provedor ${provider || "de IA"} está temporariamente indisponível.`, provider, status, { cause: error });
  }
  return new AIProviderError("UNKNOWN", `Falha ao chamar o provedor ${provider || "de IA"}: ${rawMessage}`, provider, status, { cause: error });
}
