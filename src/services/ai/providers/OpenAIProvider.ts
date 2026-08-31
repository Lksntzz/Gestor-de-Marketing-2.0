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

type FetchLike = typeof fetch;

function strictJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictJsonSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    normalized[key] = strictJsonSchema(child);
  }

  if (source.type === "object") {
    const properties = source.properties && typeof source.properties === "object"
      ? source.properties as Record<string, unknown>
      : {};
    normalized.properties = strictJsonSchema(properties);
    normalized.required = Object.keys(properties);
    normalized.additionalProperties = false;
  }
  return normalized;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;

  constructor(
    private readonly config: AIProviderConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    if (!config.apiKey.trim()) {
      throw new AIProviderError("MISSING_CONFIG", "A chave de API da OpenAI não foi configurada.", this.name);
    }
  }

  private model(request?: GenerationRequest): string {
    return request?.model?.trim() || this.config.model?.trim() || "gpt-5-mini";
  }

  private input(request: GenerationRequest): unknown {
    const content: Array<Record<string, unknown>> = [{ type: "input_text", text: request.prompt }];
    for (const attachment of request.attachments || []) {
      const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
      if (attachment.mimeType.startsWith("image/")) {
        content.push({ type: "input_image", image_url: dataUrl });
      } else {
        content.push({ type: "input_file", filename: attachment.fileName || "documento", file_data: dataUrl });
      }
    }
    return [{ role: "user", content }];
  }

  private async generate(request: GenerationRequest, structured: boolean): Promise<GenerationResult<string>> {
    const model = this.model(request);
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey.trim()}`,
          "Content-Type": "application/json",
          "User-Agent": "nisti-marketing-2.0",
        },
        body: JSON.stringify({
          model,
          input: this.input(request),
          store: false,
          ...(request.systemPrompt ? { instructions: request.systemPrompt } : {}),
          ...(typeof request.temperature === "number" ? { temperature: request.temperature } : {}),
          ...(structured
            ? {
                text: {
                  format: {
                    type: "json_schema",
                    name: request.schemaName || "nisti_response",
                    schema: strictJsonSchema(request.schema || { type: "object", properties: {} }),
                    strict: true,
                  },
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(45_000),
      });

      const payload = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        const apiError = new Error(payload?.error?.message || `OpenAI HTTP ${response.status}`) as Error & { status?: number };
        apiError.status = response.status;
        throw apiError;
      }
      const text = String(
        payload?.output_text ||
        payload?.output?.flatMap((item: any) => item?.content || []).map((part: any) => part?.text || "").join("") ||
        ""
      ).trim();
      if (!text) throw new AIProviderError("INVALID_RESPONSE", "A OpenAI retornou uma resposta vazia.", this.name);
      return { provider: this.name, model: String(payload?.model || model), text, data: text };
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
      throw new AIProviderError("INVALID_RESPONSE", "A OpenAI retornou um JSON inválido.", this.name, undefined, { cause: error });
    }
  }

  async analyzeDocument<T>(request: GenerationRequest): Promise<GenerationResult<T>> {
    return this.generateJson<T>(request);
  }

  async transcribeAudio(request: AudioTranscriptionRequest): Promise<GenerationResult<string>> {
    if (!request.mimeType.startsWith("audio/")) {
      throw new AIProviderError("INVALID_RESPONSE", "O arquivo informado não é um áudio suportado.", this.name);
    }

    try {
      const binary = Buffer.from(request.data, "base64");
      const form = new FormData();
      form.append("model", "gpt-4o-mini-transcribe");
      form.append("response_format", "json");
      if (request.prompt?.trim()) form.append("prompt", request.prompt.trim());
      form.append(
        "file",
        new Blob([binary], { type: request.mimeType }),
        request.fileName || "audio.mp3",
      );

      const response = await this.fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey.trim()}`,
          "User-Agent": "nisti-marketing-3.1",
        },
        body: form,
        signal: AbortSignal.timeout(90_000),
      });
      const payload = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        const apiError = new Error(payload?.error?.message || `OpenAI HTTP ${response.status}`) as Error & { status?: number };
        apiError.status = response.status;
        throw apiError;
      }
      const text = String(payload?.text || "").trim();
      if (!text) throw new AIProviderError("INVALID_RESPONSE", "A OpenAI retornou uma transcrição vazia.", this.name);
      return {
        provider: this.name,
        model: String(payload?.model || "gpt-4o-mini-transcribe"),
        text,
        data: text,
      };
    } catch (error) {
      throw normalizeAIError(error, this.name);
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const result = await this.generateText({ prompt: "Responda apenas OK." });
    return { success: true, provider: this.name, model: result.model };
  }
}
