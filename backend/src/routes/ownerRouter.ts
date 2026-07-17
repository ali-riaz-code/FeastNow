import { Router } from "express";
import type { RestaurantProfile } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";
import { AUTO_APPROVE_AFTER_MS } from "../lib/orderStateMachine";

export interface OwnerRouterDeps {
  ownerRepo: OwnerRepository;
  jwtSecret: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const REVIEWS_LIMIT = 20;

export function toOwnerProfileDTO(p: RestaurantProfile) {
  return {
    id: p.id, name: p.name, description: p.description, address: p.address,
    cuisines: p.cuisines, opensAt: p.opensAt, closesAt: p.closesAt,
    isOnline: p.isOnline, approvalStatus: p.approvalStatus,
    avgRating: p.avgRating, ratingCount: p.ratingCount, estDeliveryMin: p.estDeliveryMin,
  };
}

export function createOwnerRouter(deps: OwnerRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  router.get("/me", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    let profile = req.ownerProfile!;
    // Lazy auto-approve (spec §3): stands in for the Admin review until that phase ships.
    if (profile.approvalStatus === "pending" &&
        Date.now() - profile.createdAt.getTime() >= AUTO_APPROVE_AFTER_MS) {
      profile = await deps.ownerRepo.approve(profile.id, new Date());
    }
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.patch("/profile", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { name, description, address, cuisines, opensAt, closesAt } = req.body ?? {};
    if (
      typeof name !== "string" || !name.trim() ||
      typeof description !== "string" ||
      typeof address !== "string" || !address.trim() ||
      !Array.isArray(cuisines) || cuisines.length === 0 || !cuisines.every((c) => typeof c === "string" && c.trim()) ||
      typeof opensAt !== "string" || !HHMM.test(opensAt) ||
      typeof closesAt !== "string" || !HHMM.test(closesAt)
    ) {
      return res.status(400).json({ error: "Missing or invalid profile details." });
    }
    const profile = await deps.ownerRepo.updateProfile(req.ownerProfile!.id, {
      name: name.trim(), description: description.trim(), address: address.trim(),
      cuisines: cuisines.map((c: string) => c.trim()), opensAt, closesAt,
    });
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.patch("/store-status", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { isOnline } = req.body ?? {};
    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ error: "isOnline must be a boolean." });
    }
    const profile = await deps.ownerRepo.setOnline(req.ownerProfile!.id, isOnline);
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.get("/reviews", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const reviews = await deps.ownerRepo.listRatings(req.ownerProfile!.id, REVIEWS_LIMIT);
    return res.status(200).json({
      reviews: reviews.map((r) => ({
        id: r.id, stars: r.stars, reviewText: r.reviewText,
        authorName: r.authorName, createdAt: r.createdAt.toISOString(),
      })),
    });
  }));

  return router;
}
