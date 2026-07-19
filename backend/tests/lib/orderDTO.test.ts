import { describe, it, expect } from "vitest";
import { toOrderDTO } from "../../src/lib/orderDTO";
import { makeOrder } from "../test-helpers/fakeOrderRepository";

describe("toOrderDTO", () => {
  it("flattens relations and exposes ISO timeline fields", () => {
    const o = makeOrder({ status: "accepted", acceptedAt: new Date("2026-07-16T12:05:00Z") });
    const dto = toOrderDTO(o);
    expect(dto.id).toBe(o.id);
    expect(dto.orderNumber).toBe(o.orderNumber);
    expect(dto.status).toBe("accepted");
    expect(dto.placedAt).toBe(o.createdAt.toISOString());
    expect(dto.acceptedAt).toBe("2026-07-16T12:05:00.000Z");
    expect(dto.preparingAt).toBe(null);
    expect(dto.restaurantName).toBe(o.restaurant.name);
    expect(dto.customerName).toBe(o.customer.name);
    expect(dto.customerPhone).toBe(o.customer.phone);
    expect(dto.items[0]).toEqual({
      id: o.items[0].id, nameSnapshot: o.items[0].nameSnapshot,
      priceAtOrderCents: o.items[0].priceAtOrderCents, quantity: o.items[0].quantity,
    });
  });

  it("exposes delivery fields", () => {
    const dto = toOrderDTO(makeOrder({
      status: "assigned", assignedAt: new Date("2026-07-18T10:00:00Z"),
      payoutCents: 10250, deliveryPartner: { name: "Rider Ray" },
    }));
    expect(dto.assignedAt).toBe("2026-07-18T10:00:00.000Z");
    expect(dto.outForDeliveryAt).toBe(null);
    expect(dto.deliveredAt).toBe(null);
    expect(dto.payoutCents).toBe(10250);
    expect(dto.deliveryPartnerName).toBe("Rider Ray");
  });

  it("defaults delivery fields when unassigned", () => {
    const dto = toOrderDTO(makeOrder({ status: "ready" }));
    expect(dto.payoutCents).toBe(null);
    expect(dto.deliveryPartnerName).toBe(null);
  });
});
