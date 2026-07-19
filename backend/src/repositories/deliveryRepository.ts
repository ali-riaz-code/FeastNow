import type { AvailabilityStatus, OfferStatus, PrismaClient, VehicleType } from "@prisma/client";
import type { OrderWithItems } from "./orderRepository";

export interface PartnerView {
  id: string; userId: string; name: string; phone: string;
  vehicleType: VehicleType; availabilityStatus: AvailabilityStatus;
  approvedAt: Date | null;
  currentLat: number | null; currentLng: number | null; locationUpdatedAt: Date | null;
}
export interface EligiblePartner { userId: string; lat: number; lng: number; }
export interface OfferRecord {
  id: string; orderId: string; partnerId: string; status: OfferStatus;
  sequence: number; offeredAt: Date; expiresAt: Date; respondedAt: Date | null;
}
export interface ReadyOrder { id: string; restaurantLat: number | null; restaurantLng: number | null;
  deliveryLat: number | null; deliveryLng: number | null; }

export interface DeliveryRepository {
  // profile
  findByUserId(userId: string): Promise<PartnerView | null>;
  updateProfile(userId: string, data: { name: string; phone: string; vehicleType: VehicleType }): Promise<PartnerView>;
  setAvailability(userId: string, status: AvailabilityStatus): Promise<PartnerView>;
  updateLocation(userId: string, lat: number, lng: number, now: Date): Promise<PartnerView>;
  // assignment inputs
  listReadyOrders(): Promise<ReadyOrder[]>;
  listEligiblePartners(freshSince: Date): Promise<EligiblePartner[]>;
  activePartnerUserIds(): Promise<string[]>;                  // partners on an assigned/out_for_delivery order
  // offers
  listOffersForOrder(orderId: string): Promise<OfferRecord[]>;
  listPendingOffersForPartner(userId: string): Promise<OfferRecord[]>;
  findOfferById(id: string): Promise<OfferRecord | null>;
  createOffer(data: { orderId: string; partnerId: string; sequence: number; expiresAt: Date; now: Date }): Promise<OfferRecord>;
  setOfferStatus(id: string, status: OfferStatus, now: Date): Promise<void>;
  expireOverduePendingOffers(now: Date): Promise<OfferRecord[]>; // returns the ones it expired
  expireSiblingOffers(orderId: string, exceptId: string, now: Date): Promise<void>;
  // order delivery ops
  findOrderForDelivery(orderId: string): Promise<(OrderWithItems & { restaurantLat: number | null; restaurantLng: number | null; restaurantPhone: string | null }) | null>;
  assignOrder(orderId: string, partnerUserId: string, payoutCents: number, now: Date): Promise<OrderWithItems | null>; // guarded: only while status=ready
  deliveryTransition(orderId: string, partnerUserId: string, from: "assigned" | "out_for_delivery", to: "out_for_delivery" | "delivered", now: Date, proofNote?: string): Promise<OrderWithItems | null>;
  releaseOrder(orderId: string, partnerUserId: string, now: Date): Promise<OrderWithItems | null>; // active → back to ready
  findActiveForPartner(userId: string): Promise<(OrderWithItems & { restaurantLat: number | null; restaurantLng: number | null; restaurantPhone: string | null }) | null>;
  listDeliveredForPartner(userId: string): Promise<{ id: string; orderNumber: number; restaurantName: string; payoutCents: number; deliveredAt: Date }[]>;
}

const ORDER_INCLUDE = {
  items: true,
  customer: { select: { name: true, phone: true } },
  restaurant: { select: { name: true } },
} as const;

// Restaurant projection carrying the extra lat/lng fields the delivery flows need,
// layered on top of ORDER_INCLUDE (overrides its `restaurant` select).
// NOTE: RestaurantProfile has no `user` relation (only a scalar `userId String?`), so the
// owner's phone is resolved via a separate User lookup — same pattern as findByUserId.
const DELIVERY_ORDER_INCLUDE = {
  ...ORDER_INCLUDE,
  restaurant: { select: { name: true, address: true, lat: true, lng: true, userId: true } },
} as const;

function withDeliveryRestaurant(prisma: PrismaClient) {
  return async (o: {
    restaurant: { name: string; address: string; lat: number | null; lng: number | null; userId: string | null };
  } | null) => {
    if (!o) return null;
    const owner = o.restaurant.userId
      ? await prisma.user.findUnique({ where: { id: o.restaurant.userId }, select: { phone: true } })
      : null; // seeded restaurants have no owner account
    return {
      ...o,
      restaurantLat: o.restaurant.lat,
      restaurantLng: o.restaurant.lng,
      restaurantPhone: owner?.phone ?? null,
    } as never;
  };
}

export function createDeliveryRepository(prisma: PrismaClient): DeliveryRepository {
  return {
    // ---- profile ----
    findByUserId(userId) {
      return prisma.deliveryPartnerProfile.findUnique({
        where: { userId },
        // No Prisma relation exists between DeliveryPartnerProfile and User; fetch the user separately below.
      }).then(async (p) => p && {
        id: p.id, userId: p.userId,
        ...(await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } }))!,
        vehicleType: p.vehicleType, availabilityStatus: p.availabilityStatus, approvedAt: p.approvedAt,
        currentLat: p.currentLat, currentLng: p.currentLng, locationUpdatedAt: p.locationUpdatedAt,
      });
    },
    async updateProfile(userId, { name, phone, vehicleType }) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { name, phone } }),
        prisma.deliveryPartnerProfile.update({ where: { userId }, data: { vehicleType } }),
      ]);
      return this.findByUserId(userId) as Promise<PartnerView>;
    },
    async setAvailability(userId, status) {
      await prisma.deliveryPartnerProfile.update({ where: { userId }, data: { availabilityStatus: status } });
      return this.findByUserId(userId) as Promise<PartnerView>;
    },
    async updateLocation(userId, lat, lng, now) {
      await prisma.deliveryPartnerProfile.update({
        where: { userId },
        data: { currentLat: lat, currentLng: lng, locationUpdatedAt: now },
      });
      return this.findByUserId(userId) as Promise<PartnerView>;
    },

    // ---- assignment inputs ----
    listReadyOrders() {
      return prisma.order.findMany({
        where: { status: "ready" },
        select: { id: true, deliveryLat: true, deliveryLng: true, restaurant: { select: { lat: true, lng: true } } },
      }).then((rows) => rows.map((o) => ({ id: o.id, deliveryLat: o.deliveryLat, deliveryLng: o.deliveryLng,
        restaurantLat: o.restaurant.lat, restaurantLng: o.restaurant.lng })));
    },
    listEligiblePartners(freshSince) {
      return prisma.deliveryPartnerProfile.findMany({
        where: { availabilityStatus: "online", approvedAt: { not: null },
          currentLat: { not: null }, currentLng: { not: null },
          locationUpdatedAt: { gte: freshSince } },
        select: { userId: true, currentLat: true, currentLng: true },
      }).then((rows) => rows.map((r) => ({ userId: r.userId, lat: r.currentLat!, lng: r.currentLng! })));
    },
    activePartnerUserIds() {
      return prisma.order.findMany({
        where: { status: { in: ["assigned", "out_for_delivery"] }, deliveryPartnerId: { not: null } },
        select: { deliveryPartnerId: true },
      }).then((rows) => rows.map((r) => r.deliveryPartnerId!).filter(Boolean));
    },

    // ---- offers ----
    listOffersForOrder(orderId) {
      return prisma.deliveryOffer.findMany({ where: { orderId }, orderBy: { sequence: "asc" } });
    },
    listPendingOffersForPartner(userId) {
      return prisma.deliveryOffer.findMany({ where: { partnerId: userId, status: "pending" } });
    },
    findOfferById(id) {
      return prisma.deliveryOffer.findUnique({ where: { id } });
    },
    createOffer(data) {
      return prisma.deliveryOffer.create({
        data: {
          orderId: data.orderId, partnerId: data.partnerId, sequence: data.sequence,
          offeredAt: data.now, expiresAt: data.expiresAt,
        },
      });
    },
    async setOfferStatus(id, status, now) {
      await prisma.deliveryOffer.update({ where: { id }, data: { status, respondedAt: now } });
    },
    async expireOverduePendingOffers(now) {
      const rows = await prisma.deliveryOffer.findMany({
        where: { status: "pending", expiresAt: { lte: now } },
      });
      if (rows.length === 0) return [];
      await prisma.deliveryOffer.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: "expired", respondedAt: now },
      });
      return rows.map((r) => ({ ...r, status: "expired" as const, respondedAt: now }));
    },
    async expireSiblingOffers(orderId, exceptId, now) {
      await prisma.deliveryOffer.updateMany({
        where: { orderId, id: { not: exceptId }, status: "pending" },
        data: { status: "expired", respondedAt: now },
      });
    },

    // ---- order delivery ops ----
    findOrderForDelivery(orderId) {
      return prisma.order.findUnique({
        where: { id: orderId },
        include: DELIVERY_ORDER_INCLUDE,
      }).then(withDeliveryRestaurant(prisma));
    },
    async assignOrder(orderId, partnerUserId, payoutCents, now) {
      const { count } = await prisma.order.updateMany({
        where: { id: orderId, status: "ready" },
        data: { status: "assigned", deliveryPartnerId: partnerUserId, assignedAt: now, payoutCents },
      });
      if (count === 0) return null;
      return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    },
    async deliveryTransition(orderId, partnerUserId, from, to, now, proofNote) {
      const data: Record<string, unknown> = { status: to };
      data[to === "out_for_delivery" ? "outForDeliveryAt" : "deliveredAt"] = now;
      if (proofNote !== undefined) data.proofNote = proofNote;
      const { count } = await prisma.order.updateMany({
        where: { id: orderId, status: from, deliveryPartnerId: partnerUserId }, data });
      if (count === 0) return null;
      return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    },
    async releaseOrder(orderId, partnerUserId, now) {
      const { count } = await prisma.order.updateMany({
        where: { id: orderId, deliveryPartnerId: partnerUserId, status: { in: ["assigned", "out_for_delivery"] } },
        data: { status: "ready", deliveryPartnerId: null, assignedAt: null, outForDeliveryAt: null, payoutCents: null } });
      if (count === 0) return null;
      return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    },
    findActiveForPartner(userId) {
      return prisma.order.findFirst({
        where: { deliveryPartnerId: userId, status: { in: ["assigned", "out_for_delivery"] } },
        include: DELIVERY_ORDER_INCLUDE,
      }).then(withDeliveryRestaurant(prisma));
    },
    listDeliveredForPartner(userId) {
      return prisma.order.findMany({
        where: { deliveryPartnerId: userId, status: "delivered" },
        select: { id: true, orderNumber: true, payoutCents: true, deliveredAt: true, restaurant: { select: { name: true } } },
        orderBy: { deliveredAt: "desc" },
      }).then((rows) => rows.map((r) => ({
        id: r.id, orderNumber: r.orderNumber, restaurantName: r.restaurant.name,
        payoutCents: r.payoutCents ?? 0, deliveredAt: r.deliveredAt ?? new Date(0),
      })));
    },
  };
}
