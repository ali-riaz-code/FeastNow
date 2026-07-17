import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createCustomerOrdersRouter } from "../../src/routes/customerOrdersRouter";
import { createFakeRestaurantRepository, makeRestaurant, makeMenuItem } from "../test-helpers/fakeRestaurantRepository";
import { createFakeOrderRepository, makeOrder } from "../test-helpers/fakeOrderRepository";
import { DELIVERY_FEE_CENTS } from "../../src/lib/orderPricing";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(restaurantData: Parameters<typeof createFakeRestaurantRepository>[0] = [], orders = createFakeOrderRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/api/customer/orders", createCustomerOrdersRouter({
    restaurantRepo: createFakeRestaurantRepository(restaurantData),
    orderRepo: orders, jwtSecret: JWT_SECRET,
  }));
  return app;
}

const openRestaurant = () => makeRestaurant({ opensAt: "00:00", closesAt: "00:00" }); // 24h

describe("POST /api/customer/orders", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).post("/api/customer/orders").send({});
    expect(res.status).toBe(401);
  });

  it("places an order: snapshots server prices, adds delivery fee, sets 2-min expiry", async () => {
    const r = openRestaurant();
    const item = makeMenuItem(r.id, { priceCents: 45000, name: "Margherita" });
    const orders = createFakeOrderRepository();
    const res = await request(buildApp([{ profile: r, menuItems: [item] }], orders))
      .post("/api/customer/orders").set(auth)
      .send({
        restaurantId: r.id, deliveryAddress: "12 Demo Lane", note: "extra basil",
        items: [{ menuItemId: item.id, quantity: 2, priceCents: 1 }], // client price must be ignored
      });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("placed");
    expect(res.body.order.subtotalCents).toBe(90000);
    expect(res.body.order.totalCents).toBe(90000 + DELIVERY_FEE_CENTS);
    expect(res.body.order.items[0]).toMatchObject({ nameSnapshot: "Margherita", priceAtOrderCents: 45000, quantity: 2 });
    const stored = orders.orders[0];
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(120_000);
  });

  it("409s items_unavailable listing the offending ids", async () => {
    const r = openRestaurant();
    const gone = makeMenuItem(r.id, { isAvailable: false });
    const res = await request(buildApp([{ profile: r, menuItems: [gone] }]))
      .post("/api/customer/orders").set(auth)
      .send({ restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: gone.id, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("items_unavailable");
    expect(res.body.itemIds).toEqual([gone.id]);
  });

  it("409s restaurant_closed when the store is offline", async () => {
    const r = makeRestaurant({ opensAt: "00:00", closesAt: "00:00", isOnline: false });
    const item = makeMenuItem(r.id);
    const res = await request(buildApp([{ profile: r, menuItems: [item] }]))
      .post("/api/customer/orders").set(auth)
      .send({ restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("restaurant_closed");
  });

  it("404s when the restaurant is unapproved (pending)", async () => {
    const r = makeRestaurant({ opensAt: "00:00", closesAt: "00:00", approvalStatus: "pending" });
    const item = makeMenuItem(r.id);
    const res = await request(buildApp([{ profile: r, menuItems: [item] }]))
      .post("/api/customer/orders").set(auth)
      .send({ restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("400s on bad payloads (no items, qty out of range, missing address)", async () => {
    const r = openRestaurant();
    const item = makeMenuItem(r.id);
    const app = buildApp([{ profile: r, menuItems: [item] }]);
    for (const bad of [
      { restaurantId: r.id, deliveryAddress: "x", items: [] },
      { restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 0 }] },
      { restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 21 }] },
      { restaurantId: r.id, items: [{ menuItemId: item.id, quantity: 1 }] },
    ]) {
      const res = await request(app).post("/api/customer/orders").set(auth).send(bad);
      expect(res.status).toBe(400);
    }
  });
});

describe("GET /api/customer/orders and /:id", () => {
  it("lists own orders newest-first and expires overdue placed ones on read", async () => {
    const overdue = makeOrder({ customerId: "u1", expiresAt: new Date(Date.now() - 1000) });
    const orders = createFakeOrderRepository([overdue]);
    const res = await request(buildApp([], orders)).get("/api/customer/orders").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.orders[0].status).toBe("rejected");
    expect(res.body.orders[0].rejectionReason).toBe("Not accepted in time");
  });

  it("404s another customer's order", async () => {
    const foreign = makeOrder({ customerId: "someone-else", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([foreign]);
    const res = await request(buildApp([], orders)).get(`/api/customer/orders/${foreign.id}`).set(auth);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/customer/orders/:id/cancel", () => {
  it("cancels a placed order", async () => {
    const o = makeOrder({ customerId: "u1", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([o]);
    const res = await request(buildApp([], orders)).post(`/api/customer/orders/${o.id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("cancelled");
  });

  it("409s invalid_transition once accepted", async () => {
    const o = makeOrder({ customerId: "u1", status: "accepted", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([o]);
    const res = await request(buildApp([], orders)).post(`/api/customer/orders/${o.id}/cancel`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("invalid_transition");
  });
});
