import type { AdminRepository } from "../../src/repositories/adminRepository";

export function createFakeAdminRepository(): AdminRepository {
  const pending = [
    { id: "r1", name: "Nonna's", cuisines: ["Italian"], address: "1 St", createdAt: new Date("2026-07-19"),
      approvalStatus: "pending", approvedAt: null, adminNote: null } as any,
  ];

  const users = [
    { id: "cust1", name: "Cara", email: "cara@x.co", phone: "300", role: "customer", suspendedAt: null, suspensionReason: null, createdAt: new Date() } as any,
    { id: "admin1", name: "Root", email: "root@x.co", phone: "1", role: "admin", suspendedAt: null, suspensionReason: null, createdAt: new Date() } as any,
  ];

  const reviews = [
    { id: "rev1", stars: 1, reviewText: "bad", authorName: "X", createdAt: new Date(), restaurantId: "r1", restaurantName: "Nonna's" },
  ];

  const promos: any[] = [];

  return {
    async metrics() { return { activeOrders: 2, newSignups24h: 1, pendingApprovals: 1 }; },
    async listPendingApprovals() { return pending as any; },
    async findRestaurantById(id) { return (pending.find((r) => r.id === id) as any) ?? null; },
    async approveRestaurant(id, now, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "approved"; r.approvedAt = now; r.adminNote = note; return r; },
    async rejectRestaurant(id, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "rejected"; r.adminNote = note; return r; },
    async setRestaurantLocation(id, lat, lng) { const r = pending.find((x) => x.id === id) as any; r.lat = lat; r.lng = lng; return r; },
    async searchUsers(q, role) { return users.filter((u) => (!role || u.role === role) && (!q || u.name.includes(q))) as any; },
    async findUserById(id) { return (users.find((u) => u.id === id) as any) ?? null; },
    async suspendUser(id, now, reason) { const u = users.find((x) => x.id === id) as any; u.suspendedAt = now; u.suspensionReason = reason; return u; },
    async reinstateUser(id) { const u = users.find((x) => x.id === id) as any; u.suspendedAt = null; u.suspensionReason = null; return u; },
    async searchReviews(q) { return reviews.filter((r) => !q || r.restaurantName.includes(q)); },
    async findReviewById(id) { return (reviews.find((r) => r.id === id) as any) ?? null; },
    async removeReview(id) { const i = reviews.findIndex((r) => r.id === id); if (i >= 0) reviews.splice(i, 1); },
    async listPromos() { return promos as any; },
    async findPromoByCode(code) { return (promos.find((p) => p.code === code) as any) ?? null; },
    async createPromo(data) { const p = { id: `p${promos.length + 1}`, active: true, createdAt: new Date(), ...data }; promos.push(p); return p as any; },
    async deactivatePromo(id) { const p = promos.find((x) => x.id === id); p.active = false; return p as any; },
  };
}
