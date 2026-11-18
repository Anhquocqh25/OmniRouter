import {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderModel,
} from "./types.js";
import { UpstreamError } from "../utils/errors.js";

export interface OpenAIAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class OpenAIProviderAdapter implements ProviderAdapter {
  readonly id = "openai";
  readonly name = "OpenAI";

  private apiKey?: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  private static readonly DEFAULT_MODELS: ProviderModel[] = [
    { id: "gpt-4o", name: "GPT-4o", owned_by: "openai", supports_streaming: true },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", owned_by: "openai", supports_streaming: true },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", owned_by: "openai", supports_streaming: true },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", owned_by: "openai", supports_streaming: true },
    { id: "o1", name: "o1", owned_by: "openai", supports_streaming: false },
    { id: "o1-mini", name: "o1-mini", owned_by: "openai", supports_streaming: false },
    { id: "o3-mini", name: "o3-mini", owned_by: "openai", supports_streaming: true },
  ];

  constructor(options: OpenAIAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    this.fetchFn = options.fetchFn || fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ProviderModel[]> {
    if (!this.isConfigured()) {
      return OpenAIProviderAdapter.DEFAULT_MODELS;
    }

    try {
      const response = await this.fetchFn(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return OpenAIProviderAdapter.DEFAULT_MODELS;
      }

      const body = (await response.json()) as { data?: Array<{ id: string; owned_by?: string }> };
      if (!body.data || !Array.isArray(body.data)) {
        return OpenAIProviderAdapter.DEFAULT_MODELS;
      }

      const chatPrefixes = ["gpt-", "o1", "o3", "chatgpt-"];
      const models = body.data
        .filter((m) => chatPrefixes.some((p) => m.id.startsWith(p)))
        .map((m) => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by || "openai",
          supports_streaming: !m.id.startsWith("o1-preview"),
        }));

      return models.length > 0 ? models : OpenAIProviderAdapter.DEFAULT_MODELS;
    } catch {
      return OpenAIProviderAdapter.DEFAULT_MODELS;
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "OpenAI provider is not configured. Please supply an OPENAI_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const payload = { ...request, stream: false };

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to OpenAI: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `OpenAI API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch {
        // Fallback to generic message
      }
      throw new UpstreamError(errorDetail, res.status);
    }

    return (await res.json()) as ChatCompletionResponse;
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "OpenAI provider is not configured. Please supply an OPENAI_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const payload = { ...request, stream: true };

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to OpenAI stream: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `OpenAI API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        if (errJson.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch {
        // fallback
      }
      throw new UpstreamError(errorDetail, res.status);
    }

    if (!res.body) {
      throw new UpstreamError("No response body received from OpenAI stream.", 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed === "data: [DONE]") {
            return;
          }

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            try {
              const chunk = JSON.parse(dataStr) as ChatCompletionChunk;
              yield chunk;
            } catch {
              // Ignore malformed intermediate chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
