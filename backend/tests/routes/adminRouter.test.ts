import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createAdminRouter } from "../../src/routes/adminRouter";
import { createFakeAdminRepository } from "../test-helpers/fakeAdminRepository";
import { signToken } from "../../src/lib/jwt";
import type { User } from "@prisma/client";

export const JWT_SECRET = "test-secret";
export function adminUserRepo() {
  const users: User[] = [
    { id: "admin1", name: "Root", email: "root@x.co", phone: "1", passwordHash: "h", role: "admin", createdAt: new Date(), suspendedAt: null, suspensionReason: null } as User,
  ];
  return { findById: async (id: string) => users.find((u) => u.id === id) ?? null } as any;
}
export const adminAuth = { Authorization: `Bearer ${signToken({ userId: "admin1" }, JWT_SECRET)}` };
export const strangerAuth = { Authorization: `Bearer ${signToken({ userId: "nobody" }, JWT_SECRET)}` };

export function buildAdminApp(repo = createFakeAdminRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", createAdminRouter({ adminRepo: repo, userRepo: adminUserRepo(), jwtSecret: JWT_SECRET }));
  return { app, repo };
}

describe("GET /api/admin/metrics", () => {
  it("403s a non-admin, returns the three counts for an admin", async () => {
    const { app } = buildAdminApp();
    expect((await request(app).get("/api/admin/metrics").set(strangerAuth)).status).toBe(403);
    const res = await request(app).get("/api/admin/metrics").set(adminAuth);
    expect(res.status).toBe(200);
    expect(res.body.metrics).toMatchObject({ activeOrders: 2, newSignups24h: 1, pendingApprovals: 1 });
  });
});

describe("approvals", () => {
  it("lists, approves, and rejects", async () => {
    const { app } = buildAdminApp();
    const list = await request(app).get("/api/admin/approvals").set(adminAuth);
    expect(list.status).toBe(200);
    expect(list.body.approvals[0]).toMatchObject({ id: "r1", name: "Nonna's" });

    const detail = await request(app).get("/api/admin/approvals/r1").set(adminAuth);
    expect(detail.status).toBe(200);
    expect((await request(app).get("/api/admin/approvals/nope").set(adminAuth)).status).toBe(404);

    const appr = await request(app).post("/api/admin/approvals/r1/approve").set(adminAuth).send({ note: "ok" });
    expect(appr.status).toBe(200);
    expect(appr.body.restaurant.approvalStatus).toBe("approved");

    const rej = await request(app).post("/api/admin/approvals/r1/reject").set(adminAuth).send({ note: "bad address" });
    expect(rej.body.restaurant.approvalStatus).toBe("rejected");
  });
});

describe("users", () => {
  it("searches, suspends, blocks self/admin suspension, reinstates", async () => {
    const { app } = buildAdminApp();
    const list = await request(app).get("/api/admin/users?role=customer").set(adminAuth);
    expect(list.body.users[0]).toMatchObject({ id: "cust1", suspended: false });

    expect((await request(app).post("/api/admin/users/admin1/suspend").set(adminAuth)).status).toBe(400); // admin
    expect((await request(app).post("/api/admin/users/nope/suspend").set(adminAuth)).status).toBe(404);

    const s = await request(app).post("/api/admin/users/cust1/suspend").set(adminAuth).send({ reason: "spam" });
    expect(s.status).toBe(200);
    expect(s.body.user.suspended).toBe(true);
    expect((await request(app).post("/api/admin/users/cust1/suspend").set(adminAuth)).status).toBe(409); // already

    const r = await request(app).post("/api/admin/users/cust1/reinstate").set(adminAuth);
    expect(r.body.user.suspended).toBe(false);
    expect((await request(app).post("/api/admin/users/cust1/reinstate").set(adminAuth)).status).toBe(409); // not suspended
  });
});

describe("moderation", () => {
  it("lists reviews and removes one", async () => {
    const { app } = buildAdminApp();
    const list = await request(app).get("/api/admin/reviews").set(adminAuth);
    expect(list.body.reviews[0]).toMatchObject({ id: "rev1", restaurantName: "Nonna's" });
    expect((await request(app).delete("/api/admin/reviews/nope").set(adminAuth)).status).toBe(404);
    expect((await request(app).delete("/api/admin/reviews/rev1").set(adminAuth)).status).toBe(204);
    expect((await request(app).get("/api/admin/reviews").set(adminAuth)).body.reviews.length).toBe(0);
  });
});
