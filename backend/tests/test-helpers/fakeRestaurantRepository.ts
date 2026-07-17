import type { MenuItem, Rating, RestaurantProfile } from "@prisma/client";
import type {
  DishHit, RestaurantDetail, RestaurantListParams, RestaurantRepository,
} from "../../src/repositories/restaurantRepository";

let seq = 0;

export function makeRestaurant(overrides: Partial<RestaurantProfile> = {}): RestaurantProfile {
  seq += 1;
  return {
    id: `rest-${seq}`, userId: null, name: `Restaurant ${seq}`,
    description: "A demo restaurant.", address: "1 Demo Street, Karachi",
    cuisines: ["Pakistani"], opensAt: "00:00", closesAt: "00:00", // 24h → isOpenNow true in tests
    avgRating: 4.2, ratingCount: 10, estDeliveryMin: 25, orderCount: 100,
    approvedAt: new Date("2026-01-01T00:00:00Z"),
    heroImageUrl: "https://example.com/hero.jpg", isActive: true, isDemo: true,
    approvalStatus: "approved", isOnline: true, createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeMenuItem(restaurantId: string, overrides: Partial<MenuItem> = {}): MenuItem {
  seq += 1;
  return {
    id: `item-${seq}`, restaurantId, category: "Mains", name: `Dish ${seq}`,
    description: "Tasty.", priceCents: 45000, imageUrl: null, isAvailable: true,
    position: seq, ...overrides,
  };
}

export function makeRating(restaurantId: string, overrides: Partial<Rating> = {}): Rating {
  seq += 1;
  return {
    id: `rating-${seq}`, restaurantId, orderId: null, stars: 4,
    reviewText: "Great food.", authorName: "Demo Reviewer",
    createdAt: new Date("2026-06-01T00:00:00Z"), ...overrides,
  };
}

export interface FakeRestaurantData {
  profile: RestaurantProfile;
  menuItems?: MenuItem[];
  ratings?: Rating[];
}

export function createFakeRestaurantRepository(data: FakeRestaurantData[] = []): RestaurantRepository {
  const isVisible = (p: RestaurantProfile) => p.isActive && p.approvalStatus === "approved";
  const active = () => data.map((d) => d.profile).filter(isVisible);
  const byName = (a: RestaurantProfile, b: RestaurantProfile) => a.name.localeCompare(b.name);

  return {
    async findMostPopular(limit) {
      return [...active()].sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async findTopRated(limit) {
      return active().filter((p) => p.ratingCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount || byName(a, b))
        .slice(0, limit);
    },
    async findNewSince(since, limit) {
      return active().filter((p) => p.approvedAt >= since)
        .sort((a, b) => +b.approvedAt - +a.approvedAt).slice(0, limit);
    },
    async findUnder30(limit) {
      return active().filter((p) => p.estDeliveryMin <= 30)
        .sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async listCuisines() {
      return [...new Set(active().flatMap((p) => p.cuisines))].sort();
    },
    async list(params: RestaurantListParams) {
      let rows = active();
      if (params.search) {
        const s = params.search.toLowerCase();
        rows = rows.filter((p) => p.name.toLowerCase().includes(s));
      }
      if (params.cuisine) rows = rows.filter((p) => p.cuisines.includes(params.cuisine!));
      rows = [...rows].sort((a, b) => {
        if (params.sort === "rating") return b.avgRating - a.avgRating || b.ratingCount - a.ratingCount || byName(a, b);
        if (params.sort === "delivery_time") return a.estDeliveryMin - b.estDeliveryMin || b.orderCount - a.orderCount || byName(a, b);
        return b.orderCount - a.orderCount || byName(a, b);
      });
      const start = (params.page - 1) * params.pageSize;
      return { restaurants: rows.slice(start, start + params.pageSize), total: rows.length };
    },
    async findDetailById(id): Promise<RestaurantDetail | null> {
      const d = data.find((x) => x.profile.id === id && isVisible(x.profile));
      if (!d) return null;
      const menuItems = [...(d.menuItems ?? [])].sort((a, b) => a.position - b.position);
      const recentRatings = [...(d.ratings ?? [])]
        .sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5);
      return { ...d.profile, menuItems, recentRatings };
    },
    async searchRestaurants(q, limit) {
      const s = q.toLowerCase();
      return active().filter((p) => p.name.toLowerCase().includes(s))
        .sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async searchDishes(q, limit) {
      const s = q.toLowerCase();
      const hits: DishHit[] = [];
      for (const d of data) {
        if (!isVisible(d.profile)) continue;
        for (const m of d.menuItems ?? []) {
          if (m.name.toLowerCase().includes(s)) {
            hits.push({ ...m, restaurant: { id: d.profile.id, name: d.profile.name } });
          }
        }
      }
      return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
    },
  };
}
