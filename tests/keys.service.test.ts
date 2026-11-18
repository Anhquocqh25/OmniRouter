import { describe, expect, it } from "vitest";
import { initDatabase } from "../src/db/index.js";
import { GatewayKeysService } from "../src/services/keys.service.js";

describe("GatewayKeysService", () => {
  it("creates, verifies, and updates lastUsedAt for gateway keys", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new GatewayKeysService(db);

      const { key, token } = service.createKey("VS Code Laptop");
      expect(key.name).toBe("VS Code Laptop");
      expect(token).toMatch(/^omni-live-/);
      expect(key.isActive).toBe(true);
      expect(key.lastUsedAt).toBeNull();

      // Verify with valid token
      const verified = service.verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe(key.id);
      expect(verified?.lastUsedAt).toBeGreaterThan(0);

      // Verify with invalid token
      const invalid = service.verifyToken("omni-live-fake-token");
      expect(invalid).toBeNull();
    } finally {
      close();
    }
  });

  it("rejects revoked keys and allows re-activation", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new GatewayKeysService(db);

      const { key, token } = service.createKey("Temporary Key");
      expect(service.verifyToken(token)).not.toBeNull();

      // Revoke
      service.revokeKey(key.id);
      expect(service.verifyToken(token)).toBeNull();

      // Re-activate
      service.activateKey(key.id);
      expect(service.verifyToken(token)).not.toBeNull();
    } finally {
      close();
    }
  });

  it("lists and deletes keys", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new GatewayKeysService(db);

      const k1 = service.createKey("Key 1");
      const k2 = service.createKey("Key 2");

      const list = service.listKeys();
      expect(list).toHaveLength(2);

      service.deleteKey(k1.key.id);
      expect(service.listKeys()).toHaveLength(1);
    } finally {
      close();
    }
  });
});
