import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface MeRouterDeps {
  userRepo: UserRepository;
  jwtSecret: string;
}

export function createMeRouter(deps: MeRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);

  router.get("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = await deps.userRepo.findById(req.userId!);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    return res.status(200).json({ id: user.id, name: user.name, email: user.email, phone: user.phone });
  }));

  return router;
}
