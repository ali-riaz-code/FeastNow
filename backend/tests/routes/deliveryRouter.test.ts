import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createDeliveryRouter } from "../../src/routes/deliveryRouter";
import { createFakeDeliveryRepository, makePartner } from "../test-helpers/fakeDeliveryRepository";
import type { OfferRecord, PartnerView } from "../../src/repositories/deliveryRepository";
import type { OrderWithItems } from "../../src/repositories/orderRepository";
import { makeOrder } from "../test-helpers/fakeOrderRepository";
import { signToken } from "../../src/lib/jwt";
import { errorHandler } from "../../src/middleware/errorHandler";

const JWT = "test-secret";
const auth = (userId: string) => ({ Authorization: `Bearer ${signToken({ userId }, JWT)}` });

function buildApp(
  partners: PartnerView[] = [makePartner({ userId: "p1" })],
  offers: OfferRecord[] = [],
  orders: OrderWithItems[] = [],
) {
  const deliveryRepo = createFakeDeliveryRepository(partners, offers, orders);
  const app = express();
  app.use(express.json());
  app.use("/api/delivery", createDeliveryRouter({ deliveryRepo, jwtSecret: JWT }));
  app.use(errorHandler);
  return { app, deliveryRepo };
}

describe("GET /api/delivery/me", () => {
  it("returns the partner profile", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/delivery/me").set(auth("p1"));
    expect(res.status).toBe(200);
    expect(res.body.partner).toMatchObject({ vehicleType: "motorcycle", approved: true });
  });
  it("403s a non-partner", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/delivery/me").set(auth("nobody"))).status).toBe(403);
  });
  it("401s without a token", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/delivery/me")).status).toBe(401);
  });
});

describe("PATCH /api/delivery/me", () => {
  it("updates name, phone, and vehicle type", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/delivery/me").set(auth("p1"))
      .send({ name: "New Name", phone: "03007654321", vehicleType: "car" });
    expect(res.status).toBe(200);
    expect(res.body.partner).toMatchObject({ name: "New Name", phone: "03007654321", vehicleType: "car" });
  });
  it("400s an invalid vehicle type", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/delivery/me").set(auth("p1"))
      .send({ name: "N", phone: "0300", vehicleType: "hovercraft" });
    expect(res.status).toBe(400);
  });
});

describe("availability + location", () => {
  it("goes online only with a recent location", async () => {
    const { app } = buildApp([makePartner({ userId: "p1", locationUpdatedAt: null, currentLat: null, currentLng: null })]);
    const blocked = await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "online" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("location_required");

    await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: 24.86, lng: 67.01 });
    const on = await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "online" });
    expect(on.status).toBe(200);
    expect(on.body.partner.availabilityStatus).toBe("online");
  });
  it("blocks going offline mid-delivery", async () => {
    const order = { id: "o1", status: "assigned", deliveryPartnerId: "p1" } as OrderWithItems;
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    const res = await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "offline" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("delivery_in_progress");
  });
  it("400s an invalid location", async () => {
    const { app } = buildApp();
    expect((await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: "x" })).status).toBe(400);
  });
  it("400s an invalid availability status", async () => {
    const { app } = buildApp();
    expect((await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "away" })).status).toBe(400);
  });
});

describe("offers", () => {
  it("lists a pending offer for the partner and accepts it", async () => {
    const order = makeOrder({ id: "o1", status: "ready", deliveryLat: 24.90, deliveryLng: 67.05 });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    // going online + a fresh location so the tick offers to p1:
    await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: 24.86, lng: 67.01 });
    await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "online" });

    const list = await request(app).get("/api/delivery/offers").set(auth("p1"));
    expect(list.status).toBe(200);
    expect(list.body.offers).toHaveLength(1);
    expect(list.body.offers[0]).toMatchObject({ orderNumber: order.orderNumber, restaurantName: order.restaurant.name });
    expect(list.body.offers[0].payoutCents).toBeGreaterThan(0);

    const id = list.body.offers[0].id;
    const acc = await request(app).post(`/api/delivery/offers/${id}/accept`).set(auth("p1"));
    expect(acc.status).toBe(200);
    expect(acc.body.order.status).toBe("assigned");
    expect(acc.body.order.payoutCents).toBeGreaterThan(0);
  });

  it("409s accepting an already-taken offer", async () => {
    const order = makeOrder({ id: "o1", status: "ready", deliveryLat: 24.90, deliveryLng: 67.05 });
    const a = makePartner({ userId: "a" });
    // b is offline so the tick offers only to a; b still has a resolvable profile for accept.
    const b = makePartner({ userId: "b", availabilityStatus: "offline" });
    const { app, deliveryRepo } = buildApp([a, b], [], [order]);

    const list = await request(app).get("/api/delivery/offers").set(auth("a"));
    const offerId = list.body.offers[0].id;
    // Force a second pending offer to partner b for the same order (the race):
    deliveryRepo.offers.push({ ...deliveryRepo.offers[0], id: "of-race", partnerId: "b", status: "pending" });

    await request(app).post(`/api/delivery/offers/${offerId}/accept`).set(auth("a"));
    const taken = await request(app).post("/api/delivery/offers/of-race/accept").set(auth("b"));
    expect(taken.status).toBe(409);
  });

  it("declines an offer", async () => {
    const order = makeOrder({ id: "o1", status: "ready", deliveryLat: 24.90, deliveryLng: 67.05 });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    const list = await request(app).get("/api/delivery/offers").set(auth("p1"));
    const id = list.body.offers[0].id;
    const dec = await request(app).post(`/api/delivery/offers/${id}/decline`).set(auth("p1"));
    expect(dec.status).toBe(200);
    expect(dec.body.ok).toBe(true);
  });
});

describe("active delivery flow", () => {
  it("walks assigned → out_for_delivery → delivered", async () => {
    const order = makeOrder({ id: "o1", status: "assigned", deliveryPartnerId: "p1",
      deliveryLat: 24.9, deliveryLng: 67.05 });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);

    const active = await request(app).get("/api/delivery/active").set(auth("p1"));
    expect(active.status).toBe(200);
    expect(active.body.active.order.id).toBe("o1");

    const pick = await request(app).post("/api/delivery/orders/o1/pickup").set(auth("p1"));
    expect(pick.status).toBe(200);
    expect(pick.body.order.status).toBe("out_for_delivery");

    const del = await request(app).post("/api/delivery/orders/o1/deliver").set(auth("p1")).send({ note: "Left at door" });
    expect(del.status).toBe(200);
    expect(del.body.order.status).toBe("delivered");
  });

  it("blocks pickup on another partner's order", async () => {
    const order = makeOrder({ id: "o1", status: "assigned", deliveryPartnerId: "someone" });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    expect((await request(app).post("/api/delivery/orders/o1/pickup").set(auth("p1"))).status).toBe(409);
  });

  it("returns null active when the partner has none", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/delivery/active").set(auth("p1"));
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(null);
  });

  it("400s a deliver note that is too long", async () => {
    const order = makeOrder({ id: "o1", status: "out_for_delivery", deliveryPartnerId: "p1" });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    const res = await request(app).post("/api/delivery/orders/o1/deliver").set(auth("p1")).send({ note: "x".repeat(301) });
    expect(res.status).toBe(400);
  });

  it("releases an order via unable", async () => {
    const order = makeOrder({ id: "o1", status: "out_for_delivery", deliveryPartnerId: "p1" });
    const { app, deliveryRepo } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    const res = await request(app).post("/api/delivery/orders/o1/unable").set(auth("p1"));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("ready");
    expect(deliveryRepo.orders[0].deliveryPartnerId).toBe(null);
  });
});
