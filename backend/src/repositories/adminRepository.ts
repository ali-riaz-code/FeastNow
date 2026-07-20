import type { PrismaClient, RestaurantProfile, User, Rating, PromoCode } from "@prisma/client";

export interface AdminMetrics { activeOrders: number; newSignups24h: number; pendingApprovals: number; }
export interface AdminUserRow {
  id: string; name: string; email: string; phone: string;
  role: string; suspendedAt: Date | null; createdAt: Date;
}
export interface AdminReviewRow {
  id: string; stars: number; reviewText: string; authorName: string;
  createdAt: Date; restaurantId: string; restaurantName: string;
}
export interface CreatePromoInput { code: string; discountType: "percentage" | "fixed"; discountValue: number; expiresAt: Date | null; }

export interface AdminRepository {
  metrics(now: Date): Promise<AdminMetrics>;
  listPendingApprovals(): Promise<RestaurantProfile[]>;
  findRestaurantById(id: string): Promise<RestaurantProfile | null>;
  approveRestaurant(id: string, now: Date, note: string | null): Promise<RestaurantProfile>;
  rejectRestaurant(id: string, note: string | null): Promise<RestaurantProfile>;
  setRestaurantLocation(id: string, lat: number, lng: number): Promise<RestaurantProfile>;
  searchUsers(q: string | undefined, role: string | undefined): Promise<AdminUserRow[]>;
  findUserById(id: string): Promise<User | null>;
  suspendUser(id: string, now: Date, reason: string | null): Promise<User>;
  reinstateUser(id: string): Promise<User>;
  searchReviews(q: string | undefined): Promise<AdminReviewRow[]>;
  findReviewById(id: string): Promise<Rating | null>;
  removeReview(id: string): Promise<void>;
  listPromos(): Promise<PromoCode[]>;
  findPromoByCode(code: string): Promise<PromoCode | null>;
  createPromo(data: CreatePromoInput): Promise<PromoCode>;
  deactivatePromo(id: string): Promise<PromoCode>;
}

const NON_TERMINAL = ["placed", "accepted", "preparing", "ready", "assigned", "out_for_delivery"] as const;

export function createAdminRepository(prisma: PrismaClient): AdminRepository {
  return {
    async metrics(now) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const [activeOrders, newSignups24h, pendingApprovals] = await Promise.all([
        prisma.order.count({ where: { status: { in: [...NON_TERMINAL] } } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.restaurantProfile.count({ where: { approvalStatus: "pending" } }),
      ]);
      return { activeOrders, newSignups24h, pendingApprovals };
    },
    listPendingApprovals() {
      return prisma.restaurantProfile.findMany({
        where: { approvalStatus: "pending" }, orderBy: { createdAt: "asc" },
      });
    },
    findRestaurantById(id) { return prisma.restaurantProfile.findUnique({ where: { id } }); },
    approveRestaurant(id, now, note) {
      return prisma.restaurantProfile.update({
        where: { id }, data: { approvalStatus: "approved", approvedAt: now, adminNote: note },
      });
    },
    rejectRestaurant(id, note) {
      return prisma.restaurantProfile.update({
        where: { id }, data: { approvalStatus: "rejected", adminNote: note },
      });
    },
    setRestaurantLocation(id, lat, lng) {
      return prisma.restaurantProfile.update({ where: { id }, data: { lat, lng } });
    },
    searchUsers(q, role) {
      return prisma.user.findMany({
        where: {
          ...(role ? { role: role as any } : {}),
          ...(q ? { OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ] } : {}),
        },
        orderBy: { createdAt: "desc" }, take: 50,
        select: { id: true, name: true, email: true, phone: true, role: true, suspendedAt: true, createdAt: true },
      });
    },
    findUserById(id) { return prisma.user.findUnique({ where: { id } }); },
    async suspendUser(id, now, reason) {
      // Suspend the account, and (if they own a restaurant) drop it from browse
      // by flipping isActive — reuses the existing ACTIVE gate; reinstate restores it.
      return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({ where: { id }, data: { suspendedAt: now, suspensionReason: reason } });
        if (user.role === "restaurant") {
          await tx.restaurantProfile.updateMany({ where: { userId: id }, data: { isActive: false } });
        }
        return user;
      });
    },
    async reinstateUser(id) {
      return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({ where: { id }, data: { suspendedAt: null, suspensionReason: null } });
        if (user.role === "restaurant") {
          await tx.restaurantProfile.updateMany({ where: { userId: id }, data: { isActive: true } });
        }
        return user;
      });
    },
    async searchReviews(q) {
      const rows = await prisma.rating.findMany({
        where: q ? { restaurant: { name: { contains: q, mode: "insensitive" } } } : {},
        orderBy: { createdAt: "desc" }, take: 50,
        include: { restaurant: { select: { id: true, name: true } } },
      });
      return rows.map((r) => ({
        id: r.id, stars: r.stars, reviewText: r.reviewText, authorName: r.authorName,
        createdAt: r.createdAt, restaurantId: r.restaurantId, restaurantName: r.restaurant.name,
      }));
    },
    findReviewById(id) { return prisma.rating.findUnique({ where: { id } }); },
    async removeReview(id) {
      const review = await prisma.rating.findUnique({ where: { id } });
      if (!review) return;
      await prisma.$transaction(async (tx) => {
        await tx.rating.delete({ where: { id } });
        const agg = await tx.rating.aggregate({
          where: { restaurantId: review.restaurantId }, _avg: { stars: true }, _count: true,
        });
        await tx.restaurantProfile.update({
          where: { id: review.restaurantId },
          data: { avgRating: agg._avg.stars ?? 0, ratingCount: agg._count },
        });
      });
    },
    listPromos() { return prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } }); },
    findPromoByCode(code) { return prisma.promoCode.findUnique({ where: { code } }); },
    createPromo(data) { return prisma.promoCode.create({ data }); },
    deactivatePromo(id) { return prisma.promoCode.update({ where: { id }, data: { active: false } }); },
  };
}
