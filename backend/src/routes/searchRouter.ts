import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface SearchRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

export function createSearchRouter(deps: SearchRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/", requireAuth, asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < MIN_QUERY_LENGTH) {
      return res.status(200).json({ restaurants: [], dishes: [] });
    }
    const now = new Date();
    const [restaurants, dishes] = await Promise.all([
      repo.searchRestaurants(q, RESULT_LIMIT),
      repo.searchDishes(q, RESULT_LIMIT),
    ]);
    return res.status(200).json({
      restaurants: restaurants.map((r) => toRestaurantCard(r, now)),
      dishes: dishes.map((d) => ({
        id: d.id, name: d.name, priceCents: d.priceCents, imageUrl: d.imageUrl,
        isAvailable: d.isAvailable, restaurantId: d.restaurant.id, restaurantName: d.restaurant.name,
      })),
    });
  }));

  return router;
}
