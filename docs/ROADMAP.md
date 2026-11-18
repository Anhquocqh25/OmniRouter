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

## Milestone 3: Encrypted Persistence & Local Storage (Drizzle ORM) (Next)
- [ ] SQLite database integration via `better-sqlite3` and Drizzle ORM.
- [ ] Encrypted credential storage at rest (`AES-256-GCM`).
- [ ] Multi-key management: Create, revoke, and set rate limits on local client API keys.
- [ ] Usage tracking: Store per-request tokens (prompt, completion), response latency, and error counts.

---

## Milestone 4: Authorized OAuth 2.0 PKCE Flow
- [ ] Dedicated local loopback callback server for OAuth authorization.
- [ ] PKCE verification (`code_verifier` / `code_challenge`).
- [ ] Official provider OAuth integrations (strictly where API access is authorized by the provider).
- [ ] Automatic token refresh management in background tasks.

---

## Milestone 5: Local Web Dashboard (React + Vite + shadcn/ui)
- [ ] Embedded Fastify static file serving or standalone desktop dev server.
- [ ] Model playground: Test prompts against any configured provider.
- [ ] Live analytics dashboard: Real-time charts for requests/sec, token spend, and latency percentiles.
- [ ] Visual Key Management & Provider Configuration UI.
- [ ] Health status and connection check for all upstream providers.

---

## Milestone 6: Windows Desktop Packaging & Tray Integration
- [ ] Background daemon / Windows Service or System Tray indicator.
- [ ] One-click start/stop and auto-launch on Windows startup.
- [ ] Native notifications for quota warnings or upstream outages.
