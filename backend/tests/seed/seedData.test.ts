import { describe, it, expect } from "vitest";
import { buildSeedData } from "../../prisma/seedData";

const NOW = new Date("2026-07-14T12:00:00Z");
const DAY = 86_400_000;

describe("buildSeedData", () => {
  const data = buildSeedData(NOW);

  it("is deterministic for a fixed now", () => {
    expect(buildSeedData(NOW)).toEqual(data);
  });

  it("builds 20 restaurants across at least 6 cuisines", () => {
    expect(data).toHaveLength(20);
    const cuisines = new Set(data.flatMap((r) => r.cuisines));
    expect(cuisines.size).toBeGreaterThanOrEqual(6);
  });

  it("gives every restaurant 8-15 menu items in 3-4 categories with integer prices and increasing positions", () => {
    for (const r of data) {
      expect(r.menuItems.length).toBeGreaterThanOrEqual(8);
      expect(r.menuItems.length).toBeLessThanOrEqual(15);
      const categories = new Set(r.menuItems.map((m) => m.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
      expect(categories.size).toBeLessThanOrEqual(4);
      for (const m of r.menuItems) {
        expect(Number.isInteger(m.priceCents)).toBe(true);
        expect(m.priceCents).toBeGreaterThan(0);
      }
      const positions = r.menuItems.map((m) => m.position);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("keeps ratings consistent: 3-8 reviews, avgRating = mean of stars (1dp), ratingCount = review count", () => {
    for (const r of data) {
      expect(r.reviews.length).toBeGreaterThanOrEqual(3);
      expect(r.reviews.length).toBeLessThanOrEqual(8);
      expect(r.ratingCount).toBe(r.reviews.length);
      const mean = r.reviews.reduce((sum, rv) => sum + rv.stars, 0) / r.reviews.length;
      expect(r.avgRating).toBe(Math.round(mean * 10) / 10);
      for (const rv of r.reviews) {
        expect(rv.stars).toBeGreaterThanOrEqual(1);
        expect(rv.stars).toBeLessThanOrEqual(5);
      }
    }
  });

  it("staggers approvedAt and varies delivery estimates and hours", () => {
    const within30 = data.filter((r) => +NOW - +r.approvedAt <= 30 * DAY);
    const older60 = data.filter((r) => +NOW - +r.approvedAt > 60 * DAY);
    expect(within30.length).toBeGreaterThanOrEqual(3);
    expect(older60.length).toBeGreaterThanOrEqual(5);
    expect(data.some((r) => r.estDeliveryMin <= 30)).toBe(true);
    expect(data.some((r) => r.estDeliveryMin > 30)).toBe(true);
    // at least one overnight window (closes "earlier" than it opens)
    expect(data.some((r) => r.closesAt < r.opensAt)).toBe(true);
  });
});
