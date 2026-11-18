import { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticationError } from "../utils/errors.js";
import { GatewayKeysService } from "../services/keys.service.js";

declare module "fastify" {
  interface FastifyRequest {
    gatewayKeyId?: string;
  }
}

export interface AuthOptions {
  gatewayKey?: string;
  keysService?: GatewayKeysService;
}

export function createAuthMiddleware(options: AuthOptions = {}) {
  const expectedStaticKey = options.gatewayKey?.trim();
  const keysService = options.keysService;

  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers["api-key"];

    let providedKey: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7).trim();
    } else if (typeof apiKeyHeader === "string") {
      providedKey = apiKeyHeader.trim();
    }

    // If keys have been created in DB or static key is set, authentication is mandatory
    const hasDbKeys = keysService ? keysService.listKeys().length > 0 : false;
    const authRequired = Boolean(expectedStaticKey || hasDbKeys);

    if (!authRequired && !providedKey) {
      // Open local dev mode only when no keys exist and no token is provided
      return;
    }

    if (!providedKey) {
      throw new AuthenticationError(
        "You didn't provide an API key. You need to provide your API key in an Authorization header using Bearer auth (i.e. Authorization: Bearer YOUR_KEY)."
      );
    }

    // 1. Verify against database gateway keys
    if (keysService) {
      const verifiedKey = keysService.verifyToken(providedKey);
      if (verifiedKey) {
        request.gatewayKeyId = verifiedKey.id;
        return;
      }
    }

    // 2. Verify against static GATEWAY_KEY if configured
    if (expectedStaticKey && providedKey === expectedStaticKey) {
      request.gatewayKeyId = "static-master-key";
      return;
    }

    throw new AuthenticationError("Incorrect API key provided.", "invalid_api_key");
  };
}
