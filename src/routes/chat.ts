import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ChatCompletionChunk, ChatCompletionRequestSchema } from "../providers/types.js";
import { ProviderRegistry } from "../providers/registry.js";
import { BadRequestError, ModelNotFoundError, OmniRouterError } from "../utils/errors.js";
import { UsageService } from "../services/usage.service.js";

function isRetryableError(err: unknown): boolean {
  if (err instanceof OmniRouterError) {
    return err.statusCode === 429 || err.statusCode === 502 || err.statusCode === 503 || err.statusCode === 504;
  }
  return true; // Network or fetch abort error
}

export function registerChatRoutes(
  fastify: FastifyInstance,
  registry: ProviderRegistry,
  usageService?: UsageService
): void {
  fastify.post("/v1/chat/completions", async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = performance.now();

    // 1. Zod Validation
    const parseResult = ChatCompletionRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const fieldPath = issue?.path.join(".") || "body";
      const message = issue ? `${issue.message} at '${fieldPath}'` : "Invalid request body";

      usageService?.recordUsage({
        keyId: request.gatewayKeyId,
        provider: "router",
        model: "unknown",
        latencyMs: Math.round(performance.now() - startTime),
        statusCode: 400,
        errorType: "invalid_request_error",
      });

      throw new BadRequestError(message, fieldPath);
    }

    const payload = parseResult.data;

    // 2. Resolve provider route chain (primary + failovers)
    const routeChain = registry.resolveRouteChain(payload.model);
    if (routeChain.length === 0) {
      usageService?.recordUsage({
        keyId: request.gatewayKeyId,
        provider: "router",
        model: payload.model,
        latencyMs: Math.round(performance.now() - startTime),
        statusCode: 404,
        errorType: "model_not_found",
      });
      throw new ModelNotFoundError(payload.model);
    }

    // 3. Handle Streaming response with failover
    if (payload.stream) {
      let activeStream: AsyncIterable<ChatCompletionChunk> | undefined;
      let firstChunk: ChatCompletionChunk | undefined;
      let streamIterator: AsyncIterator<ChatCompletionChunk> | undefined;
      let lastStreamError: Error | undefined;
      let activeProvider = routeChain[0]!.adapter.id;

      for (const route of routeChain) {
        try {
          activeProvider = route.adapter.id;
          const upstreamPayload = { ...payload, model: route.modelId };
          activeStream = route.adapter.chatCompletionStream(upstreamPayload);
          streamIterator = activeStream[Symbol.asyncIterator]();
          const firstResult = await streamIterator.next();
          if (!firstResult.done) {
            firstChunk = firstResult.value;
          }
          break;
        } catch (err: unknown) {
          lastStreamError = err instanceof Error ? err : new Error(String(err));
          if (isRetryableError(err)) {
            continue;
          }
          usageService?.recordUsage({
            keyId: request.gatewayKeyId,
            provider: activeProvider,
            model: payload.model,
            latencyMs: Math.round(performance.now() - startTime),
            statusCode: err instanceof OmniRouterError ? err.statusCode : 500,
            errorType: err instanceof OmniRouterError ? err.errorType : "api_error",
          });
          throw err;
        }
      }

      if (!activeStream || !streamIterator) {
        const error = lastStreamError || new OmniRouterError("All streaming providers in failover chain failed.", 502);
        usageService?.recordUsage({
          keyId: request.gatewayKeyId,
          provider: activeProvider,
          model: payload.model,
          latencyMs: Math.round(performance.now() - startTime),
          statusCode: error instanceof OmniRouterError ? error.statusCode : 502,
          errorType: "stream_failover_failure",
        });
        throw error;
      }

      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders();

      let clientDisconnected = false;
      let chunkCount = 0;

      request.raw.on("close", () => {
        clientDisconnected = true;
      });

      try {
        if (firstChunk) {
          chunkCount++;
          reply.raw.write(`data: ${JSON.stringify(firstChunk)}\n\n`);
        }

        while (!clientDisconnected) {
          const { done, value } = await streamIterator.next();
          if (done) break;
          chunkCount++;
          reply.raw.write(`data: ${JSON.stringify(value)}\n\n`);
        }

        if (!clientDisconnected) {
          reply.raw.write("data: [DONE]\n\n");
        }

        // Record stream usage
        usageService?.recordUsage({
          keyId: request.gatewayKeyId,
          provider: activeProvider,
          model: payload.model,
          promptTokens: 0,
          completionTokens: chunkCount,
          totalTokens: chunkCount,
          latencyMs: Math.round(performance.now() - startTime),
          statusCode: 200,
        });
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Stream error occurred";
        if (!clientDisconnected) {
          reply.raw.write(
            `data: ${JSON.stringify({
              error: { message: errMessage, type: "api_error" },
            })}\n\n`
          );
        }
        usageService?.recordUsage({
          keyId: request.gatewayKeyId,
          provider: activeProvider,
          model: payload.model,
          latencyMs: Math.round(performance.now() - startTime),
          statusCode: 500,
          errorType: "stream_write_error",
        });
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

        // Record successful usage
        usageService?.recordUsage({
          keyId: request.gatewayKeyId,
          provider: route.adapter.id,
          model: payload.model,
          promptTokens: result.usage?.prompt_tokens || 0,
          completionTokens: result.usage?.completion_tokens || 0,
          totalTokens: result.usage?.total_tokens || 0,
          latencyMs: Math.round(performance.now() - startTime),
          statusCode: 200,
        });

        return reply.send(result);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isRetryableError(err)) {
          continue;
        }
        usageService?.recordUsage({
          keyId: request.gatewayKeyId,
          provider: route.adapter.id,
          model: payload.model,
          latencyMs: Math.round(performance.now() - startTime),
          statusCode: err instanceof OmniRouterError ? err.statusCode : 500,
          errorType: err instanceof OmniRouterError ? err.errorType : "api_error",
        });
        throw err;
      }
    }

    const finalErr = lastError || new OmniRouterError("All providers in failover chain failed.", 502);
    usageService?.recordUsage({
      keyId: request.gatewayKeyId,
      provider: "failover_exhausted",
      model: payload.model,
      latencyMs: Math.round(performance.now() - startTime),
      statusCode: finalErr instanceof OmniRouterError ? finalErr.statusCode : 502,
      errorType: "failover_exhausted",
    });

    throw finalErr;
  });
}
