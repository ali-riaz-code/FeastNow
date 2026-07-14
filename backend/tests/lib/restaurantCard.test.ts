import { describe, it, expect } from "vitest";
import type { RestaurantProfile } from "@prisma/client";
import { toRestaurantCard } from "../../src/lib/restaurantCard";

const profile: RestaurantProfile = {
  id: "r1", userId: null, name: "Karahi Khaas", description: "Wood-fired karahi.",
  address: "12 Mall Road, Lahore", cuisines: ["Pakistani", "BBQ"],
  opensAt: "00:00", closesAt: "00:00", avgRating: 4.7, ratingCount: 8,
  estDeliveryMin: 25, orderCount: 900, approvedAt: new Date("2026-06-01T00:00:00Z"),
  heroImageUrl: "https://example.com/hero.jpg", isActive: true, isDemo: true,
};

describe("toRestaurantCard", () => {
  it("maps exactly the card fields and computes isOpenNow", () => {
    const card = toRestaurantCard(profile, new Date("2026-07-14T07:00:00Z"));
    expect(card).toEqual({
      id: "r1", name: "Karahi Khaas", cuisines: ["Pakistani", "BBQ"],
      avgRating: 4.7, ratingCount: 8, estDeliveryMin: 25,
      heroImageUrl: "https://example.com/hero.jpg", isOpenNow: true,
    });
  });

  it("reports closed restaurants via isOpenNow", () => {
    const closed = { ...profile, opensAt: "11:00", closesAt: "23:00" };
    // 05:00Z = 10:00 PKT — before opening
    expect(toRestaurantCard(closed, new Date("2026-07-14T05:00:00Z")).isOpenNow).toBe(false);
  });
});
