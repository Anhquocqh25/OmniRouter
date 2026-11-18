# OmniRouter Architecture & System Design

## 1. System Overview
**OmniRouter** is a free, local-first AI API gateway for Windows 10/11 designed to aggregate multiple upstream AI providers behind a single OpenAI-compatible HTTP interface.

Clients (such as VS Code extensions, AI coding assistants, and standard SDKs) configure OmniRouter as their base URL (`http://127.0.0.1:3000/v1`), allowing them to seamlessly switch providers, balance traffic, or fall back without reconfiguring individual applications.

```
+-------------------------------------------------------------+
|                     Client Applications                     |
|           (VS Code AI, Cursor, Claude Code, curl)           |
+------------------------------+------------------------------+
                               |
                               | HTTP Bearer Token (Local Key)
                               v
+-------------------------------------------------------------+
|                    OmniRouter Gateway Core                  |
|                                                             |
|  +-------------------------------------------------------+  |
|  |                 Fastify HTTP Server                   |  |
|  |                                                       |  |
|  |  [Auth Middleware] -> [Rate Limit] -> [Zod Validate]  |  |
|  +---------------------------+---------------------------+  |
|                              |                              |
|  +---------------------------v---------------------------+  |
|  |                  Provider Registry                    |  |
|  |                                                       |  |
|  |  * Model mapping (e.g. gpt-4o -> openai)              |  |
|  |  * Provider discovery & status                        |  |
|  |  * Future: Failover & round-robin routing             |  |
|  +---------------------------+---------------------------+  |
|                              |                              |
|  +---------------------------v---------------------------+  |
|  |              Provider Adapter Layer (SPI)             |  |
|  |                                                       |  |
|  |  +---------------------+   +---------------------+    |  |
|  |  |   OpenAI Adapter    |   |  Anthropic Adapter  |    |  |
|  |  +----------+----------+   +----------+----------+    |  |
|  |             |                         |               |  |
|  |  +----------+----------+   +----------+----------+    |  |
|  |  |   Gemini Adapter    |   |   Ollama Adapter    |    |  |
|  |  +----------+----------+   +----------+----------+    |  |
|  +-------------|-------------------------|---------------+  |
|                |                         |                  |
|  +-------------v-------------------------v---------------+  |
|  |                Local SQLite + Drizzle                 |  |
|  |         - Encrypted Credentials (AES-256-GCM)         |  |
|  |         - Request Metrics, Tokens & Errors            |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
                               |
                               | Upstream HTTPS APIs
                               v
          [OpenAI]   [Anthropic]   [Gemini]   [Groq]
```

## 2. Core Components

### 2.1 Fastify HTTP Surface
- Fastify provides a high-throughput, low-overhead HTTP engine on localhost.
- Standard endpoints:
  - `GET /health` - Health check and uptime.
  - `GET /v1/models` - Lists all models aggregated from active providers.
  - `POST /v1/chat/completions` - Handles non-streaming and Server-Sent Event (SSE) streaming completions.
- Error handling matches OpenAI's exact schema (`{"error": {"message": ..., "type": ..., "code": ...}}`).

### 2.2 Security & Authentication
- **Local Gateway Key:** Requests to `/v1/*` must present `Authorization: Bearer <omni_key>`.
- **Zero Key Leakage:**
  - Upstream provider credentials and gateway keys are stripped from all logs.
  - Stored credentials in SQLite are encrypted using `AES-256-GCM`.
  - Keys in memory are never dumped in debug or error payloads.

### 2.3 Provider Adapter Layer (SPI)
Every AI provider implements a standard `ProviderAdapter` interface:
```typescript
export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  listModels(): Promise<ProviderModel[]>;
  chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatCompletionStream(req: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk>;
}
```
This isolates provider-specific protocols (OpenAI JSON, Anthropic Messages API, Google Gemini REST) from the public gateway interface.

### 2.4 Provider Registry & Model Routing
The `ProviderRegistry` maintains active adapters and resolves incoming model names:
- **Direct Matching:** Known model IDs (e.g. `gpt-4o`, `gpt-4o-mini`) map to their host provider (`openai`).
- **Explicit Prefixing:** Namespaced requests (e.g. `openai/gpt-4o`, `anthropic/claude-3-5-sonnet`) are routed to the specific adapter.
- **Dynamic Discovery:** Queries registered adapters to present a unified `GET /v1/models` catalog to clients.

## 3. Data Flow

### Non-Streaming Completion Flow
1. Client sends `POST /v1/chat/completions` with Bearer auth and JSON payload.
2. Auth middleware verifies local gateway key.
3. Fastify validates payload using Zod schema.
4. `ProviderRegistry` looks up model adapter.
5. Adapter constructs upstream request with encrypted provider credentials and sends HTTPS request.
6. Adapter converts upstream response into OpenAI `ChatCompletionResponse`.
7. Gateway responds with HTTP 200 JSON.

### Streaming Completion Flow
1. Client sends request with `"stream": true`.
2. Gateway sets HTTP headers:
   - `Content-Type: text/event-stream`
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
3. Adapter initiates upstream stream and yields chunks via `AsyncIterable<ChatCompletionChunk>`.
4. Gateway writes each chunk formatted as `data: {...}\n\n`.
5. Upon stream completion, gateway transmits `data: [DONE]\n\n` and closes the connection.

## 4. Local-First Guarantees
- No cloud account or external synchronization required.
- Everything runs on localhost (`127.0.0.1`).
- Database is a single file SQLite database managed via Drizzle ORM.
