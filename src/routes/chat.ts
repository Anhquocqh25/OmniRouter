import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ChatCompletionChunk, ChatCompletionRequestSchema } from "../providers/types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { BadRequestError, ModelNotFoundError, OmniRouterError } from "../utils/errors.js";

function isRetryableError(err: unknown): boolean {
  if (err instanceof OmniRouterError) {
    return err.statusCode === 429 || err.statusCode === 502 || err.statusCode === 503 || err.statusCode === 504;
  }
  return true; // Network or fetch abort error
}

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

    // 2. Resolve provider route chain (primary + failovers)
    const routeChain = registry.resolveRouteChain(payload.model);
    if (routeChain.length === 0) {
      throw new ModelNotFoundError(payload.model);
    }

    // 3. Handle Streaming response with failover
    if (payload.stream) {
      let activeStream: AsyncIterable<ChatCompletionChunk> | undefined;
      let firstChunk: ChatCompletionChunk | undefined;
      let streamIterator: AsyncIterator<ChatCompletionChunk> | undefined;
      let lastStreamError: Error | undefined;

      // Try each route in chain to connect to the stream
      for (const route of routeChain) {
        try {
          const upstreamPayload = { ...payload, model: route.modelId };
          activeStream = route.adapter.chatCompletionStream(upstreamPayload);
          streamIterator = activeStream[Symbol.asyncIterator]();
          const firstResult = await streamIterator.next();
          if (!firstResult.done) {
            firstChunk = firstResult.value;
          }
          break; // Connected and received first chunk successfully!
        } catch (err: unknown) {
          lastStreamError = err instanceof Error ? err : new Error(String(err));
          if (isRetryableError(err)) {
            continue; // Fail over to next provider
          }
          throw err;
        }
      }

      if (!activeStream || !streamIterator) {
        throw lastStreamError || new OmniRouterError("All streaming providers in failover chain failed.", 502);
      }

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
        if (firstChunk) {
          reply.raw.write(`data: ${JSON.stringify(firstChunk)}\n\n`);
        }

        while (!clientDisconnected) {
          const { done, value } = await streamIterator.next();
          if (done) break;
          reply.raw.write(`data: ${JSON.stringify(value)}\n\n`);
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

    // 4. Handle Non-streaming response with failover
    let lastError: Error | undefined;

    for (const route of routeChain) {
      try {
        const upstreamPayload = { ...payload, model: route.modelId };
        const result = await route.adapter.chatCompletion(upstreamPayload);
        return reply.send(result);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isRetryableError(err)) {
          continue; // Fail over to next provider
        }
        throw err;
      }
    }

    throw lastError || new OmniRouterError("All providers in failover chain failed.", 502);
  });
}
