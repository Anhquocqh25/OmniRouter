# Tasks: Multi-Provider Expansion and Failover Routing

**Feature:** 002-multi-provider-failover  
**Status:** Completed  

## Phase 1: Environment & Config Expansion
- [x] T001 Add `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL` to `src/config.ts`

## Phase 2: Anthropic Claude Adapter
- [x] T002 Implement `AnthropicProviderAdapter` in `src/providers/anthropic.adapter.ts`
- [x] T003 Implement unit tests for Anthropic conversion and streaming in `tests/anthropic.adapter.test.ts`

## Phase 3: Google Gemini Adapter
- [x] T004 Implement `GeminiProviderAdapter` in `src/providers/gemini.adapter.ts`
- [x] T005 Implement unit tests for Gemini conversion and streaming in `tests/gemini.adapter.test.ts`

## Phase 4: Local Ollama Adapter
- [x] T006 Implement `OllamaProviderAdapter` in `src/providers/ollama.adapter.ts`
- [x] T007 Implement unit tests for Ollama model discovery and completion in `tests/ollama.adapter.test.ts`

## Phase 5: Intelligent Routing & Failover
- [x] T008 Enhance `ProviderRegistry` with fallback chains and failover resolution in `src/providers/registry.ts`
- [x] T009 Update `src/routes/chat.ts` to execute with automatic failover
- [x] T010 Register all adapters in `src/app.ts`
- [x] T011 Write failover integration tests in `tests/failover.test.ts`

## Phase 6: Verification & Quality Gate
- [x] T012 Run `npm.cmd run typecheck`
- [x] T013 Run `npm.cmd test` and ensure all tests pass
