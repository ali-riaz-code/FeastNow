import { describe, it, expect } from "vitest";
import { runAssignmentTick, acceptOffer, declineOffer } from "../../src/lib/deliveryAssignment";
import { createFakeDeliveryRepository, makePartner } from "../test-helpers/fakeDeliveryRepository";
import { makeOrder } from "../test-helpers/fakeOrderRepository";

const ready = (o = {}) => makeOrder({ status: "ready", deliveryLat: 24.90, deliveryLng: 67.05, ...o });

describe("runAssignmentTick", () => {
  it("offers a ready order to the nearest eligible partner", async () => {
    const near = makePartner({ userId: "near", currentLat: 24.861, currentLng: 67.011 });
    const far  = makePartner({ userId: "far", currentLat: 25.50, currentLng: 67.90 });
    const repo = createFakeDeliveryRepository([near, far], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    expect(repo.offers).toHaveLength(1);
    expect(repo.offers[0]).toMatchObject({ orderId: "o1", partnerId: "near", status: "pending" });
  });

  it("does not double-offer an order that already has a pending offer", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    await runAssignmentTick(repo, new Date());
    expect(repo.offers).toHaveLength(1);
  });

  it("re-offers to the next nearest after an offer expires, skipping the first partner", async () => {
    const p1 = makePartner({ userId: "p1", currentLat: 24.861, currentLng: 67.011 });
    const p2 = makePartner({ userId: "p2", currentLat: 24.850, currentLng: 67.000 });
    const repo = createFakeDeliveryRepository([p1, p2], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());                 // → p1
    const later = new Date(Date.now() + 46_000);
    await runAssignmentTick(repo, later);                       // p1 offer expires → p2
    const pending = repo.offers.filter((o) => o.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].partnerId).toBe("p2");
    expect(repo.offers.filter((o) => o.status === "expired")).toHaveLength(1);
  });

  it("stops after MAX_OFFER_ATTEMPTS and leaves the order ready (seeking rider)", async () => {
    const partners = Array.from({ length: 6 }, (_, i) => makePartner({ userId: `p${i}`, currentLat: 24.86 + i * 0.001, currentLng: 67.01 }));
    const repo = createFakeDeliveryRepository(partners, [], [ready({ id: "o1" })]);
    let t = Date.now();
    for (let i = 0; i < 7; i++) { await runAssignmentTick(repo, new Date(t)); t += 46_000; }
    expect(repo.offers.filter((o) => o.status === "pending")).toHaveLength(0);
    expect(repo.orders[0].status).toBe("ready");
  });
});

describe("acceptOffer", () => {
  it("assigns the order and snapshots payout", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    const offerId = repo.offers[0].id;
    const res = await acceptOffer(repo, offerId, "p1", new Date());
    expect(res.ok).toBe(true);
    expect(repo.orders[0]).toMatchObject({ status: "assigned", deliveryPartnerId: "p1" });
    expect(repo.orders[0].payoutCents).toBeGreaterThan(5000); // base + per-km
  });

  it("returns taken when the order was already assigned (race)", async () => {
    const a = makePartner({ userId: "a" }), b = makePartner({ userId: "b", currentLat: 24.850, currentLng: 67.000 });
    const repo = createFakeDeliveryRepository([a, b], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    // Force a second pending offer to a different partner for the same order:
    repo.offers.push({ ...repo.offers[0], id: "of-race", partnerId: "b" });
    await acceptOffer(repo, repo.offers[0].id, "a", new Date());
    // Simulate the concurrent interleaving: B read its offer as pending before A's sibling-expiry landed.
    repo.offers.find((o) => o.id === "of-race")!.status = "pending";
    const res = await acceptOffer(repo, "of-race", "b", new Date());
    expect(res).toEqual({ ok: false, code: "taken" });
  });

  it("returns expired for a stale offer", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    const res = await acceptOffer(repo, repo.offers[0].id, "p1", new Date(Date.now() + 46_000));
    expect(res).toEqual({ ok: false, code: "expired" });
  });
});

describe("declineOffer", () => {
  it("marks the offer declined so the next tick reassigns", async () => {
    const p1 = makePartner({ userId: "p1" }), p2 = makePartner({ userId: "p2", currentLat: 24.85, currentLng: 67.00 });
    const repo = createFakeDeliveryRepository([p1, p2], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    await declineOffer(repo, repo.offers[0].id, "p1", new Date());
    await runAssignmentTick(repo, new Date());
    const pending = repo.offers.filter((o) => o.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].partnerId).toBe("p2");
  });
});
