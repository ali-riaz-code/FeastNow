import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOtpRequestLimiter, createLoginLimiter } from "../../src/middleware/rateLimit";

function buildApp(limiter: ReturnType<typeof createOtpRequestLimiter>) {
  const app = express();
  app.get("/probe", limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("rate limiting", () => {
  it("allows requests under the limit and blocks the one after", async () => {
    const app = buildApp(createOtpRequestLimiter({ windowMs: 60_000, limit: 2 }));

    const first = await request(app).get("/probe");
    const second = await request(app).get("/probe");
    const third = await request(app).get("/probe");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });

  it("createLoginLimiter also blocks after its configured limit", async () => {
    const app = buildApp(createLoginLimiter({ windowMs: 60_000, limit: 1 }));

    const first = await request(app).get("/probe");
    const second = await request(app).get("/probe");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
