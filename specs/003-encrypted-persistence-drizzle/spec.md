# Feature Specification: Encrypted Persistence and Usage Tracking with SQLite and Drizzle

**Feature ID:** 003-encrypted-persistence-drizzle  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Objectives
Milestone 3 equips OmniRouter with local-first persistent data storage using SQLite (`better-sqlite3`) and Drizzle ORM.
Key capabilities include:
1. **AES-256-GCM Encrypted Storage**: Provider API keys (OpenAI, Anthropic, Gemini) are encrypted at rest with authentication tags to prevent plaintext leakage on disk.
2. **Local Gateway API Key Management**: Support multiple client keys (`omni-live-...`), with metadata (name, status: active/revoked, rate limits, last used timestamp).
3. **Per-Request Usage & Token Metrics Tracking**: Automatically captures model, provider, prompt/completion tokens, latency (ms), and HTTP status codes for every `/v1/chat/completions` transaction.
4. **Analytics & Metrics Service**: Programmatic queries for aggregate usage, error counts, and per-model consumption.

## 2. Requirements & User Stories

### User Story 1 (US1): Encrypted Provider Credentials (P1)
- As an administrator, I can store and retrieve provider credentials (OpenAI, Anthropic, Gemini) encrypted at rest using AES-256-GCM.
- Plaintext keys must never be saved in the database.
- Upstream adapters can load their credentials dynamically from the database or fall back to environment variables.

### User Story 2 (US2): Multi-Key Gateway Authentication (P1)
- As an administrator, I can issue multiple local Gateway API Keys with human-readable labels.
- The authentication middleware verifies the incoming key against the database (`active: true`).
- Revoked keys are immediately rejected with HTTP 401 (`invalid_api_key`).
- Updates `last_used_at` timestamp upon successful authorization.

### User Story 3 (US3): Detailed Usage & Token Logging (P1)
- When any completion request completes (streaming or non-streaming), OmniRouter writes a record to `usage_logs`:
  - `gateway_key_id`, `provider`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`, `status_code`, `error_type`, `created_at`.
- Failed requests log the appropriate status code (e.g. 429, 502) and error description without logging sensitive user prompt data or keys.

### User Story 4 (US4): Usage Metrics & Reporting (P2)
- Expose service methods to retrieve aggregated analytics:
  - Total requests, total tokens consumed.
  - Per-model and per-provider usage breakdowns.
  - Recent request history for administrative inspection.

## 3. Non-Functional Requirements & Security
- Database stored in local file (`data/omnirouter.db`) or in-memory for tests (`:memory:`).
- Master encryption key derived from `ENCRYPTION_KEY` environment variable or persistent local machine secret.
- Zero key leakage in log files or debug payloads.
- Strict TypeScript types and automated tests for encryption, database migrations, authentication, and usage logging.
