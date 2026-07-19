import type { DeliveryRepository, EligiblePartner } from "../repositories/deliveryRepository";
import type { OrderWithItems } from "../repositories/orderRepository";
import { haversineKm } from "./geo";
import { computePayoutCents, LOCATION_STALE_MS, MAX_OFFER_ATTEMPTS, OFFER_WINDOW_MS } from "./deliveryConfig";

export async function runAssignmentTick(repo: DeliveryRepository, now: Date): Promise<void> {
  await repo.expireOverduePendingOffers(now);

  const [readyOrders, eligible, activeIds] = await Promise.all([
    repo.listReadyOrders(),
    repo.listEligiblePartners(new Date(now.getTime() - LOCATION_STALE_MS)),
    repo.activePartnerUserIds(),
  ]);
  const busy = new Set(activeIds);
  const free = eligible.filter((p) => !busy.has(p.userId));

  for (const order of readyOrders) {
    const offers = await repo.listOffersForOrder(order.id);
    if (offers.some((o) => o.status === "pending" || o.status === "accepted")) continue;
    if (offers.length >= MAX_OFFER_ATTEMPTS) continue;
    if (order.restaurantLat == null || order.restaurantLng == null) continue;

    const alreadyOffered = new Set(offers.map((o) => o.partnerId));
    const candidates = free.filter((p) => !alreadyOffered.has(p.userId));
    if (candidates.length === 0) continue;

    const restaurant = { lat: order.restaurantLat, lng: order.restaurantLng };
    const nearest = nearestTo(candidates, restaurant);
    const sequence = offers.length + 1;
    await repo.createOffer({ orderId: order.id, partnerId: nearest.userId, sequence,
      expiresAt: new Date(now.getTime() + OFFER_WINDOW_MS), now });
  }
}

function nearestTo(partners: EligiblePartner[], to: { lat: number; lng: number }): EligiblePartner {
  return partners.reduce((best, p) =>
    haversineKm(p, to) < haversineKm(best, to) ? p : best);
}

type AcceptResult =
  | { ok: true; order: OrderWithItems }
  | { ok: false; code: "not_found" | "expired" | "taken" };

export async function acceptOffer(repo: DeliveryRepository, offerId: string, partnerUserId: string, now: Date): Promise<AcceptResult> {
  const offer = await repo.findOfferById(offerId);
  if (!offer || offer.partnerId !== partnerUserId) return { ok: false, code: "not_found" };
  if (offer.status !== "pending" || offer.expiresAt.getTime() <= now.getTime()) {
    if (offer.status === "pending") await repo.setOfferStatus(offer.id, "expired", now);
    return { ok: false, code: "expired" };
  }
  const order = await repo.findOrderForDelivery(offer.orderId);
  if (!order) return { ok: false, code: "not_found" };

  const distanceKm = (order.restaurantLat != null && order.restaurantLng != null &&
    order.deliveryLat != null && order.deliveryLng != null)
    ? haversineKm({ lat: order.restaurantLat, lng: order.restaurantLng }, { lat: order.deliveryLat, lng: order.deliveryLng })
    : null;
  const assigned = await repo.assignOrder(offer.orderId, partnerUserId, computePayoutCents(distanceKm), now);
  if (!assigned) { await repo.setOfferStatus(offer.id, "expired", now); return { ok: false, code: "taken" }; }

  await repo.setOfferStatus(offer.id, "accepted", now);
  await repo.expireSiblingOffers(offer.orderId, offer.id, now);
  return { ok: true, order: assigned };
}

export async function declineOffer(repo: DeliveryRepository, offerId: string, partnerUserId: string, now: Date): Promise<boolean> {
  const offer = await repo.findOfferById(offerId);
  if (!offer || offer.partnerId !== partnerUserId || offer.status !== "pending") return false;
  await repo.setOfferStatus(offer.id, "declined", now);
  return true;
}

export async function releaseOrder(repo: DeliveryRepository, orderId: string, partnerUserId: string, now: Date): Promise<OrderWithItems | null> {
  // Mark this partner's offer(s) for the order declined so the tick won't re-offer them, then free the order.
  const offers = await repo.listOffersForOrder(orderId);
  for (const o of offers) if (o.partnerId === partnerUserId && o.status === "accepted") await repo.setOfferStatus(o.id, "declined", now);
  return repo.releaseOrder(orderId, partnerUserId, now);
}
