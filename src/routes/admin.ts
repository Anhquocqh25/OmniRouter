import { FastifyInstance } from "fastify";
import { z } from "zod";
import { GatewayKeysService } from "../services/keys.service.js";
import { UsageService } from "../services/usage.service.js";
import { CredentialsService } from "../services/credentials.service.js";
import { BadRequestError } from "../utils/errors.js";

export function registerAdminRoutes(
  fastify: FastifyInstance,
  options: {
    keysService?: GatewayKeysService;
    usageService?: UsageService;
    credentialsService?: CredentialsService;
  }
): void {
  const { keysService, usageService, credentialsService } = options;

  // 1. Usage Metrics
  fastify.get("/v1/admin/metrics", async (_req, reply) => {
    if (!usageService) {
      return reply.send({ error: "Usage service not initialized" });
    }
    return reply.send(usageService.getAggregateMetrics());
  });

  // 2. Recent Logs
  fastify.get("/v1/admin/logs", async (req, reply) => {
    if (!usageService) {
      return reply.send({ data: [] });
    }
    const query = req.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    return reply.send({ data: usageService.getRecentLogs(limit) });
  });

  // 3. Key Management
  fastify.get("/v1/admin/keys", async (_req, reply) => {
    if (!keysService) {
      return reply.send({ data: [] });
    }
    return reply.send({ data: keysService.listKeys() });
  });

  const CreateKeySchema = z.object({
    name: z.string().min(1, "Name is required"),
  });

  fastify.post("/v1/admin/keys", async (req, reply) => {
    if (!keysService) {
      throw new BadRequestError("Keys service not available");
    }

    const parse = CreateKeySchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError(parse.error.issues[0]?.message || "Invalid body");
    }

    const result = keysService.createKey(parse.data.name);
    return reply.status(201).send(result);
  });

  fastify.post<{ Params: { id: string } }>("/v1/admin/keys/:id/revoke", async (req, reply) => {
    if (!keysService) {
      throw new BadRequestError("Keys service not available");
    }
    const ok = keysService.revokeKey(req.params.id);
    return reply.send({ success: ok });
  });

  fastify.delete<{ Params: { id: string } }>("/v1/admin/keys/:id", async (req, reply) => {
    if (!keysService) {
      throw new BadRequestError("Keys service not available");
    }
    const ok = keysService.deleteKey(req.params.id);
    return reply.send({ success: ok });
  });

  // 4. Provider Credentials (encrypted)
  fastify.get("/v1/admin/credentials", async (_req, reply) => {
    if (!credentialsService) {
      return reply.send({ configured: [] });
    }
    return reply.send({ configured: credentialsService.listConfiguredProviders() });
  });

  const SetCredentialSchema = z.object({
    provider: z.string().min(1),
    apiKey: z.string().min(1),
  });

  fastify.post("/v1/admin/credentials", async (req, reply) => {
    if (!credentialsService) {
      throw new BadRequestError("Credentials service not available");
    }

    const parse = SetCredentialSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError(parse.error.issues[0]?.message || "Invalid body");
    }

    credentialsService.setCredential(parse.data.provider, parse.data.apiKey);
    return reply.send({ success: true, provider: parse.data.provider.toLowerCase() });
  });
}
