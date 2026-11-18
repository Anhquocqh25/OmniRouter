import { describe, expect, it } from "vitest";
import { OpenAIProviderAdapter } from "../src/providers/openai.adapter.js";

describe("OpenAIProviderAdapter", () => {
  it("reports configured status correctly based on api key presence", () => {
    const unconfigured = new OpenAIProviderAdapter();
    expect(unconfigured.isConfigured()).toBe(false);

    const configured = new OpenAIProviderAdapter({ apiKey: "sk-test-key" });
    expect(configured.isConfigured()).toBe(true);
  });

  it("returns default model list when not configured", async () => {
    const adapter = new OpenAIProviderAdapter();
    const models = await adapter.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === "gpt-4o")).toBe(true);
  });

  it("handles non-streaming chatCompletion with mocked fetch", async () => {
    const mockResponseData = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1677652288,
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Hello from mock OpenAI!",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 12,
        total_tokens: 21,
      },
    };

    const mockFetch: typeof fetch = async (url, init) => {
      expect(url.toString()).toContain("/chat/completions");
      expect(init?.headers).toBeDefined();
      const headers = init?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer sk-mock-key");

      return new Response(JSON.stringify(mockResponseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new OpenAIProviderAdapter({
      apiKey: "sk-mock-key",
      fetchFn: mockFetch,
    });

    const response = await adapter.chatCompletion({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response.id).toBe("chatcmpl-123");
    expect(response.choices[0]?.message.content).toBe("Hello from mock OpenAI!");
  });

  it("handles streaming chatCompletionStream with mocked fetch SSE", async () => {
    const sseBody = [
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1677652288,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":null}]}',
      "data: [DONE]",
    ].join("\n\n");

    const mockFetch: typeof fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };

    const adapter = new OpenAIProviderAdapter({
      apiKey: "sk-mock-key",
      fetchFn: mockFetch,
    });

    const chunks = [];
    for await (const chunk of adapter.chatCompletionStream({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Hel");
    expect(chunks[1]?.choices[0]?.delta.content).toBe("lo");
  });

  it("throws UpstreamError when provider is not configured", async () => {
    const adapter = new OpenAIProviderAdapter();

    await expect(
      adapter.chatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow("OpenAI provider is not configured");
  });
});
