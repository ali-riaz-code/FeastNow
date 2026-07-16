import { describe, it, expect } from "vitest";
import { computeOrderTotals, DELIVERY_FEE_CENTS } from "../../src/lib/orderPricing";

describe("computeOrderTotals", () => {
  it("sums quantity * unit price and adds the flat delivery fee", () => {
    const totals = computeOrderTotals([
      { priceCents: 45000, quantity: 2 },
      { priceCents: 12500, quantity: 1 },
    ]);
    expect(totals).toEqual({
      subtotalCents: 102500,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: 102500 + DELIVERY_FEE_CENTS,
    });
  });
  it("charges Rs 99.00 delivery", () => {
    expect(DELIVERY_FEE_CENTS).toBe(9900);
  });
});
