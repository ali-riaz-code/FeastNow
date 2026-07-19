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
