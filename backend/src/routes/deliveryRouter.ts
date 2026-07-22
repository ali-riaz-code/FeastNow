import { Router } from "express";
import type { DeliveryRepository, PartnerView } from "../repositories/deliveryRepository";
import { createRequirePartner, type PartnerRequest } from "../middleware/requirePartner";
import { asyncHandler } from "../middleware/asyncHandler";
import { toActiveDeliveryDTO, toEarningsDTO, toOfferDTO, toPartnerDTO } from "../lib/deliveryDTO";
import { isValidImageRef } from "../lib/imageRef";
import { toOrderDTO } from "../lib/orderDTO";
import { LOCATION_STALE_MS } from "../lib/deliveryConfig";
import { runAssignmentTick, acceptOffer, declineOffer, releaseOrder } from "../lib/deliveryAssignment";
import type { Response } from "express";

export interface DeliveryRouterDeps {
  deliveryRepo: DeliveryRepository;
  jwtSecret: string;
}

const VEHICLES = ["bike", "motorcycle", "car"];

export function createDeliveryRouter(deps: DeliveryRouterDeps): Router {
  const router = Router();
  const requirePartner = createRequirePartner(deps.jwtSecret, deps.deliveryRepo);

  router.get("/me", requirePartner, asyncHandler(async (req: PartnerRequest, res) =>
    res.status(200).json({ partner: toPartnerDTO(req.partner!) })));

  router.patch("/me", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { name, phone, vehicleType, avatarUrl } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof phone !== "string" || !phone.trim() ||
        typeof vehicleType !== "string" || !VEHICLES.includes(vehicleType)) {
      return res.status(400).json({ error: "Name, phone, and vehicle type are required." });
    }
    // avatarUrl is optional: undefined leaves it unchanged, null clears it, a string must be a valid image.
    if (avatarUrl !== undefined && avatarUrl !== null && !(typeof avatarUrl === "string" && isValidImageRef(avatarUrl))) {
      return res.status(400).json({ error: "Invalid image — upload a photo under 3 MB." });
    }
    const updated = await deps.deliveryRepo.updateProfile(req.partner!.userId,
      { name: name.trim(), phone: phone.trim(), vehicleType: vehicleType as PartnerView["vehicleType"],
        ...(avatarUrl !== undefined ? { avatarUrl } : {}) });
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  router.post("/location", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { lat, lng } = req.body ?? {};
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng must be numbers." });
    }
    const updated = await deps.deliveryRepo.updateLocation(req.partner!.userId, lat, lng, new Date());
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  router.post("/availability", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { status } = req.body ?? {};
    if (status !== "online" && status !== "offline") {
      return res.status(400).json({ error: "status must be online or offline." });
    }
    if (status === "online") {
      if (req.partner!.approvedAt == null) {
        return res.status(403).json({ error: "not_approved", message: "Your rider account is pending approval." });
      }
      const fresh = req.partner!.locationUpdatedAt &&
        Date.now() - req.partner!.locationUpdatedAt.getTime() < LOCATION_STALE_MS;
      if (!fresh) {
        return res.status(409).json({ error: "location_required", message: "Share your location before going online." });
      }
    }
    if (status === "offline") {
      const active = await deps.deliveryRepo.findActiveForPartner(req.partner!.userId);
      if (active) {
        return res.status(409).json({ error: "delivery_in_progress", message: "Finish your active delivery before going offline." });
      }
    }
    const updated = await deps.deliveryRepo.setAvailability(req.partner!.userId, status);
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  router.get("/offers", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    await runAssignmentTick(deps.deliveryRepo, new Date()); // the lazy engine tick
    const offers = await deps.deliveryRepo.listPendingOffersForPartner(req.partner!.userId);
    const dtos = await Promise.all(offers.map(async (o) => {
      const order = await deps.deliveryRepo.findOrderForDelivery(o.orderId);
      return order ? toOfferDTO(o, {
        orderNumber: order.orderNumber, restaurantName: order.restaurant.name,
        partnerLat: req.partner!.currentLat, partnerLng: req.partner!.currentLng,
        restaurantLat: order.restaurantLat, restaurantLng: order.restaurantLng,
        deliveryLat: order.deliveryLat, deliveryLng: order.deliveryLng,
      }) : null;
    }));
    return res.status(200).json({ offers: dtos.filter(Boolean) });
  }));

  router.post("/offers/:id/accept", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const result = await acceptOffer(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 409;
      return res.status(status).json({ error: result.code });
    }
    return res.status(200).json({ order: toOrderDTO(result.order) });
  }));

  router.post("/offers/:id/decline", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const ok = await declineOffer(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
    if (!ok) return res.status(404).json({ error: "not_found" });
    return res.status(200).json({ ok: true });
  }));

  router.get("/active", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const active = await deps.deliveryRepo.findActiveForPartner(req.partner!.userId);
    return res.status(200).json({ active: active ? toActiveDeliveryDTO(active) : null });
  }));

  const move = async (
    req: PartnerRequest, res: Response,
    from: "assigned" | "out_for_delivery", to: "out_for_delivery" | "delivered", proofNote?: string,
  ) => {
    const updated = await deps.deliveryRepo.deliveryTransition(req.params.id, req.partner!.userId, from, to, new Date(), proofNote);
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this delivery." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  };

  router.post("/orders/:id/pickup", requirePartner, asyncHandler((req: PartnerRequest, res) =>
    move(req, res, "assigned", "out_for_delivery")));

  router.post("/orders/:id/deliver", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { note } = req.body ?? {};
    if (note !== undefined && (typeof note !== "string" || note.length > 300)) {
      return res.status(400).json({ error: "Note too long." });
    }
    return move(req, res, "out_for_delivery", "delivered", typeof note === "string" ? note.trim() : undefined);
  }));

  router.post("/orders/:id/unable", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const released = await releaseOrder(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
    if (!released) return res.status(409).json({ error: "no_active_delivery" });
    return res.status(200).json({ order: toOrderDTO(released) });
  }));

  router.get("/earnings", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const rows = await deps.deliveryRepo.listDeliveredForPartner(req.partner!.userId);
    return res.status(200).json(toEarningsDTO(rows, new Date()));
  }));

  return router;
}
