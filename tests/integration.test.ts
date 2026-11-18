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

function createMockAdapter(): ProviderAdapter {
  return {
    id: "openai",
    name: "OpenAI",
    isConfigured: () => true,
    listModels: async (): Promise<ProviderModel[]> => [
      { id: "gpt-4o", name: "GPT-4o", supports_streaming: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", supports_streaming: true },
    ],
    chatCompletion: async (req: ChatCompletionRequest): Promise<ChatCompletionResponse> => ({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1234567890,
      model: req.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Response to: " + (req.messages[0]?.content as string),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 5,
        completion_tokens: 5,
        total_tokens: 10,
      },
    }),
    chatCompletionStream: async function* (req: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
      yield {
        id: "chatcmpl-stream-test",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: req.model,
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: "Chunk 1" },
            finish_reason: null,
          },
        ],
      };
      yield {
        id: "chatcmpl-stream-test",
        object: "chat.completion.chunk",
        created: 1234567890,
        model: req.model,
        choices: [
          {
            index: 0,
            delta: { content: " Chunk 2" },
            finish_reason: "stop",
          },
        ],
      };
    },
  };
}

describe("Fastify Gateway Integration", () => {
  function setupTestApp() {
    const registry = new ProviderRegistry();
    registry.register(createMockAdapter());
    return buildApp({
      config: { NODE_ENV: "test" },
      registry,
    });
  }

  it("serves GET /health with active provider status", async () => {
    const app = setupTestApp();
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.configured_providers).toContain("openai");
  });

  it("serves GET /v1/models matching OpenAI spec", async () => {
    const app = setupTestApp();
    const res = await app.inject({ method: "GET", url: "/v1/models" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((m: { id: string }) => m.id === "gpt-4o")).toBe(true);
  });

  it("serves GET /v1/models/:model for single model", async () => {
    const app = setupTestApp();
    const res = await app.inject({ method: "GET", url: "/v1/models/gpt-4o" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("gpt-4o");
    expect(body.object).toBe("model");
  });

  it("returns 404 for unknown model on GET /v1/models/:model", async () => {
    const app = setupTestApp();
    const res = await app.inject({ method: "GET", url: "/v1/models/unknown-xyz" });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("model_not_found");
  });

  it("handles non-streaming POST /v1/chat/completions", async () => {
    const app = setupTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Ping" }],
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("chatcmpl-test");
    expect(body.choices[0]?.message.content).toBe("Response to: Ping");
    expect(body.usage?.total_tokens).toBe(10);
  });

  it("handles streaming POST /v1/chat/completions with SSE output", async () => {
    const app = setupTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Ping" }],
        stream: true,
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.body).toContain("data: {");
    expect(res.body).toContain("Chunk 1");
    expect(res.body).toContain("Chunk 2");
    expect(res.body).toContain("data: [DONE]");
  });

  it("validates request body and rejects missing fields with 400", async () => {
    const app = setupTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // missing model and messages
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.type).toBe("invalid_request_error");
  });
});
