# Implementation Plan: Encrypted Persistence and Usage Tracking with SQLite and Drizzle

**Feature ID:** 003-encrypted-persistence-drizzle  
**Status:** In Progress  

## 1. Database Schema & Tables

```
+-------------------------------------------------------------+
|                     gateway_api_keys                        |
+-------------------------------------------------------------+
| id          | TEXT PRIMARY KEY (uuid / nano)                |
| name        | TEXT NOT NULL                                 |
| key_hash    | TEXT NOT NULL UNIQUE (sha256 hash of token)   |
| key_prefix  | TEXT NOT NULL (e.g. omni-live-abc...)         |
| is_active   | INTEGER NOT NULL DEFAULT 1                    |
| created_at  | INTEGER NOT NULL (epoch ms)                   |
| last_used_at| INTEGER                                       |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
|                   provider_credentials                      |
+-------------------------------------------------------------+
| provider_id | TEXT PRIMARY KEY ('openai', 'anthropic', etc.)|
| encrypted_key| TEXT NOT NULL (iv:authTag:ciphertext)        |
| updated_at  | INTEGER NOT NULL (epoch ms)                   |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
|                        usage_logs                           |
+-------------------------------------------------------------+
| id          | TEXT PRIMARY KEY                              |
| key_id      | TEXT (references gateway_api_keys)            |
| provider    | TEXT NOT NULL                                 |
| model       | TEXT NOT NULL                                 |
| prompt_tokens| INTEGER NOT NULL DEFAULT 0                   |
| completion_tokens | INTEGER NOT NULL DEFAULT 0              |
| total_tokens| INTEGER NOT NULL DEFAULT 0                    |
| latency_ms  | INTEGER NOT NULL                              |
| status_code | INTEGER NOT NULL                              |
| error_type  | TEXT                                          |
| created_at  | INTEGER NOT NULL (epoch ms)                   |
+-------------------------------------------------------------+
```

## 2. Encryption Architecture (AES-256-GCM)
- Key: 32 bytes derived from `ENCRYPTION_KEY` using SHA-256.
- IV: 12 bytes randomly generated per encryption (`crypto.randomBytes(12)`).
- Tag: 16 bytes auth tag.
- Serialized format: `${ivHex}:${authTagHex}:${ciphertextHex}`.
- Tamper detection: Authenticated decryption verifies tag; failure throws security error.

## 3. Directory Layout
```
src/
├── db/
│   ├── index.ts        # Database connection & init (better-sqlite3 + Drizzle)
│   ├── schema.ts       # Drizzle schema definitions
│   └── crypto.ts       # AES-256-GCM encryption & decryption utilities
├── services/
│   ├── keys.service.ts # Gateway API Key creation, verification, revocation
│   ├── credentials.service.ts # Encrypted provider credentials storage
│   └── usage.service.ts # Usage tracking and analytics queries
```

## 4. Verification Strategy
- `tests/crypto.test.ts`: Test encryption, decryption, tampering detection, and key derivation.
- `tests/keys.service.test.ts`: Test key issuance, SHA-256 hashing, active/revoked states, and verification.
- `tests/usage.service.test.ts`: Test request logging and aggregation metrics.
- `tests/db.integration.test.ts`: End-to-end integration with Fastify verifying authenticated calls update `last_used_at` and log token usage in SQLite.
- Strict typecheck with `npm run typecheck`.
