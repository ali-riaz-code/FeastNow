import type { DeliveryRepository, OfferRecord, PartnerView } from "../../src/repositories/deliveryRepository";
import type { OrderWithItems } from "../../src/repositories/orderRepository";
import { makeOrder } from "./fakeOrderRepository";

let pSeq = 0, oSeq = 0;
export function makePartner(o: Partial<PartnerView> = {}): PartnerView {
  pSeq += 1;
  return { id: `dp-${pSeq}`, userId: `pu-${pSeq}`, name: "Rider", phone: "0300", vehicleType: "motorcycle",
    availabilityStatus: "online", approvedAt: new Date(), currentLat: 24.86, currentLng: 67.01,
    locationUpdatedAt: new Date(), ...o };
}
export function makeOffer(o: Partial<OfferRecord> = {}): OfferRecord {
  oSeq += 1;
  return { id: `of-${oSeq}`, orderId: "order-1", partnerId: "pu-1", status: "pending",
    sequence: 1, offeredAt: new Date(), expiresAt: new Date(Date.now() + 45_000), respondedAt: null, ...o };
}

const DEFAULT_RESTAURANT_LAT = 24.87;
const DEFAULT_RESTAURANT_LNG = 67.02;
const DEFAULT_RESTAURANT_PHONE = "0311";

function withRestaurant(o: OrderWithItems) {
  return {
    ...o,
    restaurantLat: DEFAULT_RESTAURANT_LAT,
    restaurantLng: DEFAULT_RESTAURANT_LNG,
    restaurantPhone: DEFAULT_RESTAURANT_PHONE,
  };
}

export function createFakeDeliveryRepository(
  partners: PartnerView[] = [], offers: OfferRecord[] = [], orders: OrderWithItems[] = [],
): DeliveryRepository & { partners: PartnerView[]; offers: OfferRecord[]; orders: OrderWithItems[] } {
  return {
    partners, offers, orders,

    // ---- profile ----
    async findByUserId(userId) {
      return partners.find((p) => p.userId === userId) ?? null;
    },
    async updateProfile(userId, { name, phone, vehicleType }) {
      const p = partners.find((x) => x.userId === userId);
      if (!p) throw new Error(`partner not found: ${userId}`);
      p.name = name; p.phone = phone; p.vehicleType = vehicleType;
      return p;
    },
    async setAvailability(userId, status) {
      const p = partners.find((x) => x.userId === userId);
      if (!p) throw new Error(`partner not found: ${userId}`);
      p.availabilityStatus = status;
      return p;
    },
    async updateLocation(userId, lat, lng, now) {
      const p = partners.find((x) => x.userId === userId);
      if (!p) throw new Error(`partner not found: ${userId}`);
      p.currentLat = lat; p.currentLng = lng; p.locationUpdatedAt = now;
      return p;
    },

    // ---- assignment inputs ----
    async listReadyOrders() {
      return orders.filter((o) => o.status === "ready").map((o) => ({
        id: o.id,
        restaurantLat: DEFAULT_RESTAURANT_LAT, restaurantLng: DEFAULT_RESTAURANT_LNG,
        deliveryLat: o.deliveryLat, deliveryLng: o.deliveryLng,
      }));
    },
    async listEligiblePartners(freshSince) {
      return partners
        .filter((p) => p.availabilityStatus === "online" && p.approvedAt !== null
          && p.currentLat !== null && p.currentLng !== null
          && p.locationUpdatedAt !== null && p.locationUpdatedAt.getTime() >= freshSince.getTime())
        .map((p) => ({ userId: p.userId, lat: p.currentLat!, lng: p.currentLng! }));
    },
    async activePartnerUserIds() {
      return orders
        .filter((o) => (o.status === "assigned" || o.status === "out_for_delivery") && o.deliveryPartnerId)
        .map((o) => o.deliveryPartnerId!);
    },

    // ---- offers ----
    async listOffersForOrder(orderId) {
      return offers.filter((o) => o.orderId === orderId).sort((a, b) => a.sequence - b.sequence);
    },
    async listPendingOffersForPartner(userId) {
      return offers.filter((o) => o.partnerId === userId && o.status === "pending");
    },
    async findOfferById(id) {
      return offers.find((o) => o.id === id) ?? null;
    },
    async createOffer(data) {
      const offer = makeOffer({
        orderId: data.orderId, partnerId: data.partnerId, sequence: data.sequence,
        offeredAt: data.now, expiresAt: data.expiresAt, status: "pending", respondedAt: null,
      });
      offers.push(offer);
      return offer;
    },
    async setOfferStatus(id, status, now) {
      const o = offers.find((x) => x.id === id);
      if (!o) return;
      o.status = status; o.respondedAt = now;
    },
    async expireOverduePendingOffers(now) {
      const changed: OfferRecord[] = [];
      for (const o of offers) {
        if (o.status === "pending" && o.expiresAt.getTime() <= now.getTime()) {
          o.status = "expired"; o.respondedAt = now;
          changed.push(o);
        }
      }
      return changed;
    },
    async expireSiblingOffers(orderId, exceptId, now) {
      for (const o of offers) {
        if (o.orderId === orderId && o.id !== exceptId && o.status === "pending") {
          o.status = "expired"; o.respondedAt = now;
        }
      }
    },

    // ---- order delivery ops ----
    async findOrderForDelivery(orderId) {
      const o = orders.find((x) => x.id === orderId);
      return o ? withRestaurant(o) : null;
    },
    async assignOrder(orderId, partnerUserId, payoutCents, now) {
      const o = orders.find((x) => x.id === orderId);
      if (!o || o.status !== "ready") return null;
      o.status = "assigned"; o.deliveryPartnerId = partnerUserId; o.assignedAt = now; o.payoutCents = payoutCents;
      return o;
    },
    async deliveryTransition(orderId, partnerUserId, from, to, now, proofNote) {
      const o = orders.find((x) => x.id === orderId);
      if (!o || o.status !== from || o.deliveryPartnerId !== partnerUserId) return null;
      o.status = to;
      if (to === "out_for_delivery") o.outForDeliveryAt = now;
      else o.deliveredAt = now;
      if (proofNote !== undefined) o.proofNote = proofNote;
      return o;
    },
    async releaseOrder(orderId, partnerUserId, now) {
      const o = orders.find((x) => x.id === orderId);
      if (!o || o.deliveryPartnerId !== partnerUserId
        || (o.status !== "assigned" && o.status !== "out_for_delivery")) return null;
      o.status = "ready"; o.deliveryPartnerId = null; o.assignedAt = null; o.outForDeliveryAt = null; o.payoutCents = null;
      return o;
    },
    async findActiveForPartner(userId) {
      const o = orders.find((x) => x.deliveryPartnerId === userId
        && (x.status === "assigned" || x.status === "out_for_delivery"));
      return o ? withRestaurant(o) : null;
    },
    async listDeliveredForPartner(userId) {
      return orders
        .filter((o) => o.deliveryPartnerId === userId && o.status === "delivered")
        .sort((a, b) => (b.deliveredAt?.getTime() ?? 0) - (a.deliveredAt?.getTime() ?? 0))
        .map((o) => ({
          id: o.id, orderNumber: o.orderNumber, restaurantName: o.restaurant.name,
          payoutCents: o.payoutCents ?? 0, deliveredAt: o.deliveredAt ?? new Date(0),
        }));
    },
  };
}
