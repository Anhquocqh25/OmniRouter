# Implementation Plan: Local Web Dashboard with React, Vite, and Tailwind

**Feature ID:** 005-web-dashboard  
**Status:** In Progress  

## 1. Architecture & Component Hierarchy

```
+-------------------------------------------------------------+
|                      OmniRouter Dashboard                   |
|  +-------------------------------------------------------+  |
|  | Header: Logo, Status Indicator, System Uptime, Theme  |  |
|  +-------------------------------------------------------+  |
|  | Navigation Tabs:                                      |  |
|  | [1. Overview]  [2. Playground]  [3. Keys]  [4. Providers]|  |
|  +-------------------------------------------------------+  |
|                                                             |
|  TAB 1: Overview & Analytics                                |
|  - KPI Cards: Total Requests, Total Tokens, Avg Latency,    |
|    Error Rate                                               |
|  - Provider Token Consumption Bars                          |
|  - Recent API Requests Table                                |
|                                                             |
|  TAB 2: Interactive Playground                              |
|  - Model Selector (GPT-4o, Claude 3.5, Gemini, Ollama)      |
|  - System Prompt & Temperature Sliders                      |
|  - Chat Message Thread & Input Box                          |
|  - Real-time Response & Token Usage Breakdown               |
|                                                             |
|  TAB 3: Gateway Key Management                              |
|  - Create New Key Form (Label, Prefix)                      |
|  - Active Keys List with One-Click Revoke / Copy            |
|                                                             |
|  TAB 4: Providers & OAuth Connections                       |
|  - Status Cards: OpenAI, Anthropic, Gemini, Ollama          |
|  - One-Click OAuth Connect / Disconnect Buttons             |
|  - Direct Encrypted API Key Entry Form                      |
+-------------------------------------------------------------+
```

## 2. Static Asset Hosting via Fastify
- `frontend/` builds into `frontend/dist/`.
- In `src/app.ts`: registers `@fastify/static` serving `frontend/dist` at `/`.
- If `frontend/dist` does not exist yet (e.g. during backend unit tests), skips static serving gracefully without throwing.

## 3. Directory Layout
```
frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    ├── api.ts
    └── components/
        ├── Header.tsx
        ├── OverviewTab.tsx
        ├── PlaygroundTab.tsx
        ├── KeysTab.tsx
        └── ProvidersTab.tsx
```

## 4. Verification Strategy
- Frontend build: `npm run build` inside `frontend/` succeeds with 0 errors.
- Fastify static test: `tests/dashboard.integration.test.ts` verifies `GET /` serves HTML and assets.
- Strict typecheck and test suite verification.
