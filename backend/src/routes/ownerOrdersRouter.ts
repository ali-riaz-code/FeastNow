import { Router } from "express";
import type { OrderStatus } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import type { OrderRepository, OrderWithItems } from "../repositories/orderRepository";
import type { DeliveryRepository } from "../repositories/deliveryRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";
import { canTransition, EXPIRY_REJECTION_REASON, REJECTION_REASONS } from "../lib/orderStateMachine";
import { runAssignmentTick } from "../lib/deliveryAssignment";
import { toOrderDTO } from "../lib/orderDTO";

export interface OwnerOrdersRouterDeps {
  ownerRepo: OwnerRepository;
  orderRepo: OrderRepository;
  deliveryRepo: DeliveryRepository;
  jwtSecret: string;
}

const PAGE_SIZE = 20;

const TAB_STATUSES: Record<string, OrderStatus[]> = {
  new: ["placed"],
  preparing: ["accepted", "preparing"],
  ready: ["ready"],
  history: ["rejected", "cancelled", "delivered"],
  all: ["placed", "accepted", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "rejected", "cancelled"],
};

export function createOwnerOrdersRouter(deps: OwnerOrdersRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  /** Load + ownership-check an order, sweeping its expiry first. */
  async function loadOwn(req: OwnerRequest): Promise<OrderWithItems | null> {
    await deps.orderRepo.expireOverdue(new Date(), { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.restaurantId !== req.ownerProfile!.id) return null;
    return order;
  }

  router.get("/", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const rid = req.ownerProfile!.id;
    const tab = String(req.query.tab ?? "new");
    const statuses = TAB_STATUSES[tab];
    if (!statuses) return res.status(400).json({ error: "Unknown tab." });
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);

    await deps.orderRepo.expireOverdue(new Date(), { restaurantId: rid });
    const [{ orders, total }, counts] = await Promise.all([
      deps.orderRepo.listForRestaurant(rid, statuses, q, page, PAGE_SIZE),
      deps.orderRepo.countByStatus(rid),
    ]);
    return res.status(200).json({
      orders: orders.map(toOrderDTO), total, page, pageSize: PAGE_SIZE,
      counts: {
        new: counts.placed ?? 0,
        preparing: (counts.accepted ?? 0) + (counts.preparing ?? 0),
        ready: counts.ready ?? 0,
      },
    });
  }));

  router.get("/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    return res.status(200).json({ order: toOrderDTO(order) });
  }));

  router.post("/:id/accept", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.status === "rejected" && order.rejectionReason === EXPIRY_REJECTION_REASON) {
      // The just-swept case: it expired before the restaurant tapped Accept.
      return res.status(409).json({ error: "order_expired", message: "This order timed out and was auto-rejected." });
    }
    if (!canTransition(order.status, "accepted", "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can't be accepted anymore." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "accepted", new Date());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can't be accepted anymore." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  router.post("/:id/reject", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { reason } = req.body ?? {};
    if (typeof reason !== "string" || !reason.trim() || reason.length > 200) {
      return res.status(400).json({ error: `A reason is required (e.g. ${REJECTION_REASONS.join(", ")}).` });
    }
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, "rejected", "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can't be rejected anymore." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "rejected", new Date(), reason.trim());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can't be rejected anymore." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  router.post("/:id/status", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { to } = req.body ?? {};
    if (to !== "preparing" && to !== "ready") {
      return res.status(400).json({ error: "to must be \"preparing\" or \"ready\"." });
    }
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, to, "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this order." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, to, new Date());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this order." });
    // Marking an order ready triggers delivery assignment (offer to the nearest online partner).
    if (to === "ready") await runAssignmentTick(deps.deliveryRepo, new Date());
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  return router;
}
