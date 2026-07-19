import type { AdminRepository } from "../../src/repositories/adminRepository";

export function createFakeAdminRepository(): AdminRepository {
  return {
    async metrics() { return { activeOrders: 2, newSignups24h: 1, pendingApprovals: 1 }; },
    async listPendingApprovals() { return []; },
    async findRestaurantById() { return null; },
    async approveRestaurant() { throw new Error("not seeded"); },
    async rejectRestaurant() { throw new Error("not seeded"); },
    async searchUsers() { return []; },
    async findUserById() { return null; },
    async suspendUser() { throw new Error("not seeded"); },
    async reinstateUser() { throw new Error("not seeded"); },
    async searchReviews() { return []; },
    async findReviewById() { return null; },
    async removeReview() { /* no-op */ },
    async listPromos() { return []; },
    async findPromoByCode() { return null; },
    async createPromo() { throw new Error("not seeded"); },
    async deactivatePromo() { throw new Error("not seeded"); },
  };
}
