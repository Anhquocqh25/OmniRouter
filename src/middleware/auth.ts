import { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticationError } from "../utils/errors.js";

export interface AuthOptions {
  gatewayKey?: string;
}

export function createAuthMiddleware(options: AuthOptions = {}) {
  const expectedKey = options.gatewayKey?.trim();

  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    // If no gateway key is configured, allow local access
    if (!expectedKey) {
      return;
    }

    const authHeader = request.headers.authorization;
    const apiKeyHeader = request.headers["api-key"];

    let providedKey: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      providedKey = authHeader.substring(7).trim();
    } else if (typeof apiKeyHeader === "string") {
      providedKey = apiKeyHeader.trim();
    }

    if (!providedKey) {
      throw new AuthenticationError(
        "You didn't provide an API key. You need to provide your API key in an Authorization header using Bearer auth (i.e. Authorization: Bearer YOUR_KEY)."
      );
    }

    if (providedKey !== expectedKey) {
      throw new AuthenticationError("Incorrect API key provided.", "invalid_api_key");
    }
  };
}
