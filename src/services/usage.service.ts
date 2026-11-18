import crypto from "node:crypto";
import { desc, sql } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";

export interface AggregateMetrics {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorCount: number;
  providerBreakdown: Record<string, { requests: number; tokens: number }>;
  modelBreakdown: Record<string, { requests: number; tokens: number }>;
}

export class UsageService {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.db = db;
  }

  recordUsage(params: {
    keyId?: string;
    provider: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs: number;
    statusCode: number;
    errorType?: string | null;
  }): schema.UsageLog {
    const id = `log_${crypto.randomUUID()}`;
    const createdAt = Date.now();
    const promptTokens = params.promptTokens || 0;
    const completionTokens = params.completionTokens || 0;
    const totalTokens = params.totalTokens || promptTokens + completionTokens;

    const newLog: schema.NewUsageLog = {
      id,
      keyId: params.keyId || null,
      provider: params.provider,
      model: params.model,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs: params.latencyMs,
      statusCode: params.statusCode,
      errorType: params.errorType || null,
      createdAt,
    };

    this.db.insert(schema.usageLogs).values(newLog).run();

    return {
      ...newLog,
      keyId: newLog.keyId ?? null,
      promptTokens: newLog.promptTokens ?? 0,
      completionTokens: newLog.completionTokens ?? 0,
      totalTokens: newLog.totalTokens ?? 0,
      errorType: newLog.errorType ?? null,
    };
  }

  getAggregateMetrics(): AggregateMetrics {
    const allLogs = this.db.select().from(schema.usageLogs).all();

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    let errorCount = 0;

    const providerBreakdown: Record<string, { requests: number; tokens: number }> = {};
    const modelBreakdown: Record<string, { requests: number; tokens: number }> = {};

    for (const log of allLogs) {
      totalPrompt += log.promptTokens;
      totalCompletion += log.completionTokens;
      totalTokens += log.totalTokens;
      totalLatency += log.latencyMs;

      if (log.statusCode >= 400) {
        errorCount++;
      }

      // Provider
      const p = log.provider || "unknown";
      if (!providerBreakdown[p]) providerBreakdown[p] = { requests: 0, tokens: 0 };
      providerBreakdown[p]!.requests++;
      providerBreakdown[p]!.tokens += log.totalTokens;

      // Model
      const m = log.model || "unknown";
      if (!modelBreakdown[m]) modelBreakdown[m] = { requests: 0, tokens: 0 };
      modelBreakdown[m]!.requests++;
      modelBreakdown[m]!.tokens += log.totalTokens;
    }

    const totalRequests = allLogs.length;
    const averageLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;

    return {
      totalRequests,
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalCompletion,
      totalTokens,
      averageLatencyMs,
      errorCount,
      providerBreakdown,
      modelBreakdown,
    };
  }

  getRecentLogs(limit = 50): schema.UsageLog[] {
    return this.db
      .select()
      .from(schema.usageLogs)
      .orderBy(desc(schema.usageLogs.createdAt))
      .limit(limit)
      .all();
  }
}
