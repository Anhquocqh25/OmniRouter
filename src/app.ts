import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { Config, loadConfig } from "./config.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OpenAIProviderAdapter } from "./providers/openai.adapter.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { registerModelRoutes } from "./routes/models.js";
import { registerChatRoutes } from "./routes/chat.js";
import { OmniRouterError } from "./utils/errors.js";

export interface BuildAppOptions {
  config?: Partial<Config>;
  registry?: ProviderRegistry;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const config = loadConfig(options.config);

  const app = fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      serializers: {
        req(req) {
          // Never log raw authorization tokens
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

  // Enable CORS for local clients and web dashboards
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "api-key"],
  });

  // Setup Provider Registry & default OpenAI adapter
  const registry = options.registry || new ProviderRegistry();
  if (!options.registry) {
    const openAIAdapter = new OpenAIProviderAdapter({
      apiKey: config.OPENAI_API_KEY,
      baseUrl: config.OPENAI_BASE_URL,
    });
    registry.register(openAIAdapter);
  }

  // Health endpoint (public)
  app.get("/health", async () => {
    return {
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      configured_providers: registry
        .getAllAdapters()
        .filter((a) => a.isConfigured())
        .map((a) => a.id),
    };
  });

  // Authentication hook for all /v1 routes
  const authMiddleware = createAuthMiddleware({ gatewayKey: config.GATEWAY_KEY });
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1")) {
      await authMiddleware(request, reply);
    }
  });

  // Register OpenAI-compatible API routes
  registerModelRoutes(app, registry);
  registerChatRoutes(app, registry);

  // OpenAI-compatible global error handler
  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof OmniRouterError) {
      return reply.status(error.statusCode).send(error.toJSON());
    }

    const err = error as { statusCode?: number; message?: string; validation?: unknown };

    // Fastify validation errors
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

    // Default 500 error (hide internal details in production/test)
    const statusCode = err?.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        message: statusCode === 500 ? "Internal server error" : (err?.message || "Internal server error"),
        type: "api_error",
        param: null,
        code: null,
      },
    });
  });

  return app;
}
