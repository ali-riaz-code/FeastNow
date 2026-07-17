import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerRouter } from "../../src/routes/ownerRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };
const strangerAuth = { Authorization: `Bearer ${signToken({ userId: "not-an-owner" }, JWT_SECRET)}` };

function buildApp(data = [makeOwnedRestaurant()]) {
  const repo = createFakeOwnerRepository(data);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant", createOwnerRouter({ ownerRepo: repo, jwtSecret: JWT_SECRET }));
  return { app, repo };
}

describe("GET /api/restaurant/me", () => {
  it("401s without a token and 403s a non-owner account", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/restaurant/me")).status).toBe(401);
    expect((await request(app).get("/api/restaurant/me").set(strangerAuth)).status).toBe(403);
  });

  it("returns the owner profile DTO", async () => {
    const { app, repo } = buildApp();
    const res = await request(app).get("/api/restaurant/me").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      id: repo.data[0].profile.id, approvalStatus: "approved", isOnline: true,
    });
    expect(res.body.profile.cuisines).toEqual(repo.data[0].profile.cuisines);
  });

  it("auto-approves a pending profile older than 60s, not a fresh one", async () => {
    const fresh = makeOwnedRestaurant();
    fresh.profile.approvalStatus = "pending";
    fresh.profile.createdAt = new Date(Date.now() - 10_000);
    const { app: appFresh } = buildApp([fresh]);
    expect((await request(appFresh).get("/api/restaurant/me").set(ownerAuth)).body.profile.approvalStatus).toBe("pending");

    const due = makeOwnedRestaurant();
    due.profile.approvalStatus = "pending";
    due.profile.createdAt = new Date(Date.now() - 90_000);
    const { app: appDue } = buildApp([due]);
    expect((await request(appDue).get("/api/restaurant/me").set(ownerAuth)).body.profile.approvalStatus).toBe("approved");
  });
});

describe("PATCH /api/restaurant/profile", () => {
  it("updates business fields (FR-21)", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/restaurant/profile").set(ownerAuth).send({
      name: "Rosa's", description: "Wood-fired.", address: "9 Zamzama",
      cuisines: ["Italian", "Pizza"], opensAt: "10:00", closesAt: "22:30",
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ name: "Rosa's", opensAt: "10:00", cuisines: ["Italian", "Pizza"] });
  });

  it("400s bad hours or empty name", async () => {
    const { app } = buildApp();
    for (const bad of [
      { name: "", description: "", address: "x", cuisines: ["a"], opensAt: "10:00", closesAt: "22:00" },
      { name: "x", description: "", address: "x", cuisines: ["a"], opensAt: "25:99", closesAt: "22:00" },
      { name: "x", description: "", address: "x", cuisines: [], opensAt: "10:00", closesAt: "22:00" },
    ]) {
      expect((await request(app).patch("/api/restaurant/profile").set(ownerAuth).send(bad)).status).toBe(400);
    }
  });
});

describe("PATCH /api/restaurant/store-status", () => {
  it("toggles isOnline", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/restaurant/store-status").set(ownerAuth).send({ isOnline: false });
    expect(res.status).toBe(200);
    expect(res.body.profile.isOnline).toBe(false);
  });
});

describe("GET /api/restaurant/reviews", () => {
  it("returns recent reviews", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/restaurant/reviews").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.reviews.length).toBeGreaterThan(0);
    expect(res.body.reviews[0]).toHaveProperty("stars");
  });
});
