import { Router } from "express";
import type { AdminRepository } from "../repositories/adminRepository";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAdmin, type AdminRequest } from "../middleware/requireAdmin";
import { asyncHandler } from "../middleware/asyncHandler";

export interface AdminRouterDeps {
  adminRepo: AdminRepository;
  userRepo: UserRepository;
  jwtSecret: string;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(deps.jwtSecret, deps.userRepo);

  router.get("/metrics", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
    const metrics = await deps.adminRepo.metrics(new Date());
    return res.status(200).json({ metrics });
  }));

  return router;
}
