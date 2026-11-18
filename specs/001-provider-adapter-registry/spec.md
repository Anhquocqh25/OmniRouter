# Feature Specification: Provider Adapter Interface and Registry

**Feature ID:** 001-provider-adapter-registry  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Goals
OmniRouter is a local-first AI API gateway for Windows that serves an OpenAI-compatible API surface (`/v1/chat/completions`, `/v1/models`). This milestone establishes:
1. A decoupled, strongly typed `ProviderAdapter` interface that abstracts any upstream AI provider (OpenAI, Anthropic, Gemini, Groq, Ollama, etc.).
2. The initial `OpenAIProviderAdapter` adhering to this interface.
3. A centralized `ProviderRegistry` for dynamic provider discovery, model routing, and fallback.
4. Local Gateway API Key authentication with zero credential leakage.
5. Fastify server setup with strict TypeScript and Zod validation.
6. Comprehensive unit and contract tests verifying authentication, routing, and adapter behavior.

## 2. Requirements & User Stories

### User Story 1 (US1): Standard Gateway Authentication (P1)
- As an AI client (e.g. VS Code AI extension, curl, OpenAI SDK), I need to authenticate with OmniRouter using a local Bearer API key (`Authorization: Bearer <omni_key>`).
- If an invalid key or no key is provided, the gateway returns HTTP 401 with standard OpenAI error format (`{"error": {"message": "...", "type": "invalid_request_error", "code": "invalid_api_key"}}`).
- The gateway must never log or expose keys.

### User Story 2 (US2): Model Registry and Discovery (P1)
- As a client, I can query `GET /v1/models` to discover all available models across registered providers.
- The response conforms to standard OpenAI `list` format (`{"object": "list", "data": [{"id": "gpt-4o", "object": "model", ...}]}`).

### User Story 3 (US3): OpenAI Compatible Chat Completions (P1)
- As a client, I can send `POST /v1/chat/completions` with a model request (e.g., `gpt-4o`, `gpt-4o-mini`).
- The gateway validates the request body using Zod.
- The `ProviderRegistry` resolves the model to the appropriate adapter (`OpenAIProviderAdapter`).
- The adapter translates and executes the upstream call, returning the response in OpenAI format.
- Streaming requests (`stream: true`) are forwarded cleanly via Server-Sent Events (SSE).

### User Story 4 (US4): Provider Adapter Interface Extensibility (P2)
- New providers can be added without modifying core server routing or client contracts by implementing `ProviderAdapter`.
- Model routing supports explicit prefixing (e.g., `openai/gpt-4o`) and default model mapping (`gpt-4o` -> `openai`).

## 3. Non-Functional Requirements & Constraints
- Platform: Windows 10/11 native (Node.js 20+).
- Strict TypeScript with zero unhandled `any`.
- Zod validation on all requests.
- No credential logging under any circumstance.
- 100% test coverage on authentication and routing logic.
