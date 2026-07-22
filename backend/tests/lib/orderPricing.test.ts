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
      discountCents: 0,
      totalCents: 102500 + DELIVERY_FEE_CENTS,
    });
  });
  it("charges Rs 99.00 delivery", () => {
    expect(DELIVERY_FEE_CENTS).toBe(9900);
  });
  it("subtracts a discount from the subtotal, keeping the delivery fee", () => {
    const totals = computeOrderTotals([{ priceCents: 45000, quantity: 2 }], 10000);
    expect(totals).toEqual({
      subtotalCents: 90000,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      discountCents: 10000,
      totalCents: 90000 - 10000 + DELIVERY_FEE_CENTS,
    });
  });
  it("caps the discount at the subtotal so the total never drops below the delivery fee", () => {
    const totals = computeOrderTotals([{ priceCents: 45000, quantity: 1 }], 999999);
    expect(totals.discountCents).toBe(45000);
    expect(totals.totalCents).toBe(DELIVERY_FEE_CENTS);
  });
});
