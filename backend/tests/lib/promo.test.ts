import { describe, it, expect } from "vitest";
import { computeDiscountCents, promoInvalidReason } from "../../src/lib/promo";
import { makePromo } from "../test-helpers/fakePromoRepository";

const NOW = new Date("2026-07-22T12:00:00Z");

describe("computeDiscountCents", () => {
  it("floors a percentage discount to the nearest cent", () => {
    // 33% of 10001 = 3300.33 -> 3300
    expect(computeDiscountCents({ discountType: "percentage", discountValue: 33 }, 10001)).toBe(3300);
  });
  it("applies a fixed discount straight", () => {
    expect(computeDiscountCents({ discountType: "fixed", discountValue: 5000 }, 90000)).toBe(5000);
  });
  it("caps a fixed discount at the subtotal", () => {
    expect(computeDiscountCents({ discountType: "fixed", discountValue: 999999 }, 45000)).toBe(45000);
  });
  it("returns 0 for an empty subtotal", () => {
    expect(computeDiscountCents({ discountType: "percentage", discountValue: 50 }, 0)).toBe(0);
  });
});

describe("promoInvalidReason", () => {
  it("returns not_found for a missing promo", () => {
    expect(promoInvalidReason(null, NOW)).toBe("not_found");
  });
  it("returns inactive for a deactivated promo", () => {
    expect(promoInvalidReason(makePromo({ active: false }), NOW)).toBe("inactive");
  });
  it("returns expired once past the expiry", () => {
    expect(promoInvalidReason(makePromo({ expiresAt: new Date("2026-07-01T00:00:00Z") }), NOW)).toBe("expired");
  });
  it("returns null for an active, unexpired promo", () => {
    expect(promoInvalidReason(makePromo({ expiresAt: new Date("2026-08-01T00:00:00Z") }), NOW)).toBeNull();
    expect(promoInvalidReason(makePromo({ expiresAt: null }), NOW)).toBeNull();
  });
});
