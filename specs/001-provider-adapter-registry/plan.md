# Implementation Plan: Provider Adapter Interface and Registry

**Feature ID:** 001-provider-adapter-registry  
**Status:** In Progress  

## 1. Technical Architecture & Component Design

```
+-------------------------------------------------------+
|                Client (VS Code / SDK)                |
+---------------------------+---------------------------+
                            | HTTP (Bearer Token)
                            v
+-------------------------------------------------------+
|               Fastify Server (Localhost)              |
|  +-------------------------------------------------+  |
|  |           Authentication Hook (Zod)             |  |
|  +------------------------+------------------------+  |
|                           |                           |
|  +------------------------v------------------------+  |
|  |             OpenAI-Compatible Routes            |  |
|  |       GET  /v1/models                           |  |
|  |       POST /v1/chat/completions                 |  |
|  +------------------------+------------------------+  |
|                           |                           |
|  +------------------------v------------------------+  |
|  |                Provider Registry                |  |
|  |   - Model-to-Adapter resolution                 |  |
|  |   - Discovery & Health                          |  |
|  +------------------------+------------------------+  |
|                           |                           |
|  +------------------------v------------------------+  |
|  |             ProviderAdapter Interface           |  |
|  |   - id, name, models                            |  |
|  |   - chatCompletion(req): Promise<Res>           |  |
|  |   - chatCompletionStream(req): AsyncIterable    |  |
|  +------------------------+------------------------+  |
+---------------------------|---------------------------+
                            | Upstream HTTPS (Official Key)
                            v
+-------------------------------------------------------+
|               Upstream AI Provider (OpenAI)           |
+-------------------------------------------------------+
```

## 2. Interface Definitions

### `ProviderAdapter`
```typescript
export interface ProviderModel {
  id: string;
  name: string;
  contextWindow?: number;
  supportsStreaming: boolean;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  listModels(): Promise<ProviderModel[]>;
  chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatCompletionStream(req: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk>;
}
```

### `ProviderRegistry`
```typescript
export class ProviderRegistry {
  register(adapter: ProviderAdapter): void;
  get(providerId: string): ProviderAdapter | undefined;
  resolveAdapterForModel(modelId: string): { adapter: ProviderAdapter; upstreamModelId: string } | undefined;
  listAllModels(): Promise<Array<{ id: string; provider: string }>>;
}
```

## 3. Directory Layout
```
src/
├── app.ts                  # Fastify application factory
├── server.ts               # Server bootstrap & listen
├── config.ts               # Environment & configuration (Zod validated)
├── middleware/
│   └── auth.ts             # Gateway API key auth middleware
├── providers/
│   ├── types.ts            # ProviderAdapter, models & request/response types
│   ├── registry.ts         # ProviderRegistry implementation
│   └── openai.adapter.ts   # OpenAI adapter
├── routes/
│   ├── chat.ts             # POST /v1/chat/completions
│   └── models.ts           # GET /v1/models
└── utils/
    ├── errors.ts           # OpenAI-compatible API error helpers
    └── sse.ts              # SSE formatting helpers
tests/
├── auth.test.ts            # Authentication middleware unit tests
├── routing.test.ts         # ProviderRegistry & route resolution unit tests
├── openai.adapter.test.ts  # OpenAI adapter contract tests
└── integration.test.ts     # End-to-end Fastify test server verification
```

## 4. Verification Strategy
- Type checking: `npm run typecheck` (`tsc --noEmit`).
- Automated tests: `npm test` using Vitest with mock upstream handlers.
- Error format validation: OpenAI compatibility checks.
- Auth security validation: Ensure missing/invalid tokens produce standard 401 and headers never leak into logs.
