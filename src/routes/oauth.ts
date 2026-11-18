import { FastifyInstance } from "fastify";
import { OAuthManager } from "../oauth/manager.js";
import { BadRequestError } from "../utils/errors.js";

export function registerOAuthRoutes(fastify: FastifyInstance, oauthManager: OAuthManager): void {
  // 1. Initiate OAuth Flow
  fastify.get<{ Params: { provider: string }; Querystring: { redirectUri?: string; clientId?: string } }>(
    "/v1/oauth/:provider/authorize",
    async (request, reply) => {
      const provider = request.params.provider.toLowerCase();
      const defaultRedirect = `${request.protocol}://${request.hostname}:${request.port}/oauth/callback`;
      const redirectUri = request.query.redirectUri || defaultRedirect;

      try {
        const session = oauthManager.createAuthorizationSession(provider, redirectUri, {
          clientId: request.query.clientId,
        });
        return reply.send(session);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to initiate OAuth flow";
        throw new BadRequestError(msg);
      }
    }
  );

  // 2. Loopback Callback
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    "/oauth/callback",
    async (request, reply) => {
      const { code, state, error, error_description } = request.query;

      reply.raw.setHeader("Content-Type", "text/html; charset=utf-8");

      if (error || !code || !state) {
        const errorMsg = error_description || error || "Authorization was denied or incomplete.";
        return reply.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Authorization Failed - OmniRouter</title></head>
            <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
              <div style="background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #ef4444; text-align: center; max-width: 480px;">
                <h1 style="color: #ef4444; margin: 0 0 1rem;">Authorization Failed</h1>
                <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.5;">${errorMsg}</p>
                <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 1.5rem;">You may close this window and try again.</p>
              </div>
            </body>
          </html>
        `);
      }

      try {
        const exchange = await oauthManager.exchangeCodeForTokens(state, code);

        return reply.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Authorization Successful - OmniRouter</title></head>
            <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
              <div style="background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #10b981; text-align: center; max-width: 480px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">✨</div>
                <h1 style="color: #10b981; margin: 0 0 1rem; font-size: 1.5rem;">Authorization Successful!</h1>
                <p style="color: #cbd5e1; font-size: 1rem; line-height: 1.5;">OmniRouter has securely encrypted and saved credentials for <strong>${exchange.providerId}</strong>.</p>
                <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 1.5rem;">You can now close this tab and return to your IDE or dashboard.</p>
              </div>
            </body>
          </html>
        `);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Exchange failed";
        return reply.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Token Exchange Failed - OmniRouter</title></head>
            <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
              <div style="background: #1e293b; padding: 2.5rem; border-radius: 12px; border: 1px solid #f59e0b; text-align: center; max-width: 480px;">
                <h1 style="color: #f59e0b; margin: 0 0 1rem;">Token Exchange Failed</h1>
                <p style="color: #cbd5e1; font-size: 1rem;">${msg}</p>
              </div>
            </body>
          </html>
        `);
      }
    }
  );

  // 3. OAuth Status
  fastify.get("/v1/oauth/status", async (_request, reply) => {
    return reply.send({ status: oauthManager.getStatus() });
  });

  // 4. Disconnect Provider
  fastify.post<{ Params: { provider: string } }>("/v1/oauth/:provider/disconnect", async (request, reply) => {
    const success = oauthManager.disconnect(request.params.provider);
    return reply.send({ success, provider: request.params.provider });
  });
}
