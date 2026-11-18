import { eq } from "drizzle-orm";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema.js";
import { decrypt, deriveKey, encrypt } from "../db/crypto.js";
import { generatePKCE, generateState } from "./pkce.js";
import { getOAuthProviderConfig } from "./providers.js";
import { AuthenticationError, UpstreamError } from "../utils/errors.js";

export interface OAuthManagerOptions {
  encryptionSecret?: string;
  fetchFn?: typeof fetch;
}

export class OAuthManager {
  private db: BetterSQLite3Database<typeof schema>;
  private masterKey: Buffer;
  private fetchFn: typeof fetch;

  constructor(db: BetterSQLite3Database<typeof schema>, options: OAuthManagerOptions = {}) {
    this.db = db;
    this.masterKey = deriveKey(options.encryptionSecret || "omnirouter-default-secret-key");
    this.fetchFn = options.fetchFn || fetch;
  }

  createAuthorizationSession(
    providerId: string,
    redirectUri: string,
    options: { clientId?: string; scopes?: string[] } = {}
  ): { authUrl: string; state: string } {
    const config = getOAuthProviderConfig(providerId);
    if (!config) {
      throw new AuthenticationError(`Unsupported OAuth provider: ${providerId}`);
    }

    const clientId = options.clientId || process.env[config.clientIdEnvVar];
    if (!clientId) {
      throw new AuthenticationError(
        `OAuth Client ID not configured for ${config.name}. Please set ${config.clientIdEnvVar}.`
      );
    }

    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePKCE();
    const state = generateState();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes session

    // Save session in database
    this.db
      .insert(schema.oauthSessions)
      .values({
        state,
        providerId: config.id,
        codeVerifier,
        redirectUri,
        expiresAt,
      })
      .run();

    const scopes = options.scopes || config.defaultScopes;
    const url = new URL(config.authUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", codeChallengeMethod);

    return {
      authUrl: url.toString(),
      state,
    };
  }

  async exchangeCodeForTokens(state: string, code: string): Promise<{ providerId: string; scope?: string }> {
    const session = this.db
      .select()
      .from(schema.oauthSessions)
      .where(eq(schema.oauthSessions.state, state))
      .get();

    if (!session || session.expiresAt < Date.now()) {
      throw new AuthenticationError("Invalid, expired, or already used OAuth state.");
    }

    // Clean up one-time session
    this.db.delete(schema.oauthSessions).where(eq(schema.oauthSessions.state, state)).run();

    const config = getOAuthProviderConfig(session.providerId);
    if (!config) {
      throw new AuthenticationError(`Provider config not found for ${session.providerId}`);
    }

    const clientId = process.env[config.clientIdEnvVar];
    const clientSecret = config.clientSecretEnvVar ? process.env[config.clientSecretEnvVar] : undefined;

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: session.redirectUri,
      code_verifier: session.codeVerifier,
    });

    if (clientId) tokenParams.set("client_id", clientId);
    if (clientSecret) tokenParams.set("client_secret", clientSecret);

    let res: Response;
    try {
      res = await this.fetchFn(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenParams.toString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      throw new UpstreamError(`Failed to exchange OAuth code: ${msg}`, 502);
    }

    if (!res.ok) {
      let errorDetail = `OAuth token endpoint returned HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error_description?: string; error?: string };
        if (body.error_description || body.error) {
          errorDetail = body.error_description || body.error || errorDetail;
        }
      } catch {
        // Fallback
      }
      throw new UpstreamError(errorDetail, res.status);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    if (!data.access_token) {
      throw new UpstreamError("No access_token returned by OAuth provider.", 502);
    }

    const now = Date.now();
    const expiresInSec = data.expires_in || 3600;
    const expiresAt = now + expiresInSec * 1000;

    const encryptedAccessToken = encrypt(data.access_token, this.masterKey);
    const encryptedRefreshToken = data.refresh_token ? encrypt(data.refresh_token, this.masterKey) : null;

    this.db
      .insert(schema.oauthTokens)
      .values({
        providerId: config.id,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenType: data.token_type || "Bearer",
        scope: data.scope || null,
        expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.oauthTokens.providerId,
        set: {
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenType: data.token_type || "Bearer",
          scope: data.scope || null,
          expiresAt,
          updatedAt: now,
        },
      })
      .run();

    return {
      providerId: config.id,
      scope: data.scope,
    };
  }

  async getValidAccessToken(providerId: string): Promise<string | null> {
    const row = this.db
      .select()
      .from(schema.oauthTokens)
      .where(eq(schema.oauthTokens.providerId, providerId.toLowerCase()))
      .get();

    if (!row) {
      return null;
    }

    const now = Date.now();
    const needsRefresh = now >= row.expiresAt - 60_000; // Within 60s of expiration

    if (!needsRefresh) {
      return decrypt(row.encryptedAccessToken, this.masterKey);
    }

    // Refresh token needed
    if (!row.encryptedRefreshToken) {
      return null; // Expired with no refresh token
    }

    const refreshToken = decrypt(row.encryptedRefreshToken, this.masterKey);
    const config = getOAuthProviderConfig(providerId);
    if (!config) return null;

    const clientId = process.env[config.clientIdEnvVar];
    const clientSecret = config.clientSecretEnvVar ? process.env[config.clientSecretEnvVar] : undefined;

    const refreshParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    if (clientId) refreshParams.set("client_id", clientId);
    if (clientSecret) refreshParams.set("client_secret", clientSecret);

    try {
      const res = await this.fetchFn(config.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: refreshParams.toString(),
      });

      if (!res.ok) {
        return null; // Refresh failed
      }

      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      if (!data.access_token) return null;

      const newExpiresAt = now + (data.expires_in || 3600) * 1000;
      const newEncryptedAccess = encrypt(data.access_token, this.masterKey);
      const newEncryptedRefresh = data.refresh_token
        ? encrypt(data.refresh_token, this.masterKey)
        : row.encryptedRefreshToken;

      this.db
        .update(schema.oauthTokens)
        .set({
          encryptedAccessToken: newEncryptedAccess,
          encryptedRefreshToken: newEncryptedRefresh,
          expiresAt: newExpiresAt,
          updatedAt: now,
        })
        .where(eq(schema.oauthTokens.providerId, providerId.toLowerCase()))
        .run();

      return data.access_token;
    } catch {
      return null;
    }
  }

  getStatus(): Record<string, { connected: boolean; expiresAt?: number; scope?: string | null }> {
    const rows = this.db.select().from(schema.oauthTokens).all();
    const result: Record<string, { connected: boolean; expiresAt?: number; scope?: string | null }> = {};

    for (const row of rows) {
      const isExpired = Date.now() >= row.expiresAt;
      result[row.providerId] = {
        connected: !isExpired || Boolean(row.encryptedRefreshToken),
        expiresAt: row.expiresAt,
        scope: row.scope,
      };
    }

    return result;
  }

  disconnect(providerId: string): boolean {
    const res = this.db
      .delete(schema.oauthTokens)
      .where(eq(schema.oauthTokens.providerId, providerId.toLowerCase()))
      .run();
    return res.changes > 0;
  }
}
