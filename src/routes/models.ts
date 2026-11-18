import { FastifyInstance } from "fastify";
import { ProviderRegistry } from "../providers/registry.js";
import { ModelNotFoundError } from "../utils/errors.js";

export function registerModelRoutes(fastify: FastifyInstance, registry: ProviderRegistry): void {
  fastify.get("/v1/models", async (_request, reply) => {
    const models = await registry.listAllModels();
    return reply.send({
      object: "list",
      data: models,
    });
  });

  fastify.get<{ Params: { model: string } }>("/v1/models/:model", async (request, reply) => {
    const modelParam = decodeURIComponent(request.params.model);
    const resolved = registry.resolveRoute(modelParam);

    if (!resolved) {
      throw new ModelNotFoundError(modelParam);
    }

    return reply.send({
      id: modelParam,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: resolved.adapter.id,
      provider: resolved.adapter.id,
    });
  });
}
