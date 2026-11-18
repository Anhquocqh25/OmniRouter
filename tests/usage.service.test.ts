import { describe, expect, it } from "vitest";
import { initDatabase } from "../src/db/index.js";
import { UsageService } from "../src/services/usage.service.js";

describe("UsageService", () => {
  it("records usage logs and computes accurate aggregate metrics", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new UsageService(db);

      service.recordUsage({
        keyId: "key-1",
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        latencyMs: 150,
        statusCode: 200,
      });

      service.recordUsage({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        promptTokens: 25,
        completionTokens: 50,
        totalTokens: 75,
        latencyMs: 250,
        statusCode: 200,
      });

      service.recordUsage({
        keyId: "key-2",
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: 50,
        statusCode: 429,
        errorType: "rate_limit_error",
      });

      const metrics = service.getAggregateMetrics();

      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalTokens).toBe(105);
      expect(metrics.totalPromptTokens).toBe(35);
      expect(metrics.totalCompletionTokens).toBe(70);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.averageLatencyMs).toBe(150); // (150+250+50)/3 = 150

      expect(metrics.providerBreakdown["openai"]?.requests).toBe(2);
      expect(metrics.providerBreakdown["openai"]?.tokens).toBe(30);
      expect(metrics.providerBreakdown["anthropic"]?.requests).toBe(1);
      expect(metrics.providerBreakdown["anthropic"]?.tokens).toBe(75);

      const recent = service.getRecentLogs(2);
      expect(recent).toHaveLength(2);
    } finally {
      close();
    }
  });
});
