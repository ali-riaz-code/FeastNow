import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import type { OrderRepository } from "../repositories/orderRepository";
import type { PromoRepository } from "../repositories/promoRepository";
import { createRequireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { canTransition, ORDER_EXPIRY_MS } from "../lib/orderStateMachine";
import { computeOrderTotals } from "../lib/orderPricing";
import { computeDiscountCents, promoInvalidReason } from "../lib/promo";
import { toOrderDTO } from "../lib/orderDTO";
import { isOpenNow } from "../lib/openHours";

export interface CustomerOrdersRouterDeps {
  restaurantRepo: RestaurantRepository;
  orderRepo: OrderRepository;
  promoRepo: PromoRepository;
  jwtSecret: string;
}

const MAX_CODE = 40;
const PROMO_INVALID_MESSAGE: Record<string, string> = {
  not_found: "That promo code isn't valid.",
  inactive: "That promo code is no longer active.",
  expired: "That promo code has expired.",
};

const PAGE_SIZE = 20;
const MAX_ITEMS = 50;
const MAX_QTY = 20;
const MAX_NOTE = 500;
const MAX_ADDRESS = 300;

export function createCustomerOrdersRouter(deps: CustomerOrdersRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);

  router.post("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { restaurantId, items, note, deliveryAddress, deliveryLat, deliveryLng, promoCode } = req.body ?? {};
    const validItems = Array.isArray(items) && items.length > 0 && items.length <= MAX_ITEMS &&
      items.every((i) => i && typeof i.menuItemId === "string" &&
        Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= MAX_QTY);
    // Dropoff coords are optional, but must arrive as a complete finite pair when present.
    const hasLat = deliveryLat !== undefined && deliveryLat !== null;
    const hasLng = deliveryLng !== undefined && deliveryLng !== null;
    const validCoords = (!hasLat && !hasLng) ||
      (hasLat && hasLng && Number.isFinite(deliveryLat) && Number.isFinite(deliveryLng));
    if (
      typeof restaurantId !== "string" || !validItems || !validCoords ||
      typeof deliveryAddress !== "string" || !deliveryAddress.trim() || deliveryAddress.length > MAX_ADDRESS ||
      (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE)) ||
      (promoCode !== undefined && promoCode !== null && (typeof promoCode !== "string" || promoCode.length > MAX_CODE))
    ) {
      return res.status(400).json({ error: "Missing or invalid order details." });
    }

    const detail = await deps.restaurantRepo.findDetailById(restaurantId);
    if (!detail) return res.status(404).json({ error: "Restaurant not found." });
    if (!detail.isOnline || !isOpenNow(detail.opensAt, detail.closesAt)) {
      return res.status(409).json({ error: "restaurant_closed", message: `${detail.name} isn't taking orders right now.` });
    }

    const menuById = new Map(detail.menuItems.map((m) => [m.id, m]));
    const unavailable = (items as { menuItemId: string }[])
      .map((i) => i.menuItemId)
      .filter((id) => !menuById.get(id)?.isAvailable);
    if (unavailable.length > 0) {
      return res.status(409).json({
        error: "items_unavailable", itemIds: unavailable,
        message: "Some items in your basket are no longer available.",
      });
    }

    // Server-authoritative pricing: client-sent prices are ignored entirely.
    const lines = (items as { menuItemId: string; quantity: number }[]).map((i) => {
      const m = menuById.get(i.menuItemId)!;
      return { menuItemId: m.id, nameSnapshot: m.name, priceAtOrderCents: m.priceCents, quantity: i.quantity };
    });
    const subtotalCents = lines.reduce((sum, l) => sum + l.priceAtOrderCents * l.quantity, 0);

    // Re-validate the promo against server-authoritative pricing. A code that went
    // bad between "Apply" and "Place" is rejected so the cart can drop it and retry.
    let promoCodeId: string | null = null;
    let discountCents = 0;
    const trimmedCode = typeof promoCode === "string" ? promoCode.trim().toUpperCase() : "";
    if (trimmedCode) {
      const promo = await deps.promoRepo.findByCode(trimmedCode);
      const reason = promoInvalidReason(promo, new Date());
      if (reason) {
        return res.status(409).json({ error: "promo_invalid", reason, message: PROMO_INVALID_MESSAGE[reason] });
      }
      promoCodeId = promo!.id;
      discountCents = computeDiscountCents(promo!, subtotalCents);
    }

    const totals = computeOrderTotals(
      lines.map((l) => ({ priceCents: l.priceAtOrderCents, quantity: l.quantity })),
      discountCents,
    );

    const order = await deps.orderRepo.create({
      customerId: req.userId!, restaurantId,
      note: (note ?? "").trim(), deliveryAddress: deliveryAddress.trim(),
      deliveryLat: hasLat ? deliveryLat : null, deliveryLng: hasLng ? deliveryLng : null,
      ...totals, promoCodeId, expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS), isDemo: detail.isDemo,
      items: lines,
    });
    return res.status(201).json({ order: toOrderDTO(order) });
  }));

  // Live promo preview for the cart. The discount is computed from the client's
  // current subtotal for display only; order creation recomputes it authoritatively.
  router.post("/promo/validate", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { code, subtotalCents } = req.body ?? {};
    if (
      typeof code !== "string" || !code.trim() || code.length > MAX_CODE ||
      !Number.isInteger(subtotalCents) || subtotalCents < 0
    ) {
      return res.status(400).json({ error: "Enter a promo code." });
    }
    const promo = await deps.promoRepo.findByCode(code.trim().toUpperCase());
    const reason = promoInvalidReason(promo, new Date());
    if (reason) {
      return res.status(reason === "not_found" ? 404 : 409)
        .json({ error: "promo_invalid", reason, message: PROMO_INVALID_MESSAGE[reason] });
    }
    return res.status(200).json({
      code: promo!.code,
      discountType: promo!.discountType,
      discountValue: promo!.discountValue,
      discountCents: computeDiscountCents(promo!, subtotalCents),
    });
  }));

  router.get("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    await deps.orderRepo.expireOverdue(new Date(), { customerId: req.userId! });
    const { orders, total } = await deps.orderRepo.listForCustomer(req.userId!, page, PAGE_SIZE);
    return res.status(200).json({ orders: orders.map(toOrderDTO), total, page, pageSize: PAGE_SIZE });
  }));

  router.get("/:id", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    await deps.orderRepo.expireOverdue(new Date(), { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.customerId !== req.userId) return res.status(404).json({ error: "Order not found." });
    return res.status(200).json({ order: toOrderDTO(order) });
  }));

  router.post("/:id/cancel", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const now = new Date();
    await deps.orderRepo.expireOverdue(now, { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.customerId !== req.userId) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, "cancelled", "customer")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can no longer be cancelled." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "cancelled", now);
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can no longer be cancelled." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  return router;
}
