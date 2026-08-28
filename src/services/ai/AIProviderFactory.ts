import { AIProvider, AIProviderConfig, AIProviderError, AIProviderName } from "./AIProvider";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";

export const DEFAULT_AI_MODELS: Record<AIProviderName, string> = {
  gemini: "gemini-flash-latest",
  openai: "gpt-5-mini",
};

export class AIProviderFactory {
  static create(config: AIProviderConfig): AIProvider {
    const provider = config.provider || "gemini";
    if (provider === "gemini") return new GeminiProvider({ ...config, provider });
    if (provider === "openai") return new OpenAIProvider({ ...config, provider });
    throw new AIProviderError("MISSING_CONFIG", `Provedor de IA não suportado: ${String(provider)}.`, provider);
  }
}
