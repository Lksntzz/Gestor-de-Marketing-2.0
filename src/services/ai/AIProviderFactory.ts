import {
  AIProvider,
  AIProviderConfig,
  AIProviderError,
  AIProviderName,
  GenerationRequest,
  GenerationResult,
} from "./AIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";

export const DEFAULT_AI_MODELS: Record<AIProviderName, string> = {
  gemini: "gemini-flash-latest",
  openai: "gpt-5-mini",
};

export class AIProviderFactory {
  static create(config?: AIProviderConfig | null): AIProvider {
    if (!config || typeof config !== "object") {
      throw new AIProviderError("MISSING_CONFIG", "A configuração do provedor de IA não foi informada.");
    }
    if (typeof config.apiKey !== "string") {
      throw new AIProviderError("MISSING_CONFIG", "A chave de API do provedor de IA não foi informada.");
    }
    if (config.model !== undefined && typeof config.model !== "string") {
      throw new AIProviderError("MISSING_CONFIG", "O modelo do provedor de IA possui uma configuração inválida.");
    }
    const provider = config.provider || "gemini";
    if (provider === "gemini") return new GeminiProvider({ ...config, provider });
    if (provider === "openai") return new OpenAIProvider({ ...config, provider });
    throw new AIProviderError("MISSING_CONFIG", `Provedor de IA não suportado: ${String(provider)}.`, provider);
  }
}

export async function executeWithModelFallback<T>(
  config: AIProviderConfig,
  models: string[],
  request: GenerationRequest,
  operation: "generateJson" | "analyzeDocument" = "analyzeDocument",
  createProvider: (providerConfig: AIProviderConfig) => AIProvider = (providerConfig) => AIProviderFactory.create(providerConfig)
): Promise<GenerationResult<T>> {
  if (models.length === 0) {
    throw new AIProviderError("MISSING_CONFIG", "Nenhum modelo de IA foi configurado para a operação.", config.provider);
  }

  let lastError: unknown;
  for (const model of models) {
    try {
      const provider = createProvider({ ...config, model });
      return await provider[operation]<T>({ ...request, model });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AIProviderError("UNKNOWN", "Todos os modelos configurados falharam.", config.provider);
}
