# Tasks: Provider Adapter Interface and Registry

**Feature**: 001-provider-adapter-registry  
**Status**: Completed  

## Phase 1: Setup & Project Scaffolding
- [x] T001 Initialize git repository and Spec Kit structure
- [x] T002 Update ratified constitution and AGENTS.md
- [x] T003 Initialize Node.js TypeScript project (`package.json`, `tsconfig.json`, `vitest.config.ts`)
- [x] T004 Install dependencies (`fastify`, `@fastify/cors`, `zod`, `vitest`, `typescript`, etc.)

## Phase 2: Foundational Architecture & Documentation
- [x] T005 Create `docs/ARCHITECTURE.md` per project requirements
- [x] T006 Create `docs/ROADMAP.md` covering future milestones (OAuth, Dashboard, Drizzle SQLite, Multi-provider, Failover)
- [x] T007 Define OpenAI-compatible Zod schemas and TypeScript types in `src/providers/types.ts`
- [x] T008 Implement OpenAI error formatting in `src/utils/errors.ts`

## Phase 3: Core Implementation
- [x] T009 Implement `ProviderAdapter` interface in `src/providers/types.ts`
- [x] T010 Implement `OpenAIProviderAdapter` in `src/providers/openai.adapter.ts`
- [x] T011 Implement `ProviderRegistry` with model-to-provider routing in `src/providers/registry.ts`
- [x] T012 Implement gateway authentication middleware in `src/middleware/auth.ts`
- [x] T013 Implement `/v1/models` route in `src/routes/models.ts`
- [x] T014 Implement `/v1/chat/completions` route (with streaming support) in `src/routes/chat.ts`
- [x] T015 Assemble Fastify application factory in `src/app.ts` and entry point `src/server.ts`

## Phase 4: Testing & Verification
- [x] T016 Write unit tests for gateway authentication in `tests/auth.test.ts`
- [x] T017 Write unit tests for ProviderRegistry and routing in `tests/routing.test.ts`
- [x] T018 Write unit tests for OpenAIProviderAdapter in `tests/openai.adapter.test.ts`
- [x] T019 Write integration tests for Fastify endpoints in `tests/integration.test.ts`
- [x] T020 Run `npm.cmd run typecheck` and `npm.cmd test` to verify all tests pass
