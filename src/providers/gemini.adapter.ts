import {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderModel,
} from "./types.js";
import { UpstreamError } from "../utils/errors.js";

export interface GeminiAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

export class GeminiProviderAdapter implements ProviderAdapter {
  readonly id = "gemini";
  readonly name = "Google Gemini";

  private apiKey?: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  private static readonly DEFAULT_MODELS: ProviderModel[] = [
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", owned_by: "google", supports_streaming: true },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", owned_by: "google", supports_streaming: true },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", owned_by: "google", supports_streaming: true },
  ];

  constructor(options: GeminiAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.fetchFn = options.fetchFn || fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ProviderModel[]> {
    return GeminiProviderAdapter.DEFAULT_MODELS;
  }

  private resolveGeminiModel(modelId: string): string {
    return modelId.replace(/^gemini\//, "");
  }

  private transformOpenAIToGemini(request: ChatCompletionRequest): {
    contents: GeminiContent[];
    systemInstruction?: { parts: GeminiContentPart[] };
    generationConfig: Record<string, unknown>;
  } {
    let systemText: string | undefined;
    const contents: GeminiContent[] = [];

    for (const msg of request.messages) {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
      if (msg.role === "system") {
        systemText = systemText ? `${systemText}\n\n${text}` : text;
      } else {
        const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const generationConfig: Record<string, unknown> = {};
    if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
    if (request.top_p !== undefined) generationConfig.topP = request.top_p;
    if (request.max_tokens !== undefined) generationConfig.maxOutputTokens = request.max_tokens;

    return {
      contents,
      systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
      generationConfig,
    };
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "Google Gemini provider is not configured. Please supply a GEMINI_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const targetModel = this.resolveGeminiModel(request.model);
    const geminiPayload = this.transformOpenAIToGemini(request);

    let res: Response;
    try {
      res = await this.fetchFn(
        `${this.baseUrl}/models/${targetModel}:generateContent?key=${encodeURIComponent(this.apiKey!)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to Google Gemini: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `Gemini API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch {
        // Fallback
      }
      throw new UpstreamError(errorDetail, res.status);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const firstCandidate = data.candidates?.[0];
    const text = firstCandidate?.content?.parts?.map((p) => p.text || "").join("") || "";

    return {
      id: `chatcmpl-gemini-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: text,
          },
          finish_reason: firstCandidate?.finishReason === "STOP" ? "stop" : "stop",
        },
      ],
      usage: data.usageMetadata
        ? {
            prompt_tokens: data.usageMetadata.promptTokenCount || 0,
            completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
            total_tokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "Google Gemini provider is not configured. Please supply a GEMINI_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const targetModel = this.resolveGeminiModel(request.model);
    const geminiPayload = this.transformOpenAIToGemini(request);

    let res: Response;
    try {
      res = await this.fetchFn(
        `${this.baseUrl}/models/${targetModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey!)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        }
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to Google Gemini stream: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `Gemini API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch {
        // Fallback
      }
      throw new UpstreamError(errorDetail, res.status);
    }

    if (!res.body) {
      throw new UpstreamError("No response body received from Gemini stream.", 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const chunkId = `chatcmpl-gemini-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            buffer = "";
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr !== "[DONE]") {
                try {
                  const eventData = JSON.parse(dataStr);
                  const parts = eventData.candidates?.[0]?.content?.parts;
                  const text = parts?.map((p: { text?: string }) => p.text || "").join("");
                  const finishReason = eventData.candidates?.[0]?.finishReason;

                  if (text || finishReason) {
                    yield {
                      id: chunkId,
                      object: "chat.completion.chunk",
                      created,
                      model: request.model,
                      choices: [
                        {
                          index: 0,
                          delta: text ? { content: text } : {},
                          finish_reason: finishReason === "STOP" ? "stop" : finishReason ? "stop" : null,
                        },
                      ],
                    };
                  }
                } catch {
                  // Ignore
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") return;

            try {
              const eventData = JSON.parse(dataStr);
              const parts = eventData.candidates?.[0]?.content?.parts;
              const text = parts?.map((p: { text?: string }) => p.text || "").join("");
              const finishReason = eventData.candidates?.[0]?.finishReason;

              if (text || finishReason) {
                yield {
                  id: chunkId,
                  object: "chat.completion.chunk",
                  created,
                  model: request.model,
                  choices: [
                    {
                      index: 0,
                      delta: text ? { content: text } : {},
                      finish_reason: finishReason === "STOP" ? "stop" : finishReason ? "stop" : null,
                    },
                  ],
                };
              }
            } catch {
              // Ignore invalid chunk
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
