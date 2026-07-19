import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createDeliveryRouter } from "../../src/routes/deliveryRouter";
import { createFakeDeliveryRepository, makePartner } from "../test-helpers/fakeDeliveryRepository";
import type { OfferRecord, PartnerView } from "../../src/repositories/deliveryRepository";
import type { OrderWithItems } from "../../src/repositories/orderRepository";
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
