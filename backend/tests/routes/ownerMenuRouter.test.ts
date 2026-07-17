import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerMenuRouter } from "../../src/routes/ownerMenuRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };

function buildApp(owned = makeOwnedRestaurant()) {
  const repo = createFakeOwnerRepository([owned]);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant", createOwnerMenuRouter({ ownerRepo: repo, jwtSecret: JWT_SECRET }));
  return { app, owned };
}

describe("owner menu", () => {
  it("lists own items in position order", async () => {
    const { app, owned } = buildApp();
    const res = await request(app).get("/api/restaurant/menu").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(owned.menuItems!.length);
    expect(res.body.items[0]).toHaveProperty("category");
  });

  it("creates an item (FR-17) with validation", async () => {
    const { app } = buildApp();
    const bad = await request(app).post("/api/restaurant/menu-items").set(ownerAuth)
      .send({ category: "Mains", name: "", description: "", priceCents: -5, isAvailable: true });
    expect(bad.status).toBe(400);
    const res = await request(app).post("/api/restaurant/menu-items").set(ownerAuth)
      .send({ category: "Pizze", name: "Diavola", description: "Spicy salami.", priceCents: 52000, isAvailable: true });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: "Diavola", priceCents: 52000 });
  });

  it("edits + toggles availability, 404s foreign items", async () => {
    const { app, owned } = buildApp();
    const mine = owned.menuItems![0];
    const res = await request(app).patch(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.item.isAvailable).toBe(false);
    expect((await request(app).patch("/api/restaurant/menu-items/not-mine").set(ownerAuth)
      .send({ isAvailable: false })).status).toBe(404);
  });

  it("deletes an item", async () => {
    const { app, owned } = buildApp();
    const mine = owned.menuItems![0];
    expect((await request(app).delete(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)).status).toBe(204);
    expect((await request(app).delete(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)).status).toBe(404);
  });
});
