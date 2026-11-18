# Feature Specification: Multi-Provider Expansion and Failover Routing

**Feature ID:** 002-multi-provider-failover  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Objectives
Milestone 2 extends OmniRouter's capabilities from a single OpenAI adapter into a multi-provider gateway supporting:
1. **Anthropic Adapter**: Anthropic Messages API (`https://api.anthropic.com/v1/messages`) for Claude models.
2. **Google Gemini Adapter**: Gemini REST API (`https://generativelanguage.googleapis.com/v1beta`) for Gemini models.
3. **Ollama Adapter**: Local offline LLM execution via `http://127.0.0.1:11434` with zero external credentials.
4. **Intelligent Routing & Failover**: Automatic fallback when an upstream provider encounters rate limits (429), timeouts, or 5xx server outages.

## 2. Requirements & User Stories

### User Story 1 (US1): Anthropic Claude Integration (P1)
- As a client, I can request `claude-3-5-sonnet`, `claude-3-5-haiku`, or `anthropic/claude-3-5-sonnet`.
- The gateway transforms OpenAI messages into Anthropic's payload (extracting `system` prompt, enforcing `max_tokens`, mapping role types).
- Returns an OpenAI-compatible non-streaming response or SSE stream (`stream: true`).

### User Story 2 (US2): Google Gemini Integration (P1)
- As a client, I can request `gemini-1.5-pro`, `gemini-1.5-flash`, or `gemini/gemini-2.0-flash`.
- The gateway transforms OpenAI messages into Gemini `contents` (`role: "user" | "model"`) and `systemInstruction`.
- Returns an OpenAI-compatible non-streaming response or SSE stream.

### User Story 3 (US3): Local Ollama Integration (P1)
- As a client running local offline models, I can route to Ollama (`llama3`, `qwen2.5`, `mistral`, or `ollama/*`).
- The adapter dynamically queries `GET /api/tags` on `http://127.0.0.1:11434` to discover all locally installed models.
- No API key is required for local execution.

### User Story 4 (US4): Intelligent Routing & Automatic Failover (P1)
- If a provider request fails due to 429 (Rate Limit Exceeded) or 5xx (Upstream Outage/Timeout), the router evaluates configured fallback targets (e.g. `gpt-4o` -> `claude-3-5-sonnet` -> `gemini-1.5-pro`).
- Failovers occur transparently without breaking the client's OpenAI API contract.
- If all fallback candidates fail, returns standard OpenAI error response with failover diagnosis.
