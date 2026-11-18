import crypto from "node:crypto";

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/**
 * Encodes a buffer to unpadded Base64URL format (RFC 7636).
 */
export function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates an RFC 7636 compliant code_verifier.
 * Uses 32 random bytes, resulting in a 43-character base64url string.
 */
export function generateCodeVerifier(length = 32): string {
  const bytes = crypto.randomBytes(length);
  return base64UrlEncode(bytes);
}

/**
 * Derives an RFC 7636 code_challenge from a code_verifier using SHA-256 (S256).
 */
export function deriveCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier, "ascii").digest();
  return base64UrlEncode(hash);
}

/**
 * Generates a complete PKCE pair: verifier and challenge.
 */
export function generatePKCE(): PKCEPair {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

/**
 * Generates an anti-CSRF state token.
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}
