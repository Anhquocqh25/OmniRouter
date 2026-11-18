import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ChatCompletionRequestSchema } from "../providers/types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { BadRequestError, ModelNotFoundError } from "../utils/errors.js";

export function registerChatRoutes(fastify: FastifyInstance, registry: ProviderRegistry): void {
  fastify.post("/v1/chat/completions", async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Zod Validation
    const parseResult = ChatCompletionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const fieldPath = issue?.path.join(".") || "body";
      const message = issue ? `${issue.message} at '${fieldPath}'` : "Invalid request body";
      throw new BadRequestError(message, fieldPath);
    }

    const payload = parseResult.data;

    // 2. Resolve provider adapter for the requested model
    const resolved = registry.resolveRoute(payload.model);
    if (!resolved) {
      throw new ModelNotFoundError(payload.model);
    }

    const { adapter, modelId: upstreamModel } = resolved;
    const upstreamPayload = { ...payload, model: upstreamModel };

    // 3. Handle Streaming response
    if (payload.stream) {
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders();

      let clientDisconnected = false;
      request.raw.on("close", () => {
        clientDisconnected = true;
      });

      try {
        const stream = adapter.chatCompletionStream(upstreamPayload);
        for await (const chunk of stream) {
          if (clientDisconnected) break;
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        if (!clientDisconnected) {
          reply.raw.write("data: [DONE]\n\n");
        }
      } catch (err: unknown) {
        if (!clientDisconnected) {
          const errMessage = err instanceof Error ? err.message : "Stream error occurred";
          reply.raw.write(
            `data: ${JSON.stringify({
              error: { message: errMessage, type: "api_error" },
            })}\n\n`
          );
        }
      } finally {
        reply.raw.end();
      }

      return reply;
    }

    // 4. Handle Non-streaming response
    const result = await adapter.chatCompletion(upstreamPayload);
    return reply.send(result);
  });
}
