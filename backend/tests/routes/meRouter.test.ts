import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import type { User } from "@prisma/client";
import { createMeRouter } from "../../src/routes/meRouter";
import { createFakeUserRepository } from "../test-helpers/fakeUserRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";

function buildApp(userRepo = createFakeUserRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/api/me", createMeRouter({ userRepo, jwtSecret: JWT_SECRET }));
  return { app, userRepo };
}

describe("GET /api/me", () => {
  it("returns the caller's profile for a valid token", async () => {
    const { app, userRepo } = buildApp();
    const user = await userRepo.create({
      name: "Ada Lovelace", email: "ada@example.com", phone: "555-0100", passwordHash: "x",
    });
    const token = signToken({ userId: user.id }, JWT_SECRET);

    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id, name: "Ada Lovelace", email: "ada@example.com", phone: "555-0100", role: "customer",
    });
  });

  it("returns 401 with no Authorization header", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("401s a suspended user", async () => {
    const userRepo = createFakeUserRepository([
      {
        id: "s1", name: "S", email: "s1@x.co", phone: "1", passwordHash: "x",
        role: "customer", createdAt: new Date(), suspendedAt: new Date(), suspensionReason: null,
      } as User,
    ]);
    const { app } = buildApp(userRepo);
    const res = await request(app).get("/api/me").set({ Authorization: `Bearer ${signToken({ userId: "s1" }, JWT_SECRET)}` });
    expect(res.status).toBe(401);
  });
});
