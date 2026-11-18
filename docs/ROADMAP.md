# OmniRouter Project Roadmap

This roadmap defines the iterative milestones for OmniRouter, transitioning from a core gateway foundation to a fully featured local AI gateway dashboard for Windows.

---

## Milestone 1: Core Gateway & Provider Registry (Completed)
- [x] Spec Kit SDD integration and Constitution definition.
- [x] Architectural design and technical specifications (`docs/ARCHITECTURE.md`, `docs/ROADMAP.md`).
- [x] TypeScript and Fastify server scaffolding.
- [x] `ProviderAdapter` interface definition and `OpenAIProviderAdapter` implementation.
- [x] Centralized `ProviderRegistry` with model-to-provider routing.
- [x] Local gateway authentication middleware with zero credential leakage.
- [x] Standard `/v1/models` and `/v1/chat/completions` (streaming + non-streaming) endpoints.
- [x] Unit and integration test suite with Vitest (21 tests).

---

## Milestone 2: Multi-Provider Expansion & Intelligent Routing (Completed)
- [x] **Anthropic Adapter:** Support for Claude 3.5 Sonnet / Haiku / Opus via Messages API conversion (`src/providers/anthropic.adapter.ts`).
- [x] **Google Gemini Adapter:** Support for Gemini 1.5 Pro / Flash, Gemini 2.0 via REST & SSE conversion (`src/providers/gemini.adapter.ts`).
- [x] **Ollama / Local LLM Adapter:** Local offline models (Llama 3, Qwen 2.5, Mistral, DeepSeek) with dynamic model tag discovery (`src/providers/ollama.adapter.ts`).
- [x] **Intelligent Routing & Failover:** Automatic fallback chains when upstream encounters 429 rate limits, timeouts, or 5xx outages (`src/providers/registry.ts`, `src/routes/chat.ts`).
- [x] **Multi-Provider Test Suite:** 35 unit and integration tests passing (`tests/`).

---

## Milestone 3: Encrypted Persistence & Local Storage (Drizzle ORM) (Completed)
- [x] **SQLite & Drizzle ORM:** Local storage with `better-sqlite3` and schema (`gateway_api_keys`, `provider_credentials`, `usage_logs`).
- [x] **AES-256-GCM Encryption:** Secure storage of provider secrets with random IV and authentication tag (`src/db/crypto.ts`, `src/services/credentials.service.ts`).
- [x] **Multi-Key Management:** Create, revoke, verify, and update `last_used_at` on gateway keys (`src/services/keys.service.ts`).
- [x] **Usage & Token Tracking:** Captures prompt/completion tokens, latency (ms), HTTP status codes, and aggregate analytics (`src/services/usage.service.ts`).
- [x] **Admin & Metrics Endpoints:** `/v1/admin/metrics`, `/v1/admin/logs`, `/v1/admin/keys`, `/v1/admin/credentials` (`src/routes/admin.ts`).
- [x] **Comprehensive Test Suite:** 47 tests passing across 13 test files.

---

## Milestone 4: Authorized OAuth 2.0 PKCE Flow (Completed)
- [x] **RFC 7636 PKCE Engine:** Cryptographically secure `code_verifier`, SHA-256 `code_challenge` (`S256`), and anti-CSRF `state` (`src/oauth/pkce.ts`).
- [x] **Local Loopback Callback:** `/oauth/callback` loopback listener with branded confirmation HTML response (`src/routes/oauth.ts`).
- [x] **Encrypted OAuth Vault:** Stored `oauth_sessions` and `oauth_tokens` with AES-256-GCM encrypted access and refresh tokens (`src/oauth/manager.ts`).
- [x] **Automatic Token Refresh:** Background token renewal when near expiration (threshold: 60s) before executing requests.
- [x] **Adapter Token Integration:** Provider adapters seamlessly retrieve active OAuth bearer tokens when API keys are absent.
- [x] **OAuth Test Suite:** 55 tests passing across 16 test files.

---

## Milestone 5: Local Web Dashboard (React + Vite + shadcn/ui) (Completed)
- [x] **Single-Port Embedded Hosting:** Fastify automatically hosts the compiled React dashboard at `http://127.0.0.1:3000/` via `@fastify/static`.
- [x] **Live Analytics Dashboard:** Real-time KPI cards for total requests, token spend (in/out), average latency, and recent transaction log (`OverviewTab.tsx`).
- [x] **Model Playground:** Interactive prompt testing across all configured models (GPT-4o, Claude 3.5, Gemini, Ollama) with temperature and system prompt tuning (`PlaygroundTab.tsx`).
- [x] **Visual Gateway Key Management:** Create `omni-live-...` keys, copy once, view status, and revoke/delete keys with one click (`KeysTab.tsx`).
- [x] **Provider & OAuth Connections UI:** Card-based status for OpenAI, Anthropic, Gemini, and Ollama with one-click OAuth connect and key storage (`ProvidersTab.tsx`).
- [x] **Full Test Suite:** 57 tests passing across 17 test files.

---

## Milestone 6: Windows Desktop Packaging & Tray Integration (Completed)
- [x] **Windows Background Daemon:** `scripts/daemon.ps1` with start, stop, status, restart, and PID lifecycle management (`.omnirouter.pid`).
- [x] **Windows System Tray Applet:** `scripts/tray.ps1` native NotifyIcon applet with right-click menu (Dashboard, Models, Health check, Start/Stop/Restart, Exit).
- [x] **Windows Native Toast Notifications:** `scripts/notify.ps1` and `src/utils/notifications.ts` for native Windows WinRT and balloon tip alerts on server events.
- [x] **Windows Auto-Start on Login:** One-command Windows registry integration via `scripts/daemon.ps1 autostart enable|disable` (`HKCU:\...\Run`).
- [x] **One-Click Windows Launcher:** `omnirouter.cmd` root batch launcher for seamless double-click or CLI execution.
- [x] **NPM Gateway Scripts:** Added `gateway:start`, `gateway:stop`, `gateway:status`, `gateway:restart`, `gateway:tray`, `gateway:autostart`.
- [x] **Complete Test Suite:** 64 tests passing across 18 test files.
