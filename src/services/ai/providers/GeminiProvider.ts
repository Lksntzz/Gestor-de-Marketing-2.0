import { GoogleGenAI } from "@google/genai";
import {
  AIProvider,
  AIProviderConfig,
  AIProviderError,
  AudioTranscriptionRequest,
  ConnectionTestResult,
  GenerationRequest,
  GenerationResult,
  normalizeAIError,
  stripJsonFence,
} from "../AIProvider";

type GeminiClient = {
  models: {
    generateContent: (request: any) => Promise<{ text?: string }>;
  };
};

type GeminiClientFactory = (apiKey: string) => GeminiClient;

function geminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (key === "additionalProperties") continue;
    normalized[key] = key === "type" && typeof child === "string" ? child.toUpperCase() : geminiSchema(child);
  }
  return normalized;
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private readonly client: GeminiClient;

  constructor(
    private readonly config: AIProviderConfig,
    clientFactory: GeminiClientFactory = (apiKey) => new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "nisti-marketing-3.1" } },
    }) as unknown as GeminiClient
  ) {
    if (!config.apiKey.trim()) {
      throw new AIProviderError("MISSING_CONFIG", "A chave de API do Gemini não foi configurada.", this.name);
    }
    this.client = clientFactory(config.apiKey.trim());
  }

  private model(request?: GenerationRequest): string {
    return request?.model?.trim() || this.config.model?.trim() || "gemini-flash-latest";
  }

  private contents(request: GenerationRequest): unknown {
    const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
    for (const attachment of request.attachments || []) {
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    }
    return [{ role: "user", parts }];
  }

  private async generate(request: GenerationRequest, structured: boolean): Promise<GenerationResult<string>> {
    const model = this.model(request);
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: this.contents(request),
        config: {
          ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
          ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
          ...(structured ? { responseMimeType: "application/json", responseSchema: geminiSchema(request.schema) } : {}),
        },
      });
      const text = response.text?.trim() || "";
      if (!text) throw new AIProviderError("INVALID_RESPONSE", "O Gemini retornou uma resposta vazia.", this.name);
      return { provider: this.name, model, text, data: text };
    } catch (error) {
      throw normalizeAIError(error, this.name);
    }
  }

  async generateText(request: GenerationRequest): Promise<GenerationResult<string>> {
    return this.generate(request, false);
  }

  async generateJson<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    const result = await this.generate(request, true);
    try {
      return { ...result, data: JSON.parse(stripJsonFence(result.text)) as T };
    } catch (error) {
      throw new AIProviderError("INVALID_RESPONSE", "O Gemini retornou um JSON inválido.", this.name, undefined, { cause: error });
    }
  }

  async analyzeDocument<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    return this.generateJson<T>(request);
  }

  async transcribeAudio(request: AudioTranscriptionRequest): Promise<GenerationResult<string>> {
    if (!request.mimeType.startsWith("audio/")) {
      throw new AIProviderError("INVALID_RESPONSE", "O arquivo informado não é um áudio suportado.", this.name);
    }
    const result = await this.generateText({
      prompt: request.prompt || "Transcreva fielmente este áudio. Preserve nomes, números e decisões. Não resuma e não acrescente informações que não estejam audíveis.",
      temperature: 0,
      attachments: [{ mimeType: request.mimeType, data: request.data, fileName: request.fileName }],
    });
    return result;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const result = await this.generateText({ prompt: "Responda apenas OK.", temperature: 0 });
    return { success: true, provider: this.name, model: result.model };
  }
}
