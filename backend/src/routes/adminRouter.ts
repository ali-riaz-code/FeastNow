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

function userRow(u: { id: string; name: string; email: string; phone: string; role: string; suspendedAt: Date | null; createdAt: Date }) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, suspended: u.suspendedAt != null, createdAt: u.createdAt.toISOString() };
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

  router.get("/users", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : undefined;
    const users = await deps.adminRepo.searchUsers(q, role);
    return res.status(200).json({ users: users.map(userRow) });
  }));

  router.post("/users/:id/suspend", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const target = await deps.adminRepo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if (target.role === "admin" || target.id === req.adminUser!.id) {
      return res.status(400).json({ error: "Admin accounts cannot be suspended." });
    }
    if (target.suspendedAt) return res.status(409).json({ error: "User is already suspended." });
    const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null;
    const user = await deps.adminRepo.suspendUser(target.id, new Date(), reason);
    return res.status(200).json({ user: userRow(user) });
  }));

  router.post("/users/:id/reinstate", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const target = await deps.adminRepo.findUserById(req.params.id);
    if (!target) return res.status(404).json({ error: "User not found." });
    if (!target.suspendedAt) return res.status(409).json({ error: "User is not suspended." });
    const user = await deps.adminRepo.reinstateUser(target.id);
    return res.status(200).json({ user: userRow(user) });
  }));

  router.get("/reviews", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
    const rows = await deps.adminRepo.searchReviews(q);
    return res.status(200).json({ reviews: rows.map((r) => ({
      id: r.id, stars: r.stars, reviewText: r.reviewText, authorName: r.authorName,
      createdAt: r.createdAt.toISOString(), restaurantId: r.restaurantId, restaurantName: r.restaurantName,
    })) });
  }));

  router.delete("/reviews/:id", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
    const review = await deps.adminRepo.findReviewById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found." });
    await deps.adminRepo.removeReview(req.params.id);
    return res.status(204).send();
  }));

  return router;
}
