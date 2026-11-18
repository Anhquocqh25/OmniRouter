import { describe, expect, it } from "vitest";
import { initDatabase } from "../src/db/index.js";
import { CredentialsService } from "../src/services/credentials.service.js";

describe("CredentialsService", () => {
  it("stores encrypted credentials and retrieves decrypted plaintext", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new CredentialsService(db, "test-master-secret");

      service.setCredential("openai", "sk-proj-openai-secret-key-123");
      service.setCredential("anthropic", "sk-ant-claude-key-456");

      const openaiKey = service.getCredential("openai");
      const anthropicKey = service.getCredential("anthropic");

      expect(openaiKey).toBe("sk-proj-openai-secret-key-123");
      expect(anthropicKey).toBe("sk-ant-claude-key-456");

      const nonExistent = service.getCredential("gemini");
      expect(nonExistent).toBeNull();
    } finally {
      close();
    }
  });

  it("updates existing credentials and supports deletion", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const service = new CredentialsService(db, "test-master-secret");

      service.setCredential("openai", "key-v1");
      expect(service.getCredential("openai")).toBe("key-v1");

      service.setCredential("openai", "key-v2");
      expect(service.getCredential("openai")).toBe("key-v2");

      const deleted = service.deleteCredential("openai");
      expect(deleted).toBe(true);
      expect(service.getCredential("openai")).toBeNull();
    } finally {
      close();
    }
  });
});
