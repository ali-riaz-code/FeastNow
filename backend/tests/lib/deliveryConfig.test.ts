import { describe, it, expect } from "vitest";
import { computePayoutCents, PAYOUT_BASE_CENTS } from "../../src/lib/deliveryConfig";

describe("computePayoutCents", () => {
  it("is base-only when distance is unknown", () => {
    expect(computePayoutCents(null)).toBe(PAYOUT_BASE_CENTS);
  });
  it("adds per-km, rounded", () => {
    expect(computePayoutCents(3.5)).toBe(PAYOUT_BASE_CENTS + Math.round(3.5 * 1500)); // 5000 + 5250 = 10250
  });
});
