import type { Response, NextFunction, RequestHandler } from "express";
import type { RestaurantProfile } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface OwnerRequest extends AuthenticatedRequest {
  ownerProfile?: RestaurantProfile;
}

/** requireAuth + resolve the caller's RestaurantProfile (403 without one).
 *  Role is implicit: only restaurant accounts have an owned profile. */
export function createRequireOwner(jwtSecret: string, ownerRepo: OwnerRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolveOwner = asyncHandler(async (req: OwnerRequest, res: Response, next: NextFunction) => {
    const profile = await ownerRepo.findProfileByUserId(req.userId!);
    if (!profile) return res.status(403).json({ error: "Not a restaurant account." });
    req.ownerProfile = profile;
    next();
  });
  return [requireAuth, resolveOwner];
}
