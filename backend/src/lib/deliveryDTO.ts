import type { OfferRecord, PartnerView } from "../repositories/deliveryRepository";
import { haversineKm } from "./geo";
import { computePayoutCents } from "./deliveryConfig";

export function toPartnerDTO(p: PartnerView) {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    vehicleType: p.vehicleType,
    availabilityStatus: p.availabilityStatus,
    approved: p.approvedAt != null,
  };
}

export function toOfferDTO(offer: OfferRecord, ctx: {
  orderNumber: number; restaurantName: string;
  partnerLat: number | null; partnerLng: number | null;
  restaurantLat: number | null; restaurantLng: number | null;
  deliveryLat: number | null; deliveryLng: number | null;
}) {
  const km = (a: number | null, b: number | null, c: number | null, d: number | null): number | null =>
    (a != null && b != null && c != null && d != null) ? haversineKm({ lat: a, lng: b }, { lat: c, lng: d }) : null;
  const pickup = km(ctx.partnerLat, ctx.partnerLng, ctx.restaurantLat, ctx.restaurantLng);
  const dropoff = km(ctx.restaurantLat, ctx.restaurantLng, ctx.deliveryLat, ctx.deliveryLng);
  return {
    id: offer.id, orderNumber: ctx.orderNumber, restaurantName: ctx.restaurantName,
    pickupDistanceKm: pickup == null ? null : Number(pickup.toFixed(1)),
    dropoffDistanceKm: dropoff == null ? null : Number(dropoff.toFixed(1)),
    payoutCents: computePayoutCents(dropoff), expiresAt: offer.expiresAt.toISOString(),
  };
}
