# Feature Specification: Local Web Dashboard with React, Vite, and Tailwind

**Feature ID:** 005-web-dashboard  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Objectives
Milestone 5 provides a local web dashboard for OmniRouter, allowing users to interact with and manage the gateway without external tools:
1. **Live Analytics & Metrics**: Real-time charts and KPI cards for requests count, tokens used, average latency, and provider/model distributions.
2. **Interactive Model Playground**: Direct chat completion prompt testing with model switching, system prompt tuning, temperature control, and response rendering.
3. **Visual Gateway Key Management**: Create, copy, and revoke `omni-live-...` keys.
4. **Provider Connection Manager**: Visual status badges for OpenAI, Anthropic, Gemini, Ollama, and one-click OAuth connect/disconnect buttons.
5. **Zero-Setup Embedded Serving**: Fastify automatically serves the dashboard statically on the loopback gateway port (`http://127.0.0.1:3000`).

## 2. Requirements & User Stories

### User Story 1 (US1): Live Overview & Analytics (P1)
- As a user, when I open `http://127.0.0.1:3000/`, I see summary metrics:
  - Total requests, total tokens, average latency (ms), and error count.
  - Per-provider and per-model consumption bars.
  - Recent requests log with timestamps and status codes.

### User Story 2 (US2): Model Playground (P1)
- As a developer, I can select any configured model (e.g. `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`, `llama3`).
- Send messages and see responses in real time.
- Inspect prompt tokens and completion tokens returned by the gateway.

### User Story 3 (US3): Visual Key & Provider Management (P1)
- As an administrator, I can generate new client API keys (`omni-live-...`) with a name label.
- View and revoke keys with a single click.
- See connection status for each provider (Active, Offline, OAuth Connected).

## 3. Technology Stack & Verification
- React 18, Vite 6, TypeScript, Lucide Icons, clean modern responsive dark UI.
- Embedded via `@fastify/static`.
- Verified with unit tests and end-to-end dashboard asset serving verification.
