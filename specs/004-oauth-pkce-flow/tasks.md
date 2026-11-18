# Tasks: Authorized OAuth 2.0 PKCE Flow and Token Refresh

**Feature:** 004-oauth-pkce-flow  
**Status:** Completed  

## Phase 1: PKCE & Provider Configurations
- [x] T001 Implement RFC 7636 PKCE utilities in `src/oauth/pkce.ts`
- [x] T002 Define official OAuth configurations in `src/oauth/providers.ts`
- [x] T003 Write unit tests for PKCE generation and challenge derivation in `tests/pkce.test.ts`

## Phase 2: Schema & OAuth Manager
- [x] T004 Add `oauth_sessions` and `oauth_tokens` tables to `src/db/schema.ts` and `src/db/index.ts`
- [x] T005 Implement `OAuthManager` with encrypted persistence and automatic token refresh in `src/oauth/manager.ts`
- [x] T006 Write unit tests for OAuthManager in `tests/oauth.manager.test.ts`

## Phase 3: Loopback Server & Routes
- [x] T007 Implement `/v1/oauth/:provider/authorize`, `/oauth/callback`, `/v1/oauth/status`, `/v1/oauth/:provider/disconnect` in `src/routes/oauth.ts`
- [x] T008 Wire OAuthManager into `src/app.ts` and provider adapters
- [x] T009 Write end-to-end integration tests in `tests/oauth.integration.test.ts`

## Phase 4: Verification & Quality Gate
- [x] T010 Run `npm.cmd run typecheck`
- [x] T011 Run `npm.cmd test` and ensure all test suites pass
