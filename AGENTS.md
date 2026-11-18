# AGENTS.md - OmniRouter Development Guidelines

## Project Identity & Architecture
**OmniRouter** is a free, local-first AI API gateway for Windows 10/11, inspired by 9Router.
It aggregates multiple official AI providers behind standard OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`).

### Tech Stack
- **Language:** TypeScript (strict mode)
- **Backend:** Fastify
- **Frontend:** React + Vite + Tailwind CSS + shadcn/ui (Milestone 3+)
- **Database & ORM:** SQLite (`better-sqlite3`) + Drizzle ORM
- **Security:** AES-256-GCM encryption for stored secrets
- **Testing:** Vitest

## Implementation Rules for AI Agents
1. **Constitution & SDD:** Adhere to `.specify/memory/constitution.md` and Spec-Driven Development using Spec Kit.
2. **Never Rewrite Working Modules:** Refactor surgically with backwards compatibility.
3. **Strict Validation:** Use Zod for all HTTP request bodies, route params, query strings, and environment variables.
4. **Zero Key Exposure:** Never log API keys, tokens, or plaintext secrets. Strip auth headers from debug logs.
5. **No Unauthorized Provider Scraping:** Only official API keys and documented OAuth PKCE for API access.
6. **Milestone Workflow:** Complete one milestone at a time: Plan -> Modify/Create files -> Run `typecheck` and `test` -> Verify -> Report & Wait for approval.
