import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gatewayApiKeys = sqliteTable("gateway_api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});

export type GatewayApiKey = typeof gatewayApiKeys.$inferSelect;
export type NewGatewayApiKey = typeof gatewayApiKeys.$inferInsert;

export const providerCredentials = sqliteTable("provider_credentials", {
  providerId: text("provider_id").primaryKey(),
  encryptedKey: text("encrypted_key").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type NewProviderCredential = typeof providerCredentials.$inferInsert;

export const usageLogs = sqliteTable("usage_logs", {
  id: text("id").primaryKey(),
  keyId: text("key_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  errorType: text("error_type"),
  createdAt: integer("created_at").notNull(),
});

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
