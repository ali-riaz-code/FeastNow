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
  app.use(express.json({ limit: "4mb" })); // match production so oversized refs reach the handler (400), not the parser (413)
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
      avatarUrl: null,
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

describe("PATCH /api/me (avatar)", () => {
  const DATA_URL = `data:image/jpeg;base64,${"A".repeat(64)}`;

  async function setup() {
    const { app, userRepo } = buildApp();
    const user = await userRepo.create({ name: "Ada", email: "ada@x.co", phone: "555", passwordHash: "x" });
    const token = signToken({ userId: user.id }, JWT_SECRET);
    return { app, userRepo, user, token };
  }

  it("saves a valid image data URL and returns it in the profile", async () => {
    const { app, userRepo, user, token } = await setup();
    const res = await request(app).patch("/api/me")
      .set("Authorization", `Bearer ${token}`).send({ avatarUrl: DATA_URL });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBe(DATA_URL);
    expect((await userRepo.findById(user.id))!.avatarUrl).toBe(DATA_URL);
  });

  it("clears the photo when avatarUrl is null", async () => {
    const { app, userRepo, user, token } = await setup();
    await userRepo.updateAvatar(user.id, DATA_URL);
    const res = await request(app).patch("/api/me")
      .set("Authorization", `Bearer ${token}`).send({ avatarUrl: null });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
    expect((await userRepo.findById(user.id))!.avatarUrl).toBeNull();
  });

  it("rejects a non-image string with 400", async () => {
    const { app, token } = await setup();
    const res = await request(app).patch("/api/me")
      .set("Authorization", `Bearer ${token}`).send({ avatarUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized data URL with 400", async () => {
    const { app, token } = await setup();
    const huge = `data:image/jpeg;base64,${"A".repeat(3_100_000)}`;
    const res = await request(app).patch("/api/me")
      .set("Authorization", `Bearer ${token}`).send({ avatarUrl: huge });
    expect(res.status).toBe(400);
  });

  it("401s without a token", async () => {
    const { app } = await setup();
    const res = await request(app).patch("/api/me").send({ avatarUrl: null });
    expect(res.status).toBe(401);
  });
});
