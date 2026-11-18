import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("Gateway Authentication Middleware", () => {
  it("allows access when GATEWAY_KEY is not configured", async () => {
    const app = buildApp({
      config: {
        GATEWAY_KEY: undefined,
        NODE_ENV: "test",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
    });

    expect(response.statusCode).toBe(200);
  });

  it("rejects requests when GATEWAY_KEY is set and no Authorization header is provided", async () => {
    const app = buildApp({
      config: {
        GATEWAY_KEY: "secret-omni-key-123",
        NODE_ENV: "test",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe("authentication_error");
    expect(body.error.code).toBe("invalid_api_key");
    expect(body.error.message).toContain("API key");
  });

  it("rejects requests with incorrect Bearer token", async () => {
    const app = buildApp({
      config: {
        GATEWAY_KEY: "secret-omni-key-123",
        NODE_ENV: "test",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
      headers: {
        authorization: "Bearer wrong-key",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("invalid_api_key");
  });

  it("allows requests with valid Bearer token", async () => {
    const app = buildApp({
      config: {
        GATEWAY_KEY: "secret-omni-key-123",
        NODE_ENV: "test",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
      headers: {
        authorization: "Bearer secret-omni-key-123",
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it("allows requests with valid api-key header", async () => {
    const app = buildApp({
      config: {
        GATEWAY_KEY: "secret-omni-key-123",
        NODE_ENV: "test",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/models",
      headers: {
        "api-key": "secret-omni-key-123",
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
