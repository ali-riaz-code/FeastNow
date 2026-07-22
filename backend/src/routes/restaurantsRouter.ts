import { Router } from "express";
import type { MenuItem } from "@prisma/client";
import type { RestaurantRepository, RestaurantSort } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { isOpenNow } from "../lib/openHours";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface RestaurantsRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const PAGE_SIZE = 12;
const SORTS: RestaurantSort[] = ["popular", "rating", "delivery_time"];

export function createRestaurantsRouter(deps: RestaurantsRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/", requireAuth, asyncHandler(async (req, res) => {
    const sort = (req.query.sort ?? "popular") as string;
    if (!SORTS.includes(sort as RestaurantSort)) {
      return res.status(400).json({ error: "sort must be one of: popular, rating, delivery_time." });
    }
    const rawPage = req.query.page ?? "1";
    const page = Number(rawPage);
    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: "page must be a positive integer." });
    }
    const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
      ? req.query.search.trim() : undefined;
    const cuisine = typeof req.query.cuisine === "string" && req.query.cuisine.trim() !== ""
      ? req.query.cuisine.trim() : undefined;

    const now = new Date();
    const { restaurants, total } = await repo.list({
      search, cuisine, sort: sort as RestaurantSort, page, pageSize: PAGE_SIZE,
    });
    return res.status(200).json({
      restaurants: restaurants.map((r) => toRestaurantCard(r, now)),
      page, pageSize: PAGE_SIZE, total,
    });
  }));

  router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
    const detail = await repo.findDetailById(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: "Restaurant not found." });
    }
    return res.status(200).json({
      id: detail.id, name: detail.name, description: detail.description,
      address: detail.address, cuisines: detail.cuisines,
      avgRating: detail.avgRating, ratingCount: detail.ratingCount,
      estDeliveryMin: detail.estDeliveryMin, heroImageUrl: detail.heroImageUrl,
      opensAt: detail.opensAt, closesAt: detail.closesAt,
      isOpenNow: detail.isOnline && isOpenNow(detail.opensAt, detail.closesAt),
      menu: groupMenu(detail.menuItems),
      reviews: detail.recentRatings.map((rt) => ({
        id: rt.id, stars: rt.stars, reviewText: rt.reviewText,
        authorName: rt.authorName, createdAt: rt.createdAt,
      })),
    });
  }));

  return router;
}

interface MenuItemDTO {
  id: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean;
}

// Items arrive position-sorted; categories keep first-occurrence order.
function groupMenu(items: MenuItem[]): { category: string; items: MenuItemDTO[] }[] {
  const groups: { category: string; items: MenuItemDTO[] }[] = [];
  const byCategory = new Map<string, MenuItemDTO[]>();
  for (const item of items) {
    let bucket = byCategory.get(item.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(item.category, bucket);
      groups.push({ category: item.category, items: bucket });
    }
    bucket.push({
      id: item.id, name: item.name, description: item.description,
      priceCents: item.priceCents, imageUrl: item.imageUrl, isAvailable: item.isAvailable,
    });
  }
  return groups;
}
