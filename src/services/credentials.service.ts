import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { decrypt, deriveKey, encrypt } from "../db/crypto.js";

export class CredentialsService {
  private db: BetterSQLite3Database<typeof schema>;
  private masterKey: Buffer;

  constructor(db: BetterSQLite3Database<typeof schema>, encryptionSecret = "omnirouter-default-secret-key") {
    this.db = db;
    this.masterKey = deriveKey(encryptionSecret);
  }

  setCredential(providerId: string, plainKey: string): void {
    const encryptedKey = encrypt(plainKey, this.masterKey);
    const now = Date.now();

    this.db
      .insert(schema.providerCredentials)
      .values({
        providerId: providerId.toLowerCase(),
        encryptedKey,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.providerCredentials.providerId,
        set: {
          encryptedKey,
          updatedAt: now,
        },
      })
      .run();
  }

  getCredential(providerId: string): string | null {
    const row = this.db
      .select()
      .from(schema.providerCredentials)
      .where(eq(schema.providerCredentials.providerId, providerId.toLowerCase()))
      .get();

    if (!row) return null;

    try {
      return decrypt(row.encryptedKey, this.masterKey);
    } catch {
      return null;
    }
  }

  deleteCredential(providerId: string): boolean {
    const res = this.db
      .delete(schema.providerCredentials)
      .where(eq(schema.providerCredentials.providerId, providerId.toLowerCase()))
      .run();
    return res.changes > 0;
  }

  listConfiguredProviders(): string[] {
    const rows = this.db.select({ providerId: schema.providerCredentials.providerId }).from(schema.providerCredentials).all();
    return rows.map((r) => r.providerId);
  }
}
