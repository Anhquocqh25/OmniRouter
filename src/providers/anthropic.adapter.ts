import {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderModel,
} from "./types.js";
import { UpstreamError } from "../utils/errors.js";

export interface AnthropicAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export class AnthropicProviderAdapter implements ProviderAdapter {
  readonly id = "anthropic";
  readonly name = "Anthropic";

  private apiKey?: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  private static readonly DEFAULT_MODELS: ProviderModel[] = [
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", owned_by: "anthropic", supports_streaming: true },
    { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", owned_by: "anthropic", supports_streaming: true },
    { id: "claude-3-opus", name: "Claude 3 Opus", owned_by: "anthropic", supports_streaming: true },
  ];

  // Map user-friendly model aliases to specific Anthropic model IDs
  private static readonly MODEL_ALIASES: Record<string, string> = {
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku": "claude-3-5-haiku-20241022",
    "claude-3-opus": "claude-3-opus-20240229",
  };

  constructor(options: AnthropicAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.fetchFn = options.fetchFn || fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  async listModels(): Promise<ProviderModel[]> {
    return AnthropicProviderAdapter.DEFAULT_MODELS;
  }

  private resolveAnthropicModelId(modelId: string): string {
    const normalized = modelId.toLowerCase().replace(/^anthropic\//, "");
    return AnthropicProviderAdapter.MODEL_ALIASES[normalized] || normalized;
  }

  private transformOpenAIToAnthropic(request: ChatCompletionRequest): {
    model: string;
    system?: string;
    messages: AnthropicMessage[];
    max_tokens: number;
    temperature?: number;
    stream?: boolean;
  } {
    let systemPrompt: string | undefined;
    const rawMessages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      const contentStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
      if (msg.role === "system") {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${contentStr}` : contentStr;
      } else {
        const role: "user" | "assistant" = msg.role === "assistant" ? "assistant" : "user";
        rawMessages.push({ role, content: contentStr });
      }
    }

    // Anthropic requires at least 1 message and strict alternating roles
    const messages: AnthropicMessage[] = [];
    for (const msg of rawMessages) {
      const last = messages[messages.length - 1];
      if (last && last.role === msg.role) {
        last.content += `\n\n${msg.content}`;
      } else {
        messages.push({ ...msg });
      }
    }

    if (messages.length === 0) {
      messages.push({ role: "user", content: "Hello" });
    } else if (messages[0]?.role !== "user") {
      messages.unshift({ role: "user", content: "..." });
    }

    return {
      model: this.resolveAnthropicModelId(request.model),
      system: systemPrompt,
      messages,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature !== undefined ? Math.min(request.temperature, 1) : undefined,
      stream: request.stream,
    };
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "Anthropic provider is not configured. Please supply an ANTHROPIC_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const anthropicPayload = this.transformOpenAIToAnthropic(request);
    anthropicPayload.stream = false;

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(anthropicPayload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to Anthropic: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `Anthropic API returned HTTP ${res.status}`;
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
      id: string;
      model: string;
      content: Array<{ type: string; text?: string }>;
      stop_reason?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const textContent = data.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("");

    return {
      id: `chatcmpl-${data.id}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: textContent,
          },
          finish_reason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason || "stop",
        },
      ],
      usage: data.usage
        ? {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *chatCompletionStream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    if (!this.isConfigured()) {
      throw new UpstreamError(
        "Anthropic provider is not configured. Please supply an ANTHROPIC_API_KEY.",
        503,
        "provider_not_configured"
      );
    }

    const anthropicPayload = this.transformOpenAIToAnthropic(request);
    anthropicPayload.stream = true;

    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(anthropicPayload),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to connect to Anthropic stream: ${errorMsg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `Anthropic API returned HTTP ${res.status}`;
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
      throw new UpstreamError("No response body received from Anthropic stream.", 502);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    const chunkId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

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

          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === "[DONE]") return;

            try {
              const eventData = JSON.parse(dataStr);
              if (eventData.type === "content_block_delta" && eventData.delta?.text) {
                yield {
                  id: chunkId,
                  object: "chat.completion.chunk",
                  created,
                  model: request.model,
                  choices: [
                    {
                      index: 0,
                      delta: { content: eventData.delta.text },
                      finish_reason: null,
                    },
                  ],
                };
              } else if (eventData.type === "message_delta" && eventData.delta?.stop_reason) {
                yield {
                  id: chunkId,
                  object: "chat.completion.chunk",
                  created,
                  model: request.model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: eventData.delta.stop_reason === "end_turn" ? "stop" : eventData.delta.stop_reason,
                    },
                  ],
                };
              }
            } catch {
              // Ignore unparseable lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
