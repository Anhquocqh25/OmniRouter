import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { initDatabase } from "../src/db/index.js";

describe("Dashboard Static Asset Hosting & Gateway Integration", () => {
  it("serves the Dashboard HTML on GET /", async () => {
    const dbConn = initDatabase(":memory:");
    const app = buildApp({
      config: { NODE_ENV: "test" },
      dbConnection: dbConn,
    });

    const res = await app.inject({
      method: "GET",
      url: "/",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("OmniRouter");
    expect(res.body).toContain('id="root"');
  });

  it("serves GET /health with updated version 0.5.0 and oauth_status", async () => {
    const dbConn = initDatabase(":memory:");
    const app = buildApp({
      config: { NODE_ENV: "test" },
      dbConnection: dbConn,
    });

    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.5.0");
    expect(body.oauth_status).toBeDefined();
  });
});
