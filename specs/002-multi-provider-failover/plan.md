# Implementation Plan: Multi-Provider Expansion and Failover Routing

**Feature ID:** 002-multi-provider-failover  
**Status:** In Progress  

## 1. Architecture & Design

```
+-------------------------------------------------------------+
|                      Client Applications                    |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                    Fastify Gateway Core                     |
|                                                             |
|  +---------------------------v---------------------------+  |
|  |                 Router & Failover Engine              |  |
|  |  - Primary Route Resolution                           |  |
|  |  - Fallback Chain: [Primary] -> [Backup1] -> [Backup2] |  |
|  +---------------------------+---------------------------+  |
|                              |                              |
|        +---------------------+---------------------+        |
|        |                     |                     |        |
|        v                     v                     v        |
|  +-----------+         +-----------+         +-----------+  |
|  |  OpenAI   |         | Anthropic |         |  Gemini   |  |
|  |  Adapter  |         |  Adapter  |         |  Adapter  |  |
|  +-----+-----+         +-----+-----+         +-----+-----+  |
|        |                     |                     |        |
|        |                     v                     |        |
|        |               +-----------+               |        |
|        |               |   Ollama  |               |        |
|        |               |  (Local)  |               |        |
|        |               +-----+-----+               |        |
+--------|---------------------|---------------------|--------+
         |                     |                     |
         v                     v                     v
   [OpenAI API]        [Anthropic API]        [Gemini API]
```

## 2. Component Specifications

### 2.1 Anthropic Adapter (`src/providers/anthropic.adapter.ts`)
- Target: `https://api.anthropic.com/v1/messages`
- Headers: `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Message Conversion:
  - System messages extracted to `system` string.
  - Consecutive same-role messages merged.
  - Required `max_tokens` default to 4096 if unspecified.
- Streaming:
  - Parses Anthropic SSE events (`content_block_delta`, `message_delta`, `message_stop`).
  - Emits standard `ChatCompletionChunk` SSE objects.

### 2.2 Google Gemini Adapter (`src/providers/gemini.adapter.ts`)
- Target: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- Streaming: `streamGenerateContent?alt=sse&key={apiKey}`
- Message Conversion:
  - System messages -> `systemInstruction.parts[{text}]`.
  - Roles: `assistant` -> `model`, `user` -> `user`.
- Emits standard `ChatCompletionResponse` and `ChatCompletionChunk`.

### 2.3 Ollama Adapter (`src/providers/ollama.adapter.ts`)
- Target: `http://127.0.0.1:11434`
- Discovery: `GET /api/tags`
- Completion: `POST /v1/chat/completions` (Ollama's native OpenAI compatibility mode) or `/api/chat`
- Supports offline zero-credential execution.

### 2.4 Failover Routing in `ProviderRegistry`
- Fallback route chain method: `resolveFallbackChain(model: string): ResolvedRoute[]`
- If execution of primary route fails with status code 429 or >= 500, attempt next route in chain.

## 3. Verification Strategy
- Unit tests for:
  - Anthropic payload and streaming conversion (`tests/anthropic.adapter.test.ts`).
  - Gemini payload and streaming conversion (`tests/gemini.adapter.test.ts`).
  - Ollama adapter and model discovery (`tests/ollama.adapter.test.ts`).
  - Failover engine: simulate primary 429/500 and verify seamless failover (`tests/failover.test.ts`).
- Typecheck with `npm run typecheck`.
- Regression verification: ensure OpenAI adapter and milestone 1 tests still pass 100%.
