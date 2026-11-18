import { describe, expect, it } from "vitest";
import { OllamaProviderAdapter } from "../src/providers/ollama.adapter.js";

describe("OllamaProviderAdapter", () => {
  it("reports configured status true without requiring an API key", () => {
    const adapter = new OllamaProviderAdapter();
    expect(adapter.isConfigured()).toBe(true);
  });

  it("dynamically queries /api/tags to list installed models", async () => {
    const mockFetch: typeof fetch = async (url) => {
      expect(url.toString()).toContain("/api/tags");
      return new Response(
        JSON.stringify({
          models: [
            { name: "llama3:latest", modified_at: "2024-05-01" },
            { name: "qwen2.5:latest", modified_at: "2024-05-01" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
    const models = await adapter.listModels();

    expect(models.length).toBe(2);
    expect(models[0]?.id).toBe("llama3");
    expect(models[1]?.id).toBe("qwen2.5");
  });

  it("falls back to default models when Ollama is offline during listing", async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error("Connection refused (ECONNREFUSED)");
    };

    const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
    const models = await adapter.listModels();

    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === "llama3")).toBe(true);
  });

  it("handles chat completions via Ollama OpenAI-compatible endpoint", async () => {
    const mockFetch: typeof fetch = async (url, init) => {
      expect(url.toString()).toContain("/v1/chat/completions");
      const body = JSON.parse(init?.body as string);
      expect(body.model).toBe("llama3");

      return new Response(
        JSON.stringify({
          id: "chatcmpl-ollama-123",
          object: "chat.completion",
          created: 1234567890,
          model: "llama3",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello from local Llama 3!" },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const adapter = new OllamaProviderAdapter({ fetchFn: mockFetch });
    const response = await adapter.chatCompletion({
      model: "ollama/llama3",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(response.choices[0]?.message.content).toBe("Hello from local Llama 3!");
  });
});
