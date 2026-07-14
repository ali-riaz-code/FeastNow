import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface CustomerRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const SECTION_LIMIT = 10;
const NEW_WINDOW_DAYS = 30;

export function createCustomerRouter(deps: CustomerRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/home", requireAuth, asyncHandler(async (_req, res) => {
    const now = new Date();
    const since = new Date(now.getTime() - NEW_WINDOW_DAYS * 86_400_000);
    const [mostPopular, topRated, freshlyApproved, under30, cuisines] = await Promise.all([
      repo.findMostPopular(SECTION_LIMIT),
      repo.findTopRated(SECTION_LIMIT),
      repo.findNewSince(since, SECTION_LIMIT),
      repo.findUnder30(SECTION_LIMIT),
      repo.listCuisines(),
    ]);

    const sections = [
      { key: "most_popular", title: "Most Popular Near You", rows: mostPopular },
      { key: "top_rated", title: "Top Rated", rows: topRated },
      { key: "new_on_feastnow", title: "New on FeastNow", rows: freshlyApproved },
      { key: "under_30", title: "Under 30 Minutes", rows: under30 },
    ]
      .filter((s) => s.rows.length > 0)
      .map((s) => ({ key: s.key, title: s.title, restaurants: s.rows.map((r) => toRestaurantCard(r, now)) }));

    return res.status(200).json({ cuisines, sections });
  }));

  return router;
}
