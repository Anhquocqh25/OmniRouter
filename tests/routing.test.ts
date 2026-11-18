import { describe, expect, it } from "vitest";
import { ProviderRegistry } from "../src/providers/registry.js";
import { ProviderAdapter, ProviderModel } from "../src/providers/types.js";

function createMockAdapter(id: string, name: string, models: string[]): ProviderAdapter {
  return {
    id,
    name,
    isConfigured: () => true,
    listModels: async (): Promise<ProviderModel[]> =>
      models.map((m) => ({ id: m, name: m, supports_streaming: true })),
    chatCompletion: async () => {
      throw new Error("Not implemented in mock");
    },
    chatCompletionStream: async function* () {
      yield* [];
    },
  };
}

describe("ProviderRegistry Routing", () => {
  it("resolves route via explicit prefix (e.g. openai/gpt-4o)", () => {
    const registry = new ProviderRegistry();
    const openai = createMockAdapter("openai", "OpenAI", ["gpt-4o"]);
    const anthropic = createMockAdapter("anthropic", "Anthropic", ["claude-3-5-sonnet"]);

    registry.register(openai);
    registry.register(anthropic);

    const resolved = registry.resolveRoute("openai/gpt-4o");
    expect(resolved).toBeDefined();
    expect(resolved?.adapter.id).toBe("openai");
    expect(resolved?.modelId).toBe("gpt-4o");

    const resolvedClaude = registry.resolveRoute("anthropic/claude-3-5-sonnet");
    expect(resolvedClaude).toBeDefined();
    expect(resolvedClaude?.adapter.id).toBe("anthropic");
    expect(resolvedClaude?.modelId).toBe("claude-3-5-sonnet");
  });

  it("infers provider from model prefix heuristics", () => {
    const registry = new ProviderRegistry();
    const openai = createMockAdapter("openai", "OpenAI", ["gpt-4o", "o1-mini"]);
    const anthropic = createMockAdapter("anthropic", "Anthropic", ["claude-3-5-sonnet"]);
    const gemini = createMockAdapter("gemini", "Google Gemini", ["gemini-1.5-pro"]);

    registry.register(openai);
    registry.register(anthropic);
    registry.register(gemini);

    expect(registry.resolveRoute("gpt-4o")?.adapter.id).toBe("openai");
    expect(registry.resolveRoute("o1-mini")?.adapter.id).toBe("openai");
    expect(registry.resolveRoute("claude-3-5-sonnet")?.adapter.id).toBe("anthropic");
    expect(registry.resolveRoute("gemini-1.5-pro")?.adapter.id).toBe("gemini");
  });

  it("aggregates and namespaces all models correctly", async () => {
    const registry = new ProviderRegistry();
    const openai = createMockAdapter("openai", "OpenAI", ["gpt-4o"]);
    const anthropic = createMockAdapter("anthropic", "Anthropic", ["claude-3-5-sonnet"]);

    registry.register(openai);
    registry.register(anthropic);

    const models = await registry.listAllModels();
    const ids = models.map((m) => m.id);

    // Bare model IDs
    expect(ids).toContain("gpt-4o");
    expect(ids).toContain("claude-3-5-sonnet");

    // Namespaced IDs
    expect(ids).toContain("openai/gpt-4o");
    expect(ids).toContain("anthropic/claude-3-5-sonnet");
  });

  it("returns undefined when no adapter matches and registry is empty", () => {
    const registry = new ProviderRegistry();
    expect(registry.resolveRoute("unknown-model")).toBeUndefined();
  });
});
