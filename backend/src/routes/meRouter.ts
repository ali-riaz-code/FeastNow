import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { isValidImageRef } from "../lib/imageRef";
import type { User } from "@prisma/client";

export interface MeRouterDeps {
  userRepo: UserRepository;
  jwtSecret: string;
}

function toMeDTO(user: User) {
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    role: user.role, avatarUrl: user.avatarUrl ?? null,
  };
}

export function createMeRouter(deps: MeRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);

  router.get("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await deps.userRepo.findById(req.userId!);
    if (!user || user.suspendedAt) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    return res.status(200).json(toMeDTO(user));
  }));

  // Update the current account's profile photo (customer & admin; riders use
  // /api/delivery/me). avatarUrl: string sets it, null clears it to initials.
  router.patch("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { avatarUrl } = req.body ?? {};
    if (avatarUrl !== null && !(typeof avatarUrl === "string" && isValidImageRef(avatarUrl))) {
      return res.status(400).json({ error: "Invalid image — upload a photo under 3 MB." });
    }
    const user = await deps.userRepo.findById(req.userId!);
    if (!user || user.suspendedAt) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    const updated = await deps.userRepo.updateAvatar(req.userId!, avatarUrl);
    return res.status(200).json(toMeDTO(updated));
  }));

  return router;
}
