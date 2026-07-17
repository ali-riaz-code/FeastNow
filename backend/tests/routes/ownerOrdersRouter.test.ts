import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerOrdersRouter } from "../../src/routes/ownerOrdersRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { createFakeOrderRepository, makeOrder } from "../test-helpers/fakeOrderRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };
const future = () => new Date(Date.now() + 60_000);

function buildApp(seedOrders: ReturnType<typeof makeOrder>[] = [], owned = makeOwnedRestaurant()) {
  const orderRepo = createFakeOrderRepository(seedOrders);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant/orders", createOwnerOrdersRouter({
    ownerRepo: createFakeOwnerRepository([owned]), orderRepo, jwtSecret: JWT_SECRET,
  }));
  return { app, orderRepo, restaurantId: owned.profile.id };
}

describe("GET /api/restaurant/orders", () => {
  it("filters by tab, sweeps expiry, and returns queue counts", async () => {
    const owned = makeOwnedRestaurant();
    const rid = owned.profile.id;
    const fresh = makeOrder({ restaurantId: rid, expiresAt: future() });
    const overdue = makeOrder({ restaurantId: rid, expiresAt: new Date(Date.now() - 1000) });
    const cooking = makeOrder({ restaurantId: rid, status: "preparing", expiresAt: future() });
    const { app } = buildApp([fresh, overdue, cooking], owned);

    const res = await request(app).get("/api/restaurant/orders?tab=new").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: { id: string }) => o.id)).toEqual([fresh.id]); // overdue got expired
    expect(res.body.counts).toEqual({ new: 1, preparing: 1, ready: 0 });

    const hist = await request(app).get("/api/restaurant/orders?tab=history").set(ownerAuth);
    expect(hist.body.orders.map((o: { id: string }) => o.id)).toEqual([overdue.id]);
  });

  it("searches by order number and customer name (FR-16)", async () => {
    const owned = makeOwnedRestaurant();
    const target = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const other = makeOrder({ restaurantId: owned.profile.id, expiresAt: future(), customer: { name: "Zainab", phone: "03000000000" } });
    const { app } = buildApp([target, other], owned);

    const byNumber = await request(app).get(`/api/restaurant/orders?tab=all&q=${target.orderNumber}`).set(ownerAuth);
    expect(byNumber.body.orders.map((o: { id: string }) => o.id)).toEqual([target.id]);

    const byName = await request(app).get("/api/restaurant/orders?tab=all&q=zainab").set(ownerAuth);
    expect(byName.body.orders.map((o: { id: string }) => o.id)).toEqual([other.id]);
  });

  it("never returns another restaurant's orders", async () => {
    const owned = makeOwnedRestaurant();
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([foreign], owned);
    const res = await request(app).get("/api/restaurant/orders?tab=all").set(ownerAuth);
    expect(res.body.orders).toEqual([]);
  });
});

describe("transitions", () => {
  it("accepts a placed order", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const { app } = buildApp([o], owned);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/accept`).set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("accepted");
    expect(res.body.order.acceptedAt).not.toBe(null);
  });

  it("409s order_expired when accepting past the deadline", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: new Date(Date.now() - 1000) });
    const { app } = buildApp([o], owned);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/accept`).set(ownerAuth);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("order_expired");
  });

  it("rejects with a required reason", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const { app } = buildApp([o], owned);
    expect((await request(app).post(`/api/restaurant/orders/${o.id}/reject`).set(ownerAuth).send({})).status).toBe(400);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/reject`).set(ownerAuth).send({ reason: "Store too busy" });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "rejected", rejectionReason: "Store too busy" });
  });

  it("walks accepted → preparing → ready and blocks skips + post-ready moves", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, status: "accepted", expiresAt: future() });
    const { app } = buildApp([o], owned);
    const url = `/api/restaurant/orders/${o.id}/status`;
    expect((await request(app).post(url).set(ownerAuth).send({ to: "ready" })).status).toBe(409); // skip blocked
    expect((await request(app).post(url).set(ownerAuth).send({ to: "preparing" })).body.order.status).toBe("preparing");
    expect((await request(app).post(url).set(ownerAuth).send({ to: "ready" })).body.order.status).toBe("ready");
    expect((await request(app).post(url).set(ownerAuth).send({ to: "delivered" })).status).toBe(400); // not an allowed target this phase
  });

  it("404s transitions on another restaurant's order", async () => {
    const owned = makeOwnedRestaurant();
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([foreign], owned);
    expect((await request(app).post(`/api/restaurant/orders/${foreign.id}/accept`).set(ownerAuth)).status).toBe(404);
  });
});

describe("GET /api/restaurant/orders/:id", () => {
  it("returns own order detail, 404s foreign", async () => {
    const owned = makeOwnedRestaurant();
    const mine = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([mine, foreign], owned);
    const res = await request(app).get(`/api/restaurant/orders/${mine.id}`).set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(mine.id);
    expect(res.body.order.customerPhone).toBeTruthy(); // masked client-side, full over TLS to the owner
    expect((await request(app).get(`/api/restaurant/orders/${foreign.id}`).set(ownerAuth)).status).toBe(404);
  });
});
