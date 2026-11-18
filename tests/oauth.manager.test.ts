import { describe, expect, it } from "vitest";
import { initDatabase } from "../src/db/index.js";
import { OAuthManager } from "../src/oauth/manager.js";

describe("OAuthManager with PKCE & Token Refresh", () => {
  it("creates PKCE authorization session and builds valid auth URL", () => {
    const { db, close } = initDatabase(":memory:");
    try {
      const manager = new OAuthManager(db);

      const { authUrl, state } = manager.createAuthorizationSession("openai", "http://127.0.0.1:3000/oauth/callback", {
        clientId: "test-client-id",
      });

      expect(state).toHaveLength(32);
      const url = new URL(authUrl);
      expect(url.origin).toBe("https://auth.openai.com");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("code_challenge")).toBeDefined();
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("state")).toBe(state);
    } finally {
      close();
    }
  });

  it("exchanges code for tokens, encrypts them, and retrieves valid access token", async () => {
    const { db, close } = initDatabase(":memory:");
    try {
      let capturedBody: string | undefined;

      const mockFetch: typeof fetch = async (url, init) => {
        expect(url.toString()).toContain("/oauth/token");
        capturedBody = init?.body as string;

        return new Response(
          JSON.stringify({
            access_token: "mock-oauth-access-token-xyz",
            refresh_token: "mock-oauth-refresh-token-abc",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "openid model.request",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const manager = new OAuthManager(db, { fetchFn: mockFetch });

      // 1. Initiate session
      const { state } = manager.createAuthorizationSession("openai", "http://127.0.0.1:3000/oauth/callback", {
        clientId: "test-client-id",
      });

      // 2. Exchange code
      const result = await manager.exchangeCodeForTokens(state, "auth-code-123");
      expect(result.providerId).toBe("openai");
      expect(capturedBody).toContain("grant_type=authorization_code");
      expect(capturedBody).toContain("code=auth-code-123");
      expect(capturedBody).toContain("code_verifier=");

      // 3. Retrieve valid access token
      const token = await manager.getValidAccessToken("openai");
      expect(token).toBe("mock-oauth-access-token-xyz");

      // 4. Check status
      const status = manager.getStatus();
      expect(status["openai"]?.connected).toBe(true);

      // 5. Disconnect
      manager.disconnect("openai");
      expect(await manager.getValidAccessToken("openai")).toBeNull();
    } finally {
      close();
    }
  });

  it("refreshes expiring tokens automatically", async () => {
    const { db, close } = initDatabase(":memory:");
    try {
      let refreshCalled = false;

      const mockFetch: typeof fetch = async (url, init) => {
        const bodyStr = init?.body as string;

        if (bodyStr.includes("grant_type=authorization_code")) {
          return new Response(
            JSON.stringify({
              access_token: "initial-token",
              refresh_token: "refresh-token-123",
              expires_in: 10, // Expires in 10s (triggers immediate refresh threshold of 60s)
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (bodyStr.includes("grant_type=refresh_token")) {
          refreshCalled = true;
          return new Response(
            JSON.stringify({
              access_token: "brand-new-refreshed-token",
              refresh_token: "new-refresh-token",
              expires_in: 3600,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        throw new Error("Unexpected request");
      };

      const manager = new OAuthManager(db, { fetchFn: mockFetch });

      const { state } = manager.createAuthorizationSession("openai", "http://127.0.0.1:3000/oauth/callback", {
        clientId: "test-client-id",
      });

      await manager.exchangeCodeForTokens(state, "auth-code-123");

      // Because expires_in was 10s (< 60s), getValidAccessToken must trigger refresh!
      const activeToken = await manager.getValidAccessToken("openai");
      expect(refreshCalled).toBe(true);
      expect(activeToken).toBe("brand-new-refreshed-token");
    } finally {
      close();
    }
  });
});
