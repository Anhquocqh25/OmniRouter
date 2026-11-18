import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { initDatabase } from "../src/db/index.js";
import { ProviderRegistry } from "../src/providers/registry.js";
import { ProviderAdapter, ProviderModel } from "../src/providers/types.js";

function createMockAdapter(): ProviderAdapter {
  return {
    id: "openai",
    name: "OpenAI",
    isConfigured: () => true,
    listModels: async (): Promise<ProviderModel[]> => [{ id: "gpt-4o", name: "GPT-4o", supports_streaming: true }],
    chatCompletion: async (req) => ({
      id: "chatcmpl-test-db",
      object: "chat.completion",
      created: Date.now(),
      model: req.model,
      choices: [{ index: 0, message: { role: "assistant", content: "Persistence working!" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    }),
    chatCompletionStream: async function* () {
      yield* [];
    },
  };
}

describe("SQLite + Drizzle ORM Gateway Integration", () => {
  it("authenticates via database-stored gateway key, records token usage, and aggregates metrics", async () => {
    const dbConn = initDatabase(":memory:");
    const registry = new ProviderRegistry();
    registry.register(createMockAdapter());

    const app = buildApp({
      config: { NODE_ENV: "test" },
      dbConnection: dbConn,
      registry,
    });

    // 1. Initially create a new key via Admin endpoint
    const createKeyRes = await app.inject({
      method: "POST",
      url: "/v1/admin/keys",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "VS Code Client" }),
    });

    expect(createKeyRes.statusCode).toBe(201);
    const { key, token } = JSON.parse(createKeyRes.body);
    expect(key.name).toBe("VS Code Client");
    expect(token).toMatch(/^omni-live-/);

    // 2. Request /v1/chat/completions using the newly generated DB token
    const chatRes = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hello persistence" }],
      }),
    });

    expect(chatRes.statusCode).toBe(200);
    const chatBody = JSON.parse(chatRes.body);
    expect(chatBody.choices[0]?.message.content).toBe("Persistence working!");

    // 3. Verify key lastUsedAt was updated in SQLite
    const keysRes = await app.inject({
      method: "GET",
      url: "/v1/admin/keys",
      headers: { authorization: `Bearer ${token}` },
    });
    const keysList = JSON.parse(keysRes.body);
    const usedKey = keysList.data.find((k: { id: string }) => k.id === key.id);
    expect(usedKey.lastUsedAt).toBeGreaterThan(0);

    // 4. Verify metrics accurately record the 20 tokens used
    const metricsRes = await app.inject({
      method: "GET",
      url: "/v1/admin/metrics",
      headers: { authorization: `Bearer ${token}` },
    });
    const metrics = JSON.parse(metricsRes.body);

    expect(metrics.totalRequests).toBe(1);
    expect(metrics.totalTokens).toBe(20);
    expect(metrics.totalPromptTokens).toBe(12);
    expect(metrics.totalCompletionTokens).toBe(8);
    expect(metrics.providerBreakdown["openai"]?.tokens).toBe(20);

    // 5. Revoke the key and verify subsequent requests are blocked with 401
    await app.inject({
      method: "POST",
      url: `/v1/admin/keys/${key.id}/revoke`,
      headers: { authorization: `Bearer ${token}` },
    });

    const blockedRes = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Should fail" }],
      }),
    });

    expect(blockedRes.statusCode).toBe(401);
  });
});
