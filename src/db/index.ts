import Database, { Database as DatabaseType } from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export interface DatabaseConnection {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: DatabaseType;
  close: () => void;
}

export function initDatabase(dbPath?: string): DatabaseConnection {
  const resolvedPath = dbPath || process.env.DATABASE_PATH || "data/omnirouter.db";

  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(resolvedPath);

  // Enable WAL mode for high performance on Windows
  if (resolvedPath !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.pragma("foreign_keys = ON");

  // Bootstrap tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS gateway_api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS provider_credentials (
      provider_id TEXT PRIMARY KEY,
      encrypted_key TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      key_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL,
      status_code INTEGER NOT NULL,
      error_type TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_sessions (
      state TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      provider_id TEXT PRIMARY KEY,
      encrypted_access_token TEXT NOT NULL,
      encrypted_refresh_token TEXT,
      token_type TEXT NOT NULL DEFAULT 'Bearer',
      scope TEXT,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_key_id ON usage_logs(key_id);
    CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage_logs(provider);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);
  `);

  const db = drizzle(sqlite, { schema });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
