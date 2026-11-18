# Feature Specification: Authorized OAuth 2.0 PKCE Flow and Token Refresh

**Feature ID:** 004-oauth-pkce-flow  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Objectives
Milestone 4 introduces official OAuth 2.0 with PKCE (Proof Key for Code Exchange, RFC 7636) for providers that officially support OAuth-based API access.
Key capabilities:
1. **RFC 7636 PKCE Engine**: Generation of high-entropy `code_verifier` and SHA-256 `code_challenge` (`S256`).
2. **Local Loopback Callback Handler**: Dedicated loopback callback at `/oauth/callback` to safely receive authorization codes and exchange them without third-party redirection servers.
3. **Encrypted Token Vault**: `access_token` and `refresh_token` stored encrypted at rest using AES-256-GCM in SQLite table `oauth_tokens`.
4. **Transparent Token Refresh**: Automatic renewal of expired or expiring access tokens before dispatching API calls to upstream providers.
5. **Provider Integration**: OpenAI, Anthropic, or Gemini adapters seamlessly use valid OAuth bearer tokens when configured for OAuth.

## 2. Requirements & User Stories

### User Story 1 (US1): Initiate PKCE Authorization (P1)
- As a user, I can initiate OAuth authorization for a supported provider via `GET /v1/oauth/:provider/authorize`.
- The gateway generates a secure `code_verifier`, derives the `code_challenge`, creates an anti-CSRF `state`, persists the session, and returns the authorization URL.

### User Story 2 (US2): Loopback Code Exchange (P1)
- As a browser completing the provider consent screen, I am redirected to `http://127.0.0.1:<port>/oauth/callback?code=...&state=...`.
- The gateway verifies the `state` against active sessions, performs the token exchange with the provider using the matching `code_verifier`, encrypts the tokens, and saves them to SQLite.
- Responds with a user-friendly HTML confirmation page.

### User Story 3 (US3): Automatic Token Refresh (P1)
- When a provider adapter requests an access token, `OAuthManager` checks its expiration.
- If the token is expired or expires within 60 seconds, it uses the encrypted `refresh_token` to obtain a new `access_token` and updates SQLite.
- If refresh fails or no refresh token exists, marks provider disconnected and throws a structured error.

### User Story 4 (US4): OAuth Status & Disconnect (P2)
- As a user, I can check OAuth connection status via `GET /v1/oauth/status` and disconnect via `POST /v1/oauth/:provider/disconnect`.

## 3. Compliance & Security Rules
- Only official OAuth endpoints and documented PKCE flows.
- Never log authorization codes, verifiers, or access/refresh tokens.
- Stored tokens encrypted with AES-256-GCM.
- Anti-CSRF state verification with expiration (10 minutes).
