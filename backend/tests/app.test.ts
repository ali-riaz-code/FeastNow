import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";

describe("createApp", () => {
  const app = createApp({
    prisma: new PrismaClient(),
    jwtSecret: "test-secret",
    frontendOrigins: ["http://localhost:5500"],
    sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("POST /api/auth/login without a body returns 400 without touching the database", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("mounts /api/me and requires auth", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });
});
