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

function approvalRow(r: { id: string; name: string; cuisines: string[]; address: string; createdAt: Date }) {
  return { id: r.id, name: r.name, cuisines: r.cuisines, address: r.address, createdAt: r.createdAt.toISOString() };
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(deps.jwtSecret, deps.userRepo);

  router.get("/metrics", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
    const metrics = await deps.adminRepo.metrics(new Date());
    return res.status(200).json({ metrics });
  }));

  router.get("/approvals", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
    const list = await deps.adminRepo.listPendingApprovals();
    return res.status(200).json({ approvals: list.map(approvalRow) });
  }));

  router.get("/approvals/:id", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const r = await deps.adminRepo.findRestaurantById(req.params.id);
    if (!r) return res.status(404).json({ error: "Restaurant not found." });
    return res.status(200).json({ restaurant: r });
  }));

  router.post("/approvals/:id/approve", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const r = await deps.adminRepo.findRestaurantById(req.params.id);
    if (!r) return res.status(404).json({ error: "Restaurant not found." });
    const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;
    const updated = await deps.adminRepo.approveRestaurant(req.params.id, new Date(), note);
    return res.status(200).json({ restaurant: updated });
  }));

  router.post("/approvals/:id/reject", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const r = await deps.adminRepo.findRestaurantById(req.params.id);
    if (!r) return res.status(404).json({ error: "Restaurant not found." });
    const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;
    const updated = await deps.adminRepo.rejectRestaurant(req.params.id, note);
    return res.status(200).json({ restaurant: updated });
  }));

  return router;
}
