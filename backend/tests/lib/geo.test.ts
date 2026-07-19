import { describe, it, expect } from "vitest";
import { haversineKm } from "../../src/lib/geo";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: 24.86, lng: 67.01 }, { lat: 24.86, lng: 67.01 })).toBe(0);
  });
  it("approximates a known short distance (~1.57 km per 0.01° lat)", () => {
    const d = haversineKm({ lat: 24.86, lng: 67.01 }, { lat: 24.87, lng: 67.01 });
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});
