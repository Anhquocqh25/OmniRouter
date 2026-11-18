import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, generateApiKey, hashToken } from "../src/db/crypto.js";

describe("AES-256-GCM Encryption Engine", () => {
  const masterKey = deriveKey("omnirouter-super-secret-master-key-2026");

  it("encrypts and decrypts a secret API key correctly", () => {
    const rawKey = "sk-ant-api03-abcdef1234567890-test";
    const encrypted = encrypt(rawKey, masterKey);

    expect(encrypted).not.toBe(rawKey);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decrypt(encrypted, masterKey);
    expect(decrypted).toBe(rawKey);
  });

  it("produces different ciphertexts for the same plaintext due to random IVs", () => {
    const raw = "sk-openai-consistent-string";
    const enc1 = encrypt(raw, masterKey);
    const enc2 = encrypt(raw, masterKey);

    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1, masterKey)).toBe(raw);
    expect(decrypt(enc2, masterKey)).toBe(raw);
  });

  it("fails decryption when authentication tag or ciphertext is tampered with", () => {
    const raw = "sk-tamper-target";
    const encrypted = encrypt(raw, masterKey);
    const parts = encrypted.split(":");

    // Tamper with the ciphertext (parts[2])
    const tamperedCiphertext = parts[2]!.substring(0, parts[2]!.length - 2) + "00";
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

    expect(() => decrypt(tamperedPayload, masterKey)).toThrow();
  });

  it("fails decryption with wrong encryption key", () => {
    const raw = "sk-wrong-key-target";
    const encrypted = encrypt(raw, masterKey);
    const wrongKey = deriveKey("completely-different-password");

    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("generates and hashes gateway API keys properly", () => {
    const { token, hash } = generateApiKey();
    expect(token).toMatch(/^omni-live-[a-f0-9]{48}$/);
    expect(hash).toBe(hashToken(token));
  });
});
