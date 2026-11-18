import { describe, expect, it } from "vitest";
import { deriveCodeChallenge, generateCodeVerifier, generatePKCE, generateState } from "../src/oauth/pkce.js";

describe("RFC 7636 PKCE Implementation", () => {
  it("matches RFC 7636 Appendix B test vector exactly", () => {
    // Exact test vector from RFC 7636 Appendix B
    const rfcVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    const computedChallenge = deriveCodeChallenge(rfcVerifier);
    expect(computedChallenge).toBe(expectedChallenge);
  });

  it("generates valid random PKCE pairs", () => {
    const pkce = generatePKCE();

    expect(pkce.codeChallengeMethod).toBe("S256");
    expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.codeVerifier.length).toBeLessThanOrEqual(128);
    expect(pkce.codeChallenge.length).toBeGreaterThan(0);
    // Base64URL characters only
    expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates secure random state tokens", () => {
    const s1 = generateState();
    const s2 = generateState();

    expect(s1).not.toBe(s2);
    expect(s1).toHaveLength(32); // 16 bytes in hex = 32 chars
  });
});
