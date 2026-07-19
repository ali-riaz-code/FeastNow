import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import type { User } from "@prisma/client";
import { createRequireAdmin, type AdminRequest } from "../../src/middleware/requireAdmin";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u1", name: "A", email: "a@x.co", phone: "1", passwordHash: "h",
    role: "admin", createdAt: new Date(), suspendedAt: null, suspensionReason: null, ...over,
  } as User;
}
function buildApp(users: User[]) {
  const userRepo = { findById: async (id: string) => users.find((u) => u.id === id) ?? null } as any;
  const app = express();
  const guard = createRequireAdmin(JWT_SECRET, userRepo);
  app.get("/x", ...guard, (req: AdminRequest, res) => res.json({ who: req.adminUser!.id }));
  return app;
}
const tok = (userId: string) => ({ Authorization: `Bearer ${signToken({ userId }, JWT_SECRET)}` });

describe("requireAdmin", () => {
  it("401 without token, 403 for non-admin, 403 for suspended admin, 200 for admin", async () => {
    const app = buildApp([
      makeUser({ id: "admin1", role: "admin" }),
      makeUser({ id: "cust1", role: "customer" }),
      makeUser({ id: "susp1", role: "admin", suspendedAt: new Date() }),
    ]);
    expect((await request(app).get("/x")).status).toBe(401);
    expect((await request(app).get("/x").set(tok("cust1"))).status).toBe(403);
    expect((await request(app).get("/x").set(tok("susp1"))).status).toBe(403);
    const ok = await request(app).get("/x").set(tok("admin1"));
    expect(ok.status).toBe(200);
    expect(ok.body.who).toBe("admin1");
  });
});
