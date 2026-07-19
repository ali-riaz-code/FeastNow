import type { Response, NextFunction, RequestHandler } from "express";
import type { User } from "@prisma/client";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface AdminRequest extends AuthenticatedRequest {
  adminUser?: User;
}

/** requireAuth + confirm the caller is an active admin (403 otherwise). */
export function createRequireAdmin(jwtSecret: string, userRepo: UserRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolveAdmin = asyncHandler(async (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = await userRepo.findById(req.userId!);
    if (!user || user.role !== "admin" || user.suspendedAt) {
      return res.status(403).json({ error: "Admin access required." });
    }
    req.adminUser = user;
    next();
  });
  return [requireAuth, resolveAdmin];
}
