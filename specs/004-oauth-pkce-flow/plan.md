# Implementation Plan: Authorized OAuth 2.0 PKCE Flow and Token Refresh

**Feature ID:** 004-oauth-pkce-flow  
**Status:** In Progress  

## 1. Architecture & Flow Diagram

```
+-------------------------------------------------------------+
|              User Browser / Desktop Interface               |
+------------------------------+------------------------------+
                               | 1. GET /v1/oauth/:provider/authorize
                               v
+-------------------------------------------------------------+
|                    Fastify OmniRouter                       |
|                                                             |
|  [PKCE Engine] -> Generates code_verifier & code_challenge  |
|  [Session Store] -> Saves state & verifier in SQLite        |
|  Returns Authorization URL to Browser                       |
+------------------------------+------------------------------+
                               | 2. Redirects to Provider
                               v
+-------------------------------------------------------------+
|               Provider Consent Screen (Official)            |
+------------------------------+------------------------------+
                               | 3. Redirects to Loopback URL
                               |    GET /oauth/callback?code=...&state=...
                               v
+-------------------------------------------------------------+
|              Loopback Handler (/oauth/callback)             |
|                                                             |
|  - Validates anti-CSRF state in SQLite                      |
|  - Sends code + code_verifier to provider token endpoint    |
|  - Encrypts access_token & refresh_token (AES-256-GCM)       |
|  - Stores in SQLite table `oauth_tokens`                    |
|  - Displays success HTML page in browser                    |
+------------------------------+------------------------------+
                               |
                               | 4. Next API call
                               v
+-------------------------------------------------------------+
|                 Provider Adapter Execution                  |
|  - Checks token expiry -> Automatic refresh if needed       |
|  - Attaches `Authorization: Bearer <valid_oauth_token>`     |
+-------------------------------------------------------------+
```

## 2. SQLite Tables for OAuth

### `oauth_sessions`
- `state`: text().primaryKey()
- `providerId`: text("provider_id").notNull()
- `codeVerifier`: text("code_verifier").notNull()
- `redirectUri`: text("redirect_uri").notNull()
- `expiresAt`: integer("expires_at").notNull()

### `oauth_tokens`
- `providerId`: text("provider_id").primaryKey()
- `encryptedAccessToken`: text("encrypted_access_token").notNull()
- `encryptedRefreshToken`: text("encrypted_refresh_token")
- `tokenType`: text("token_type").notNull().default("Bearer")
- `scope`: text("scope")
- `expiresAt`: integer("expires_at").notNull()
- `updatedAt`: integer("updated_at").notNull()

## 3. Directory Layout
```
src/
├── oauth/
│   ├── pkce.ts          # RFC 7636 verifier & challenge generator
│   ├── providers.ts     # Official provider OAuth endpoint definitions
│   └── manager.ts       # OAuthManager (initiate, exchange, refresh, encrypt)
└── routes/
    └── oauth.ts         # /v1/oauth/* and loopback /oauth/callback
```

## 4. Verification Strategy
- `tests/pkce.test.ts`: RFC 7636 compliance, SHA-256 base64url challenge tests.
- `tests/oauth.manager.test.ts`: Exchange, encrypted token storage, expiry detection, and refresh flow.
- `tests/oauth.integration.test.ts`: End-to-end loopback callback, HTML rendering, and adapter token usage.
- Strict typecheck with `npm run typecheck`.
