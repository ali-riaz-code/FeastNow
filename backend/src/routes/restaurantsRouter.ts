import { Router } from "express";
import type { RestaurantRepository, RestaurantSort } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
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

  return router;
}
