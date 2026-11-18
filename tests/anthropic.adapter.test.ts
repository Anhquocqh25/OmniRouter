import { describe, expect, it } from "vitest";
import { AnthropicProviderAdapter } from "../src/providers/anthropic.adapter.js";

describe("AnthropicProviderAdapter", () => {
  it("reports configured status based on API key", () => {
    const unconfigured = new AnthropicProviderAdapter();
    expect(unconfigured.isConfigured()).toBe(false);

    const configured = new AnthropicProviderAdapter({ apiKey: "sk-ant-test" });
    expect(configured.isConfigured()).toBe(true);
  });

  it("handles non-streaming chat completion with system message and role translation", async () => {
    let capturedBody: any;
    let capturedHeaders: any;

    const mockFetch: typeof fetch = async (url, init) => {
      expect(url.toString()).toContain("/messages");
      capturedHeaders = init?.headers;
      capturedBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          id: "msg_12345",
          model: "claude-3-5-sonnet-20241022",
          content: [{ type: "text", text: "Hello from Claude!" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 15, output_tokens: 8 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const adapter = new AnthropicProviderAdapter({
      apiKey: "sk-ant-test-key",
      fetchFn: mockFetch,
    });

    const response = await adapter.chatCompletion({
      model: "claude-3-5-sonnet",
      messages: [
        { role: "system", content: "You are a coding assistant." },
        { role: "user", content: "Write hello world." },
      ],
      max_tokens: 1000,
    });

    expect(capturedHeaders["x-api-key"]).toBe("sk-ant-test-key");
    expect(capturedHeaders["anthropic-version"]).toBe("2023-06-01");
    expect(capturedBody.system).toBe("You are a coding assistant.");
    expect(capturedBody.messages).toEqual([{ role: "user", content: "Write hello world." }]);
    expect(capturedBody.max_tokens).toBe(1000);

    expect(response.id).toBe("chatcmpl-msg_12345");
    expect(response.choices[0]?.message.content).toBe("Hello from Claude!");
    expect(response.choices[0]?.finish_reason).toBe("stop");
    expect(response.usage?.total_tokens).toBe(23);
  });

  it("handles streaming chat completion", async () => {
    const sseLines = [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_stream_1","model":"claude-3-5-sonnet"}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi "}}',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"there!"}}',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      'event: message_stop\ndata: {"type":"message_stop"}',
    ].join("\n\n");

    const mockFetch: typeof fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseLines));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };

    const adapter = new AnthropicProviderAdapter({
      apiKey: "sk-ant-test",
      fetchFn: mockFetch,
    });

    const chunks = [];
    for await (const chunk of adapter.chatCompletionStream({
      model: "claude-3-5-sonnet",
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Hi ");
    expect(chunks[1]?.choices[0]?.delta.content).toBe("there!");
  });
});
