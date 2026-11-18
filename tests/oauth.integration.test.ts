import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { initDatabase } from "../src/db/index.js";
import { OAuthManager } from "../src/oauth/manager.js";
import { OpenAIProviderAdapter } from "../src/providers/openai.adapter.js";
import { ProviderRegistry } from "../src/providers/registry.js";

describe("OAuth 2.0 PKCE End-to-End Integration", () => {
  it("completes full PKCE loopback flow, renders HTML, and uses OAuth token in adapter", async () => {
    const dbConn = initDatabase(":memory:");

    let capturedTokenRequest: string | undefined;
    let capturedApiBearer: string | undefined;

    const mockFetch: typeof fetch = async (url, init) => {
      const urlStr = url.toString();

      // Mock Token Exchange Endpoint
      if (urlStr.includes("/oauth/token")) {
        capturedTokenRequest = init?.body as string;
        return new Response(
          JSON.stringify({
            access_token: "live-oauth-access-token-999",
            refresh_token: "live-oauth-refresh-token-888",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "openid model.request",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Mock Upstream Chat Completions Endpoint
      if (urlStr.includes("/chat/completions")) {
        const headers = init?.headers as Record<string, string>;
        capturedApiBearer = headers["Authorization"];
        return new Response(
          JSON.stringify({
            id: "chatcmpl-oauth-success",
            object: "chat.completion",
            created: Date.now(),
            model: "gpt-4o",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "Authenticated via OAuth 2.0 PKCE!" },
                finish_reason: "stop",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unhandled URL in test mock: ${urlStr}`);
    };

    const oauthManager = new OAuthManager(dbConn.db, { fetchFn: mockFetch });

    const openAIAdapter = new OpenAIProviderAdapter({
      fetchFn: mockFetch,
      tokenProvider: () => oauthManager.getValidAccessToken("openai"),
    });

    const registry = new ProviderRegistry();
    registry.register(openAIAdapter);

    const app = buildApp({
      config: { NODE_ENV: "test" },
      dbConnection: dbConn,
      oauthManager,
      registry,
    });

    // 1. Initiate OAuth Flow
    const authRes = await app.inject({
      method: "GET",
      url: "/v1/oauth/openai/authorize?clientId=my-client-app",
    });

    expect(authRes.statusCode).toBe(200);
    const { authUrl, state } = JSON.parse(authRes.body);
    expect(authUrl).toContain("response_type=code");
    expect(authUrl).toContain("code_challenge_method=S256");

    // 2. Loopback callback simulation
    const callbackRes = await app.inject({
      method: "GET",
      url: `/oauth/callback?code=mock-auth-code-777&state=${state}`,
    });

    expect(callbackRes.statusCode).toBe(200);
    expect(callbackRes.headers["content-type"]).toContain("text/html");
    expect(callbackRes.body).toContain("Authorization Successful!");
    expect(capturedTokenRequest).toContain("code=mock-auth-code-777");
    expect(capturedTokenRequest).toContain("code_verifier=");

    // 3. Verify status endpoint
    const statusRes = await app.inject({
      method: "GET",
      url: "/v1/oauth/status",
    });
    const statusBody = JSON.parse(statusRes.body);
    expect(statusBody.status.openai.connected).toBe(true);

    // 4. Send Chat Completion - adapter should automatically use the OAuth access token
    const chatRes = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi OAuth" }],
      }),
    });

    expect(chatRes.statusCode).toBe(200);
    const chatBody = JSON.parse(chatRes.body);
    expect(chatBody.choices[0]?.message.content).toBe("Authenticated via OAuth 2.0 PKCE!");
    expect(capturedApiBearer).toBe("Bearer live-oauth-access-token-999");

    // 5. Disconnect provider
    const disconnectRes = await app.inject({
      method: "POST",
      url: "/v1/oauth/openai/disconnect",
    });
    expect(disconnectRes.statusCode).toBe(200);
    expect(await oauthManager.getValidAccessToken("openai")).toBeNull();
  });

  it("handles OAuth callback denial / error gracefully with friendly HTML", async () => {
    const dbConn = initDatabase(":memory:");
    const app = buildApp({
      config: { NODE_ENV: "test" },
      dbConnection: dbConn,
    });

    const errorCallback = await app.inject({
      method: "GET",
      url: "/oauth/callback?error=access_denied&error_description=User%20declined%20consent",
    });

    expect(errorCallback.statusCode).toBe(400);
    expect(errorCallback.headers["content-type"]).toContain("text/html");
    expect(errorCallback.body).toContain("Authorization Failed");
    expect(errorCallback.body).toContain("User declined consent");
  });
});
