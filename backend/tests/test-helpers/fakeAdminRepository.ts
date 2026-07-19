import type { AdminRepository } from "../../src/repositories/adminRepository";

export function createFakeAdminRepository(): AdminRepository {
  const pending = [
    { id: "r1", name: "Nonna's", cuisines: ["Italian"], address: "1 St", createdAt: new Date("2026-07-19"),
      approvalStatus: "pending", approvedAt: null, adminNote: null } as any,
  ];

  return {
    async metrics() { return { activeOrders: 2, newSignups24h: 1, pendingApprovals: 1 }; },
    async listPendingApprovals() { return pending as any; },
    async findRestaurantById(id) { return (pending.find((r) => r.id === id) as any) ?? null; },
    async approveRestaurant(id, now, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "approved"; r.approvedAt = now; r.adminNote = note; return r; },
    async rejectRestaurant(id, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "rejected"; r.adminNote = note; return r; },
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
