import { describe, expect, it } from "vitest";
import { GeminiProviderAdapter } from "../src/providers/gemini.adapter.js";

describe("GeminiProviderAdapter", () => {
  it("reports configured status based on API key", () => {
    const unconfigured = new GeminiProviderAdapter();
    expect(unconfigured.isConfigured()).toBe(false);

    const configured = new GeminiProviderAdapter({ apiKey: "AIzaSyTest" });
    expect(configured.isConfigured()).toBe(true);
  });

  it("translates OpenAI messages to Gemini contents and returns completion", async () => {
    let capturedUrl = "";
    let capturedBody: any;

    const mockFetch: typeof fetch = async (url, init) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Hello from Gemini 1.5 Pro!" }],
                role: "model",
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const adapter = new GeminiProviderAdapter({
      apiKey: "AIzaSy123",
      fetchFn: mockFetch,
    });

    const response = await adapter.chatCompletion({
      model: "gemini-1.5-pro",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Introduce yourself." },
      ],
    });

    expect(capturedUrl).toContain("/models/gemini-1.5-pro:generateContent?key=AIzaSy123");
    expect(capturedBody.systemInstruction.parts[0].text).toBe("You are a helpful assistant.");
    expect(capturedBody.contents).toEqual([{ role: "user", parts: [{ text: "Introduce yourself." }] }]);

    expect(response.choices[0]?.message.content).toBe("Hello from Gemini 1.5 Pro!");
    expect(response.choices[0]?.finish_reason).toBe("stop");
    expect(response.usage?.total_tokens).toBe(25);
  });

  it("handles streaming chat completion", async () => {
    const sseLines = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Gemini "}]}}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":"streaming works!"}]},"finishReason":"STOP"}]}',
      "data: [DONE]",
    ].join("\n\n") + "\n\n";

    const mockFetch: typeof fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseLines));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };

    const adapter = new GeminiProviderAdapter({
      apiKey: "AIzaSy123",
      fetchFn: mockFetch,
    });

    const chunks = [];
    for await (const chunk of adapter.chatCompletionStream({
      model: "gemini-1.5-flash",
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Gemini ");
    expect(chunks[1]?.choices[0]?.delta.content).toBe("streaming works!");
    expect(chunks[1]?.choices[0]?.finish_reason).toBe("stop");
  });
});
