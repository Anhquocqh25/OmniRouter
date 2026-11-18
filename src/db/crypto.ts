import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a 32-byte key from any string using SHA-256.
 */
export function deriveKey(masterSecret: string): Buffer {
  return crypto.createHash("sha256").update(masterSecret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns formatted string: `${ivHex}:${authTagHex}:${ciphertextHex}`
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Throws an error if authentication tag does not match or data is corrupted.
 */
export function decrypt(encryptedPayload: string, key: Buffer): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted payload components.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a secure random API key token (e.g. omni-live-...)
 */
export function generateApiKey(prefix = "omni-live"): { token: string; hash: string } {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const token = `${prefix}-${randomBytes}`;
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Computes SHA-256 hash of a token for secure database lookup.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
