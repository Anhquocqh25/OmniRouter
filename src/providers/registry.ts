import { ModelListItem, ProviderAdapter, ProviderModel } from "./types.js";

export interface ResolvedRoute {
  adapter: ProviderAdapter;
  modelId: string;
}

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  // Known prefix-to-provider mappings for un-prefixed models
  private static readonly MODEL_PREFIX_MAPPINGS: Record<string, string> = {
    "gpt-": "openai",
    "o1": "openai",
    "o3": "openai",
    "chatgpt-": "openai",
    "claude-": "anthropic",
    "gemini-": "gemini",
    "llama": "ollama",
    "mistral": "ollama",
    "qwen": "ollama",
    "deepseek": "ollama",
  };

  private fallbackChains = new Map<string, string[]>([
    ["gpt-4o", ["claude-3-5-sonnet", "gemini-1.5-pro"]],
    ["gpt-4o-mini", ["claude-3-5-haiku", "gemini-1.5-flash"]],
    ["claude-3-5-sonnet", ["gpt-4o", "gemini-1.5-pro"]],
    ["claude-3-5-haiku", ["gpt-4o-mini", "gemini-1.5-flash"]],
    ["gemini-1.5-pro", ["gpt-4o", "claude-3-5-sonnet"]],
    ["gemini-1.5-flash", ["gpt-4o-mini", "claude-3-5-haiku"]],
  ]);

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  unregister(adapterId: string): void {
    this.adapters.delete(adapterId.toLowerCase());
  }

  getAdapter(adapterId: string): ProviderAdapter | undefined {
    return this.adapters.get(adapterId.toLowerCase());
  }

  getAllAdapters(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  setFallbackChain(model: string, fallbacks: string[]): void {
    this.fallbackChains.set(model.toLowerCase(), fallbacks);
  }

  getFallbackChain(model: string): string[] {
    return this.fallbackChains.get(model.toLowerCase()) || [];
  }

  /**
   * Resolves a model identifier to a concrete provider adapter.
   * Supports:
   * 1. Explicit prefix: 'openai/gpt-4o' -> adapter: openai, modelId: 'gpt-4o'
   * 2. Auto-inference: 'gpt-4o' -> adapter: openai, modelId: 'gpt-4o'
   */
  resolveRoute(requestedModel: string): ResolvedRoute | undefined {
    const trimmed = requestedModel.trim();

    // 1. Check for explicit prefix 'provider/model'
    if (trimmed.includes("/")) {
      const slashIndex = trimmed.indexOf("/");
      const providerPrefix = trimmed.substring(0, slashIndex).toLowerCase();
      const actualModel = trimmed.substring(slashIndex + 1);

      const adapter = this.adapters.get(providerPrefix);
      if (adapter) {
        return { adapter, modelId: actualModel };
      }
    }

    // 2. Check prefix heuristics
    for (const [prefix, providerId] of Object.entries(ProviderRegistry.MODEL_PREFIX_MAPPINGS)) {
      if (trimmed.toLowerCase().startsWith(prefix)) {
        const adapter = this.adapters.get(providerId);
        if (adapter) {
          return { adapter, modelId: trimmed };
        }
      }
    }

    return undefined;
  }

  /**
   * Resolves a chain of routes: [primary, ...fallbacks]
   * Ensures no duplicates and only includes routes with registered & configured adapters.
   */
  resolveRouteChain(requestedModel: string): ResolvedRoute[] {
    const primary = this.resolveRoute(requestedModel);
    if (!primary) return [];

    const chain: ResolvedRoute[] = [primary];
    const seenAdapters = new Set<string>([primary.adapter.id.toLowerCase()]);

    const normalizedModel = requestedModel.includes("/")
      ? requestedModel.substring(requestedModel.indexOf("/") + 1).toLowerCase()
      : requestedModel.toLowerCase();

    const fallbackModels = this.fallbackChains.get(normalizedModel) || [];

    for (const fbModel of fallbackModels) {
      const fbRoute = this.resolveRoute(fbModel);
      if (fbRoute && !seenAdapters.has(fbRoute.adapter.id.toLowerCase()) && fbRoute.adapter.isConfigured()) {
        seenAdapters.add(fbRoute.adapter.id.toLowerCase());
        chain.push(fbRoute);
      }
    }

    return chain;
  }

  /**
   * Aggregates all available models across registered adapters for GET /v1/models
   */
  async listAllModels(): Promise<ModelListItem[]> {
    const now = Math.floor(Date.now() / 1000);
    const results: ModelListItem[] = [];
    const seenIds = new Set<string>();

    for (const adapter of this.adapters.values()) {
      try {
        const models: ProviderModel[] = await adapter.listModels();
        for (const model of models) {
          // Add bare model name
          if (!seenIds.has(model.id)) {
            seenIds.add(model.id);
            results.push({
              id: model.id,
              object: "model",
              created: now,
              owned_by: model.owned_by || adapter.id,
              provider: adapter.id,
            });
          }

          // Also add namespaced model ID (e.g. openai/gpt-4o)
          const namespacedId = `${adapter.id}/${model.id}`;
          if (!seenIds.has(namespacedId)) {
            seenIds.add(namespacedId);
            results.push({
              id: namespacedId,
              object: "model",
              created: now,
              owned_by: model.owned_by || adapter.id,
              provider: adapter.id,
            });
          }
        }
      } catch {
        // Continue if an individual provider fails to list
      }
    }

    return results;
  }
}
