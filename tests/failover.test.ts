import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ProviderRegistry } from "../src/providers/registry.js";
import {
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderAdapter,
  ProviderModel,
} from "../src/providers/types.js";
import { BadRequestError, UpstreamError } from "../src/utils/errors.js";

function createFailoverMockAdapter(
  id: string,
  name: string,
  options: {
    shouldFailWith?: { code: number; message: string };
    responseMessage?: string;
  }
): ProviderAdapter {
  return {
    id,
    name,
    isConfigured: () => true,
    listModels: async (): Promise<ProviderModel[]> => [
      { id: `${id}-model`, name: `${name} Model`, supports_streaming: true },
    ],
    chatCompletion: async (req: ChatCompletionRequest): Promise<ChatCompletionResponse> => {
      if (options.shouldFailWith) {
        if (options.shouldFailWith.code === 400) {
          throw new BadRequestError(options.shouldFailWith.message);
        }
        throw new UpstreamError(options.shouldFailWith.message, options.shouldFailWith.code);
      }
      return {
        id: `chatcmpl-${id}`,
        object: "chat.completion",
        created: Date.now(),
        model: req.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: options.responseMessage || `Hello from ${name}` },
            finish_reason: "stop",
          },
        ],
      };
    },
    chatCompletionStream: async function* (req: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
      if (options.shouldFailWith) {
        throw new UpstreamError(options.shouldFailWith.message, options.shouldFailWith.code);
      }
      yield {
        id: `chunk-${id}`,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: req.model,
        choices: [{ index: 0, delta: { content: options.responseMessage || `Stream from ${name}` }, finish_reason: null }],
      };
    },
  };
}

describe("Intelligent Routing & Automatic Failover", () => {
  it("automatically fails over to secondary adapter when primary returns 429 Rate Limit", async () => {
    const registry = new ProviderRegistry();
    // Primary adapter fails with 429
    const failingOpenAI = createFailoverMockAdapter("openai", "OpenAI", {
      shouldFailWith: { code: 429, message: "Rate limit exceeded on OpenAI" },
    });
    // Backup adapter succeeds
    const backupClaude = createFailoverMockAdapter("anthropic", "Anthropic", {
      responseMessage: "Recovered by Anthropic Claude!",
    });

    registry.register(failingOpenAI);
    registry.register(backupClaude);
    registry.setFallbackChain("gpt-4o", ["claude-3-5-sonnet"]);

    const app = buildApp({
      config: { NODE_ENV: "test" },
      registry,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.choices[0]?.message.content).toBe("Recovered by Anthropic Claude!");
  });

  it("automatically fails over to secondary adapter when primary returns 502/503 Upstream Error", async () => {
    const registry = new ProviderRegistry();
    const failingOpenAI = createFailoverMockAdapter("openai", "OpenAI", {
      shouldFailWith: { code: 503, message: "Service Unavailable" },
    });
    const backupGemini = createFailoverMockAdapter("gemini", "Google Gemini", {
      responseMessage: "Recovered by Gemini!",
    });

    registry.register(failingOpenAI);
    registry.register(backupGemini);
    registry.setFallbackChain("gpt-4o", ["gemini-1.5-pro"]);

    const app = buildApp({
      config: { NODE_ENV: "test" },
      registry,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.choices[0]?.message.content).toBe("Recovered by Gemini!");
  });

  it("fails over during stream setup if primary encounters an error", async () => {
    const registry = new ProviderRegistry();
    const failingOpenAI = createFailoverMockAdapter("openai", "OpenAI", {
      shouldFailWith: { code: 429, message: "OpenAI stream rate limited" },
    });
    const backupClaude = createFailoverMockAdapter("anthropic", "Anthropic", {
      responseMessage: "Streamed via Claude",
    });

    registry.register(failingOpenAI);
    registry.register(backupClaude);
    registry.setFallbackChain("gpt-4o", ["claude-3-5-sonnet"]);

    const app = buildApp({
      config: { NODE_ENV: "test" },
      registry,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Streamed via Claude");
    expect(res.body).toContain("data: [DONE]");
  });

  it("does not fail over on non-retryable 400 Bad Request error", async () => {
    const registry = new ProviderRegistry();
    const failingOpenAI = createFailoverMockAdapter("openai", "OpenAI", {
      shouldFailWith: { code: 400, message: "Invalid parameter" },
    });
    const backupClaude = createFailoverMockAdapter("anthropic", "Anthropic");

    registry.register(failingOpenAI);
    registry.register(backupClaude);
    registry.setFallbackChain("gpt-4o", ["claude-3-5-sonnet"]);

    const app = buildApp({
      config: { NODE_ENV: "test" },
      registry,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toBe("Invalid parameter");
  });
});
