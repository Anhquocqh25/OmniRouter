import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Config, loadConfig } from "./config.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OpenAIProviderAdapter } from "./providers/openai.adapter.js";
import { AnthropicProviderAdapter } from "./providers/anthropic.adapter.js";
import { GeminiProviderAdapter } from "./providers/gemini.adapter.js";
import { OllamaProviderAdapter } from "./providers/ollama.adapter.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { registerModelRoutes } from "./routes/models.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerOAuthRoutes } from "./routes/oauth.js";
import { OmniRouterError } from "./utils/errors.js";
import { DatabaseConnection, initDatabase } from "./db/index.js";
import { CredentialsService } from "./services/credentials.service.js";
import { GatewayKeysService } from "./services/keys.service.js";
import { UsageService } from "./services/usage.service.js";
import { OAuthManager } from "./oauth/manager.js";

export interface BuildAppOptions {
  config?: Partial<Config>;
  registry?: ProviderRegistry;
  dbPath?: string;
  dbConnection?: DatabaseConnection;
  credentialsService?: CredentialsService;
  keysService?: GatewayKeysService;
  usageService?: UsageService;
  oauthManager?: OAuthManager;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = loadConfig(options.config);

  // Initialize SQLite Database and Drizzle Services
  const dbPath = options.dbPath || (config.NODE_ENV === "test" ? ":memory:" : config.DATABASE_PATH);
  const dbConn = options.dbConnection || initDatabase(dbPath);

  const credentialsService =
    options.credentialsService || new CredentialsService(dbConn.db, config.ENCRYPTION_KEY);
  const keysService = options.keysService || new GatewayKeysService(dbConn.db);
  const usageService = options.usageService || new UsageService(dbConn.db);
  const oauthManager =
    options.oauthManager ||
    new OAuthManager(dbConn.db, {
      encryptionSecret: config.ENCRYPTION_KEY,
    });

  const app = fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "api-key"],
  });

  // Setup Provider Registry & default adapters
  const registry = options.registry || new ProviderRegistry();
  if (!options.registry) {
    const openaiKey = config.OPENAI_API_KEY || credentialsService.getCredential("openai") || undefined;
    const anthropicKey = config.ANTHROPIC_API_KEY || credentialsService.getCredential("anthropic") || undefined;
    const geminiKey = config.GEMINI_API_KEY || credentialsService.getCredential("gemini") || undefined;

    registry.register(
      new OpenAIProviderAdapter({
        apiKey: openaiKey,
        baseUrl: config.OPENAI_BASE_URL,
        tokenProvider: () => oauthManager.getValidAccessToken("openai"),
      })
    );
    registry.register(
      new AnthropicProviderAdapter({
        apiKey: anthropicKey,
        baseUrl: config.ANTHROPIC_BASE_URL,
      })
    );
    registry.register(
      new GeminiProviderAdapter({
        apiKey: geminiKey,
        baseUrl: config.GEMINI_BASE_URL,
      })
    );
    registry.register(
      new OllamaProviderAdapter({
        baseUrl: config.OLLAMA_BASE_URL,
      })
    );
  }

  // Health endpoint (public)
  app.get("/health", async () => {
    return {
      status: "ok",
      version: "0.4.0",
      timestamp: new Date().toISOString(),
      configured_providers: registry
        .getAllAdapters()
        .filter((a) => a.isConfigured())
        .map((a) => a.id),
      oauth_status: oauthManager.getStatus(),
    };
  });

  // Authentication hook for all /v1 routes (except /v1/oauth/status or public)
  const authMiddleware = createAuthMiddleware({
    gatewayKey: config.GATEWAY_KEY,
    keysService,
  });

  app.addHook("preHandler", async (request, reply) => {
    // Exclude loopback /oauth/callback and public oauth initiate from gateway key auth
    if (request.url.startsWith("/oauth/callback")) {
      return;
    }
    if (request.url.startsWith("/v1")) {
      await authMiddleware(request, reply);
    }
  });

  // Register OpenAI-compatible API routes
  registerModelRoutes(app, registry);
  registerChatRoutes(app, registry, usageService);

  // Register Admin & Analytics routes
  registerAdminRoutes(app, {
    keysService,
    usageService,
    credentialsService,
  });

  // Register OAuth 2.0 PKCE routes
  registerOAuthRoutes(app, oauthManager);

  // Clean database shutdown on close
  app.addHook("onClose", async () => {
    try {
      dbConn.close();
    } catch {
      // ignore
    }
  });

  // OpenAI-compatible global error handler
  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof OmniRouterError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    const err = error as { statusCode?: number; message?: string; validation?: unknown };

    if (err && "validation" in err && err.validation) {
      return reply.status(400).send({
        error: {
          message: err.message || "Validation error",
          type: "invalid_request_error",
          param: null,
          code: null,
        },
      });
    }

    const statusCode = err?.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        message: statusCode === 500 ? "Internal server error" : err?.message || "Internal server error",
        type: "api_error",
        param: null,
        code: null,
      },
    });
  });

  return app;
}
