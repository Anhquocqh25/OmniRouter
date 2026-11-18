import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { generateApiKey, hashToken } from "../db/crypto.js";

export class GatewayKeysService {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.db = db;
  }

  createKey(name: string): { key: schema.GatewayApiKey; token: string } {
    const id = `key_${crypto.randomUUID()}`;
    const { token, hash } = generateApiKey();
    const keyPrefix = token.substring(0, 16) + "...";
    const now = Date.now();

    const newKey: schema.NewGatewayApiKey = {
      id,
      name,
      keyHash: hash,
      keyPrefix,
      isActive: true,
      createdAt: now,
      lastUsedAt: null,
    };

    this.db.insert(schema.gatewayApiKeys).values(newKey).run();

    return {
      key: {
        ...newKey,
        isActive: true,
        lastUsedAt: null,
      },
      token,
    };
  }

  verifyToken(token: string): schema.GatewayApiKey | null {
    const hash = hashToken(token);
    const key = this.db
      .select()
      .from(schema.gatewayApiKeys)
      .where(eq(schema.gatewayApiKeys.keyHash, hash))
      .get();

    if (!key || !key.isActive) {
      return null;
    }

    // Update last_used_at timestamp
    const now = Date.now();
    this.db
      .update(schema.gatewayApiKeys)
      .set({ lastUsedAt: now })
      .where(eq(schema.gatewayApiKeys.id, key.id))
      .run();

    return { ...key, lastUsedAt: now };
  }

  revokeKey(id: string): boolean {
    const res = this.db
      .update(schema.gatewayApiKeys)
      .set({ isActive: false })
      .where(eq(schema.gatewayApiKeys.id, id))
      .run();
    return res.changes > 0;
  }

  activateKey(id: string): boolean {
    const res = this.db
      .update(schema.gatewayApiKeys)
      .set({ isActive: true })
      .where(eq(schema.gatewayApiKeys.id, id))
      .run();
    return res.changes > 0;
  }

  listKeys(): schema.GatewayApiKey[] {
    return this.db.select().from(schema.gatewayApiKeys).all();
  }

  deleteKey(id: string): boolean {
    const res = this.db
      .delete(schema.gatewayApiKeys)
      .where(eq(schema.gatewayApiKeys.id, id))
      .run();
    return res.changes > 0;
  }
}
