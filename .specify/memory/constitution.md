# OmniRouter Constitution

## Core Principles

### I. Local-First & Zero-Cost Architecture
OmniRouter is designed for Windows 10/11 developer workstations running on localhost with no Docker or external cloud databases required. Uses SQLite + Drizzle ORM and Fastify with native Node.js capabilities. All core components must prefer free, open-source dependencies and low-overhead local operations.

### II. Standardized OpenAI-Compatible Surface
The gateway aggregates disparate AI providers behind standard OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`, etc.). Downstream client applications (VS Code extensions, AI coding tools, SDKs) must be able to interact with OmniRouter as an in-place drop-in replacement for `https://api.openai.com/v1`.

### III. Strict TypeScript & Zod Validation (NON-NEGOTIABLE)
All inputs, outputs, configuration objects, provider schemas, and internal events must have strict TypeScript types and comprehensive runtime Zod validation. No dynamic untyped `any` leaks. Typecheck (`tsc --noEmit`) is a mandatory quality gate.

### IV. Security & Zero Key Leakage
1. API keys, bearer tokens, and OAuth credentials must be stored encrypted at rest.
2. Credentials and authorization headers must NEVER appear in logs, debug dumps, or error messages.
3. Only official API keys and officially supported OAuth 2.0 PKCE flows authorized for API access are permitted. Consumer session scraping or bypassing provider restrictions/quotas is strictly forbidden.

### V. Test-First & Incremental Delivery
Features are built incrementally in clearly scoped milestones. Every provider adapter, router, and authentication handler must have automated unit and integration tests. Regressions in existing endpoints are blocked before merging or moving to the next milestone.

## Technology Stack & Architecture Standards
- **Runtime:** Node.js 20+ on Windows 10/11.
- **Backend Framework:** Fastify with strict plugins and hooks.
- **Frontend Dashboard:** React + Vite + Tailwind CSS + shadcn/ui.
- **Database & Storage:** SQLite (`better-sqlite3`) + Drizzle ORM; AES-256-GCM encryption for stored secrets.
- **Streaming Protocol:** Standard Server-Sent Events (SSE) compatible with OpenAI streaming format.

## Development Workflow & Quality Gates
1. **Spec-Driven Development (SDD):** Specifications (`spec.md`), Architecture plans (`plan.md`), and Task breakdowns (`tasks.md`) precede implementation.
2. **Quality Gates per Milestone:**
   - Strict TypeScript check (`npm run typecheck` or `tsc --noEmit`).
   - Unit tests pass with Vitest (`npm test`).
   - Backward compatibility verified with existing API endpoints.

## Governance
This Constitution is the supreme architectural guide for OmniRouter. Any changes to core principles require explicit documentation and a version bump.

**Version**: 1.0.0 | **Ratified**: 2026-11-19 | **Last Amended**: 2026-11-19
