import {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderModel,
} from "./types.js";
import { UpstreamError } from "../utils/errors.js";

export interface OllamaAdapterOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class OllamaProviderAdapter implements ProviderAdapter {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";

  private baseUrl: string;
  private fetchFn: typeof fetch;

  private static readonly FALLBACK_MODELS: ProviderModel[] = [
    { id: "llama3", name: "Llama 3", owned_by: "ollama", supports_streaming: true },
    { id: "llama3.1", name: "Llama 3.1", owned_by: "ollama", supports_streaming: true },
    { id: "mistral", name: "Mistral", owned_by: "ollama", supports_streaming: true },
    { id: "qwen2.5", name: "Qwen 2.5", owned_by: "ollama", supports_streaming: true },
    { id: "deepseek-r1", name: "DeepSeek R1", owned_by: "ollama", supports_streaming: true },
  ];

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
    this.fetchFn = options.fetchFn || fetch;
  }

  isConfigured(): boolean {
    return true; // Local provider with no authentication credentials needed
  }

  async listModels(): Promise<ProviderModel[]> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/tags`);
      if (!res.ok) {
        return OllamaProviderAdapter.FALLBACK_MODELS;
      }

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      if (!data.models || !Array.isArray(data.models) || data.models.length === 0) {
        return OllamaProviderAdapter.FALLBACK_MODELS;
      }

      return data.models.map((m) => {
        const cleanName = m.name.replace(/:latest$/, "");
        return {
          id: cleanName,
          name: m.name,
          owned_by: "ollama",
          supports_streaming: true,
        };
      });
    } catch {
      return OllamaProviderAdapter.FALLBACK_MODELS;
    }
  }

  private resolveOllamaModel(modelId: string): string {
    return modelId.replace(/^ollama\//, "");
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const targetModel = this.resolveOllamaModel(request.model);
    const payload = {
      ...request,
      model: targetModel,
      stream: false,
    };

    let res: Response;
    try {
      // Use Ollama's native OpenAI-compatible API
      res = await this.fetchFn(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to local Ollama instance: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `Ollama API returned HTTP ${res.status}`;
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

    return (await res.json()) as ChatCompletionResponse;
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    const targetModel = this.resolveOllamaModel(request.model);
    const payload = {
      ...request,
      model: targetModel,
      stream: true,
    };

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to local Ollama stream: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      throw new UpstreamError(`Ollama API returned HTTP ${res.status}`, res.status);
    }

    if (!res.body) {
      throw new UpstreamError("No response body received from Ollama stream.", 502);
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

          if (trimmed === "data: [DONE]") return;

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            try {
              const chunk = JSON.parse(dataStr) as ChatCompletionChunk;
              yield chunk;
            } catch {
              // Ignore malformed intermediate chunk
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
