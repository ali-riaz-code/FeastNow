# Admin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fourth and final FeastNow role — Admin — as a full-width back-office shell in the existing `app/` SPA, backed by an admin-only REST surface, covering Dashboard, Approvals, Users, Moderation, and Promotions (FR-36–FR-41).

**Architecture:** Admin stays on the shared `User` table (`role = admin`, already in the enum); a new `requireAdmin` middleware gates a new `/api/admin/*` router backed by a new `adminRepository`. The frontend adds an `AdminShell` selected by `me.role === "admin"` in `App.tsx`, rendered full-width (overriding the phone-frame `#root` cap) with a left sidebar, built entirely from existing design tokens. Suspension is enforced at login + `/me` and by flipping a suspended restaurant owner's `isActive` (reusing the existing browse gate).

**Tech Stack:** Node + TypeScript + Express + Prisma (Supabase Postgres); Vitest + Supertest for backend tests with hand-written fake repositories; React + Vite + TypeScript SPA; plain CSS with design tokens.

## Global Constraints

- **TypeScript strict mode** everywhere; camelCase vars/functions, PascalCase types/components.
- **Money is integer cents** (`priceCents`, `totalCents`, promo `discountValue` when fixed).
- **Auth:** JWT Bearer tokens via `signToken`/`verifyToken`; passwords salted-hashed via `hashPassword` (bcrypt cost 12). Never log secrets.
- **Backend tests are TDD** with fake repositories in `backend/tests/test-helpers/` (no real DB in unit tests); router tests use `supertest` + `vitest` and mint tokens with `signToken({ userId }, JWT_SECRET)`.
- **Design fidelity (hard requirement):** every admin screen uses ONLY the tokens in `app/src/styles/tokens.css`. **Gold-Is-Rare** — `--gold`/`--gold-deep` appear only on rating stars and focus rings, never as a base/fill. **Type:** `--font-display` headings, `--font-sans` body/UI, `--font-mono` numerics only (metrics, prices, promo codes, counts). **Shape/elevation:** `--r-*` radii, `--sh-raised`/`--sh-overlay` only. **Motion:** only `--dur-fast`/`--dur`/`--dur-slow` with `--ease-out-quart`/`--ease-out-expo`; no new curves/durations. **Buttons:** reuse `.btn-primary` (navy pill) and the outline variants (`.btn-retry`/`.btn-logout`); destructive actions use a tomato-outline variant. **Operator-Restraint:** three numbers, not a BI dashboard.
- **Backend build order:** `prisma generate` must run before `tsc` (Render build already does this; local: run `npx prisma generate` after any schema change before type-checking).
- **Commit after every task** with a conventional message. Do not push until the final verify task.

---

### Task 1: Schema migration — suspension, admin note, promo codes

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create (generated): `backend/prisma/migrations/<timestamp>_admin_role/migration.sql`

**Interfaces:**
- Produces: `User.suspendedAt: DateTime?`, `User.suspensionReason: String?`; `RestaurantProfile.adminNote: String?`; `enum DiscountType { percentage fixed }`; `model PromoCode { id, code(unique), discountType, discountValue:Int, active:Boolean, expiresAt:DateTime?, createdAt }`.

- [ ] **Step 1: Add fields + model to `schema.prisma`**

In `model User`, after `role`:
```prisma
  suspendedAt      DateTime?
  suspensionReason String?
```
In `model RestaurantProfile`, after `approvalStatus`:
```prisma
  adminNote String?
```
At the end of the file, add:
```prisma
enum DiscountType {
  percentage
  fixed
}

model PromoCode {
  id            String       @id @default(uuid())
  code          String       @unique
  discountType  DiscountType
  discountValue Int
  active        Boolean      @default(true)
  expiresAt     DateTime?
  createdAt     DateTime     @default(now())

  @@index([active])
}
```

- [ ] **Step 2: Create the migration**

Run: `cd backend && npx prisma migrate dev --name admin_role`
Expected: a new migration under `prisma/migrations/`, applied to the dev DB, and the Prisma client regenerated with the new fields/model.

- [ ] **Step 3: Verify type-check passes**

Run: `cd backend && npx tsc --noEmit`
Expected: exit 0 (no type errors — the regenerated client now knows the new fields).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): admin role schema — suspension, admin note, promo codes"
```

---

### Task 2: `requireAdmin` middleware

**Files:**
- Create: `backend/src/middleware/requireAdmin.ts`
- Create: `backend/tests/middleware/requireAdmin.test.ts`

**Interfaces:**
- Consumes: `createRequireAuth` (`./requireAuth`), `UserRepository.findById` (`../repositories/userRepository`), `asyncHandler`.
- Produces: `interface AdminRequest extends AuthenticatedRequest { adminUser?: User }`; `createRequireAdmin(jwtSecret: string, userRepo: UserRepository): RequestHandler[]` — `requireAuth` then a resolver that 403s unless the loaded user has `role === "admin"` and `suspendedAt == null`, attaching `req.adminUser`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/middleware/requireAdmin.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/middleware/requireAdmin.test.ts`
Expected: FAIL — cannot find module `requireAdmin`.

- [ ] **Step 3: Write the middleware**

```ts
// backend/src/middleware/requireAdmin.ts
import type { Response, NextFunction, RequestHandler } from "express";
import type { User } from "@prisma/client";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface AdminRequest extends AuthenticatedRequest {
  adminUser?: User;
}

/** requireAuth + confirm the caller is an active admin (403 otherwise). */
export function createRequireAdmin(jwtSecret: string, userRepo: UserRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolveAdmin = asyncHandler(async (req: AdminRequest, res: Response, next: NextFunction) => {
    const user = await userRepo.findById(req.userId!);
    if (!user || user.role !== "admin" || user.suspendedAt) {
      return res.status(403).json({ error: "Admin access required." });
    }
    req.adminUser = user;
    next();
  });
  return [requireAuth, resolveAdmin];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/middleware/requireAdmin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requireAdmin.ts backend/tests/middleware/requireAdmin.test.ts
git commit -m "feat(admin): requireAdmin middleware"
```

---

### Task 3: Enforce suspension at login and /me

**Files:**
- Modify: `backend/src/routes/authRouter.ts` (login handler, ~line 158-167)
- Modify: `backend/src/routes/meRouter.ts` (~line 15-21)
- Modify: `backend/tests/routes/authRouter.test.ts` (add a case)
- Modify: `backend/tests/routes/meRouter.test.ts` (add a case)

**Interfaces:**
- Consumes: `User.suspendedAt` (Task 1).
- Produces: `/login` returns 403 `{ error: "This account has been suspended." }` for a suspended user (after password verification succeeds); `GET /api/me` returns 401 for a suspended user (so the SPA redirects to login).

- [ ] **Step 1: Write the failing tests**

In `backend/tests/routes/authRouter.test.ts`, add inside the login `describe`:
```ts
  it("403s a suspended user even with the correct password", async () => {
    // buildApp helper in this file seeds a fake userRepo; add a suspended user.
    const { app, userRepo } = buildLoginApp();
    await userRepo.seedSuspended({ identifier: "susp@x.co", password: "Correct123" });
    const res = await request(app).post("/api/auth/login").send({ identifier: "susp@x.co", password: "Correct123" });
    expect(res.status).toBe(403);
  });
```
> Note: mirror this file's existing `buildLoginApp`/fake-repo helper names; if the helper lacks a way to seed a suspended user with a known password, add a small `seedSuspended` to the fake `userRepository` used here (set `suspendedAt: new Date()`). Reuse the existing password-hash helper the test file already uses.

In `backend/tests/routes/meRouter.test.ts`, add:
```ts
  it("401s a suspended user", async () => {
    const { app, userRepo } = buildMeApp();          // mirror existing helper
    userRepo.users.push(makeUser({ id: "s1", role: "customer", suspendedAt: new Date() }));
    const res = await request(app).get("/api/me").set({ Authorization: `Bearer ${signToken({ userId: "s1" }, JWT_SECRET)}` });
    expect(res.status).toBe(401);
  });
```
> Mirror the existing `meRouter.test.ts` helpers/fixtures (`makeUser`, `JWT_SECRET`, app builder). If a `makeUser` factory doesn't exist there, inline a user object with `suspendedAt: new Date()`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts tests/routes/meRouter.test.ts`
Expected: FAIL — suspended user currently logs in / gets 200 from /me.

- [ ] **Step 3: Implement enforcement**

In `authRouter.ts`, in the `/login` handler, immediately after the `if (!matches) { ... }` block and before signing the token:
```ts
    if (user.suspendedAt) {
      return res.status(403).json({ error: "This account has been suspended." });
    }
```

In `meRouter.ts`, change the not-found guard to also reject suspended users:
```ts
    const user = await deps.userRepo.findById(req.userId!);
    if (!user || user.suspendedAt) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts tests/routes/meRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/authRouter.ts backend/src/routes/meRouter.ts backend/tests/routes/authRouter.test.ts backend/tests/routes/meRouter.test.ts
git commit -m "feat(admin): block suspended accounts at login and /me"
```

---

### Task 4: adminRepository + fake + metrics endpoint wired into the app

This task stands up the whole admin surface: the repository interface, its Prisma implementation, a fake for tests, the `adminRouter` with its first endpoint (`GET /api/admin/metrics`), and mounting in `app.ts`. Later tasks add endpoints to the same router/repo.

**Files:**
- Create: `backend/src/repositories/adminRepository.ts`
- Create: `backend/src/routes/adminRouter.ts`
- Create: `backend/tests/test-helpers/fakeAdminRepository.ts`
- Create: `backend/tests/routes/adminRouter.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Produces (repository — the full interface used across Tasks 4–8):
```ts
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
```
- Produces (router): `createAdminRouter(deps: { adminRepo: AdminRepository; userRepo: UserRepository; jwtSecret: string }): Router`, mounted at `/api/admin`. First endpoint: `GET /metrics` → `{ metrics: AdminMetrics }`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/routes/adminRouter.test.ts
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
```

- [ ] **Step 2: Write the fake repository (with seeded metrics matching the test)**

```ts
// backend/tests/test-helpers/fakeAdminRepository.ts
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
```
> Later tasks replace individual methods here with seeded, assertable behavior. Keep this one file as the single fake.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL — cannot find `adminRouter` / `adminRepository`.

- [ ] **Step 4: Write the repository (full interface, Prisma impl)**

```ts
// backend/src/repositories/adminRepository.ts
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
```

- [ ] **Step 5: Write the router (metrics endpoint only for now)**

```ts
// backend/src/routes/adminRouter.ts
import { Router } from "express";
import type { AdminRepository } from "../repositories/adminRepository";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAdmin, type AdminRequest } from "../middleware/requireAdmin";
import { asyncHandler } from "../middleware/asyncHandler";

export interface AdminRouterDeps {
  adminRepo: AdminRepository;
  userRepo: UserRepository;
  jwtSecret: string;
}

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(deps.jwtSecret, deps.userRepo);

  router.get("/metrics", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
    const metrics = await deps.adminRepo.metrics(new Date());
    return res.status(200).json({ metrics });
  }));

  return router;
}
```

- [ ] **Step 6: Mount in `app.ts`**

Add the imports near the other repo/router imports:
```ts
import { createAdminRepository } from "./repositories/adminRepository";
import { createAdminRouter } from "./routes/adminRouter";
```
After `const deliveryRepo = createDeliveryRepository(config.prisma);`:
```ts
  const adminRepo = createAdminRepository(config.prisma);
```
After the delivery router mount (before `app.use(errorHandler)`):
```ts
  app.use("/api/admin", createAdminRouter({ adminRepo, userRepo, jwtSecret: config.jwtSecret }));
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: PASS (403 for stranger, 200 with `{activeOrders:2,newSignups24h:1,pendingApprovals:1}`).

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/adminRepository.ts backend/src/routes/adminRouter.ts backend/tests/test-helpers/fakeAdminRepository.ts backend/tests/routes/adminRouter.test.ts backend/src/app.ts
git commit -m "feat(admin): adminRepository + /api/admin/metrics"
```

---

### Task 5: Approvals endpoints + remove lazy auto-approve

Adds list/detail/approve/reject. Because a real admin approval flow now exists, the **lazy auto-approve stand-in** in `ownerRouter.ts` (`/me`, lines ~31-35) must be removed so pending restaurants stay pending until an admin acts.

**Files:**
- Modify: `backend/src/routes/adminRouter.ts`
- Modify: `backend/tests/routes/adminRouter.test.ts`
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts`
- Modify: `backend/src/routes/ownerRouter.ts` (remove auto-approve block + unused import)
- Modify: `backend/tests/routes/ownerRouter.test.ts` (drop the auto-approve test)

**Interfaces:**
- Consumes: `AdminRepository.listPendingApprovals/findRestaurantById/approveRestaurant/rejectRestaurant`.
- Produces:
  - `GET /api/admin/approvals` → `{ approvals: Array<{ id,name,cuisines,address,createdAt }> }`
  - `GET /api/admin/approvals/:id` → `{ restaurant: {...full fields} }` or 404
  - `POST /api/admin/approvals/:id/approve` body `{ note?: string }` → `{ restaurant }`
  - `POST /api/admin/approvals/:id/reject` body `{ note?: string }` → `{ restaurant }`

- [ ] **Step 1: Write failing tests**

In `fakeAdminRepository.ts`, replace the approvals methods with seeded state:
```ts
  const pending = [
    { id: "r1", name: "Nonna's", cuisines: ["Italian"], address: "1 St", createdAt: new Date("2026-07-19"),
      approvalStatus: "pending", approvedAt: null, adminNote: null } as any,
  ];
  // ...inside the returned object:
    async listPendingApprovals() { return pending as any; },
    async findRestaurantById(id) { return (pending.find((r) => r.id === id) as any) ?? null; },
    async approveRestaurant(id, now, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "approved"; r.approvedAt = now; r.adminNote = note; return r; },
    async rejectRestaurant(id, note) { const r = pending.find((x) => x.id === id) as any; r.approvalStatus = "rejected"; r.adminNote = note; return r; },
```
> Declare `pending` inside `createFakeAdminRepository` before the `return`, so all methods close over the same array.

In `adminRouter.test.ts`, add:
```ts
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
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL — routes 404 (not defined yet).

- [ ] **Step 3: Add the endpoints to `adminRouter.ts`**

Add a DTO helper and routes:
```ts
function approvalRow(r: { id: string; name: string; cuisines: string[]; address: string; createdAt: Date }) {
  return { id: r.id, name: r.name, cuisines: r.cuisines, address: r.address, createdAt: r.createdAt.toISOString() };
}

router.get("/approvals", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
  const list = await deps.adminRepo.listPendingApprovals();
  return res.status(200).json({ approvals: list.map(approvalRow) });
}));

router.get("/approvals/:id", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const r = await deps.adminRepo.findRestaurantById(req.params.id);
  if (!r) return res.status(404).json({ error: "Restaurant not found." });
  return res.status(200).json({ restaurant: r });
}));

router.post("/approvals/:id/approve", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const r = await deps.adminRepo.findRestaurantById(req.params.id);
  if (!r) return res.status(404).json({ error: "Restaurant not found." });
  const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;
  const updated = await deps.adminRepo.approveRestaurant(req.params.id, new Date(), note);
  return res.status(200).json({ restaurant: updated });
}));

router.post("/approvals/:id/reject", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const r = await deps.adminRepo.findRestaurantById(req.params.id);
  if (!r) return res.status(404).json({ error: "Restaurant not found." });
  const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;
  const updated = await deps.adminRepo.rejectRestaurant(req.params.id, note);
  return res.status(200).json({ restaurant: updated });
}));
```

- [ ] **Step 4: Remove lazy auto-approve from `ownerRouter.ts`**

Replace the `/me` handler body so it no longer auto-approves:
```ts
  router.get("/me", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    return res.status(200).json({ profile: toOwnerProfileDTO(req.ownerProfile!) });
  }));
```
Remove the now-unused import: `import { AUTO_APPROVE_AFTER_MS } from "../lib/orderStateMachine";`
In `ownerRouter.test.ts`, delete the `"auto-approves a pending profile older than 60s"` test.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts tests/routes/ownerRouter.test.ts`
Expected: PASS (approvals flow works; ownerRouter no longer has the auto-approve test).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminRouter.ts backend/src/routes/ownerRouter.ts backend/tests/routes/adminRouter.test.ts backend/tests/routes/ownerRouter.test.ts backend/tests/test-helpers/fakeAdminRepository.ts
git commit -m "feat(admin): restaurant approvals endpoints; retire lazy auto-approve"
```

---

### Task 6: Users endpoints — search, suspend, reinstate

**Files:**
- Modify: `backend/src/routes/adminRouter.ts`
- Modify: `backend/tests/routes/adminRouter.test.ts`
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts`

**Interfaces:**
- Consumes: `AdminRepository.searchUsers/findUserById/suspendUser/reinstateUser`.
- Produces:
  - `GET /api/admin/users?q=&role=` → `{ users: Array<{ id,name,email,phone,role,suspended:boolean,createdAt }> }`
  - `POST /api/admin/users/:id/suspend` body `{ reason?: string }` → `{ user }`; 400 if target is an admin or is the caller; 404 if missing; 409 if already suspended.
  - `POST /api/admin/users/:id/reinstate` → `{ user }`; 404 if missing; 409 if not suspended.

- [ ] **Step 1: Write failing tests**

In `fakeAdminRepository.ts`, add a `users` array (declared before `return`) and implement:
```ts
  const users = [
    { id: "cust1", name: "Cara", email: "cara@x.co", phone: "300", role: "customer", suspendedAt: null, suspensionReason: null, createdAt: new Date() } as any,
    { id: "admin1", name: "Root", email: "root@x.co", phone: "1", role: "admin", suspendedAt: null, suspensionReason: null, createdAt: new Date() } as any,
  ];
  // methods:
    async searchUsers(q, role) { return users.filter((u) => (!role || u.role === role) && (!q || u.name.includes(q))) as any; },
    async findUserById(id) { return (users.find((u) => u.id === id) as any) ?? null; },
    async suspendUser(id, now, reason) { const u = users.find((x) => x.id === id) as any; u.suspendedAt = now; u.suspensionReason = reason; return u; },
    async reinstateUser(id) { const u = users.find((x) => x.id === id) as any; u.suspendedAt = null; u.suspensionReason = null; return u; },
```

In `adminRouter.test.ts`, add:
```ts
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
```
> Note the caller is `admin1`; suspending `admin1` must 400 on **both** the self rule and the admin rule.

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL — user routes not defined.

- [ ] **Step 3: Add the endpoints + a DTO helper**

```ts
function userRow(u: { id: string; name: string; email: string; phone: string; role: string; suspendedAt: Date | null; createdAt: Date }) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, suspended: u.suspendedAt != null, createdAt: u.createdAt.toISOString() };
}

router.get("/users", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
  const role = typeof req.query.role === "string" && req.query.role ? req.query.role : undefined;
  const users = await deps.adminRepo.searchUsers(q, role);
  return res.status(200).json({ users: users.map(userRow) });
}));

router.post("/users/:id/suspend", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const target = await deps.adminRepo.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (target.role === "admin" || target.id === req.adminUser!.id) {
    return res.status(400).json({ error: "Admin accounts cannot be suspended." });
  }
  if (target.suspendedAt) return res.status(409).json({ error: "User is already suspended." });
  const reason = typeof req.body?.reason === "string" && req.body.reason.trim() ? req.body.reason.trim() : null;
  const user = await deps.adminRepo.suspendUser(target.id, new Date(), reason);
  return res.status(200).json({ user: userRow(user) });
}));

router.post("/users/:id/reinstate", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const target = await deps.adminRepo.findUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });
  if (!target.suspendedAt) return res.status(409).json({ error: "User is not suspended." });
  const user = await deps.adminRepo.reinstateUser(target.id);
  return res.status(200).json({ user: userRow(user) });
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/adminRouter.ts backend/tests/routes/adminRouter.test.ts backend/tests/test-helpers/fakeAdminRepository.ts
git commit -m "feat(admin): user search, suspend, reinstate"
```

---

### Task 7: Moderation endpoints — list/search reviews, remove

**Files:**
- Modify: `backend/src/routes/adminRouter.ts`
- Modify: `backend/tests/routes/adminRouter.test.ts`
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts`

**Interfaces:**
- Consumes: `AdminRepository.searchReviews/findReviewById/removeReview`.
- Produces:
  - `GET /api/admin/reviews?q=` → `{ reviews: Array<{ id,stars,reviewText,authorName,createdAt,restaurantId,restaurantName }> }`
  - `DELETE /api/admin/reviews/:id` → 204; 404 if missing.

- [ ] **Step 1: Write failing tests**

In `fakeAdminRepository.ts`, add a `reviews` array + implement:
```ts
  const reviews = [
    { id: "rev1", stars: 1, reviewText: "bad", authorName: "X", createdAt: new Date(), restaurantId: "r1", restaurantName: "Nonna's" },
  ];
    async searchReviews(q) { return reviews.filter((r) => !q || r.restaurantName.includes(q)); },
    async findReviewById(id) { return (reviews.find((r) => r.id === id) as any) ?? null; },
    async removeReview(id) { const i = reviews.findIndex((r) => r.id === id); if (i >= 0) reviews.splice(i, 1); },
```

In `adminRouter.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the endpoints**

```ts
router.get("/reviews", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
  const rows = await deps.adminRepo.searchReviews(q);
  return res.status(200).json({ reviews: rows.map((r) => ({
    id: r.id, stars: r.stars, reviewText: r.reviewText, authorName: r.authorName,
    createdAt: r.createdAt.toISOString(), restaurantId: r.restaurantId, restaurantName: r.restaurantName,
  })) });
}));

router.delete("/reviews/:id", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const review = await deps.adminRepo.findReviewById(req.params.id);
  if (!review) return res.status(404).json({ error: "Review not found." });
  await deps.adminRepo.removeReview(req.params.id);
  return res.status(204).send();
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/adminRouter.ts backend/tests/routes/adminRouter.test.ts backend/tests/test-helpers/fakeAdminRepository.ts
git commit -m "feat(admin): review moderation endpoints"
```

---

### Task 8: Promotions endpoints — list, create, deactivate

**Files:**
- Modify: `backend/src/routes/adminRouter.ts`
- Modify: `backend/tests/routes/adminRouter.test.ts`
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts`

**Interfaces:**
- Consumes: `AdminRepository.listPromos/findPromoByCode/createPromo/deactivatePromo`.
- Produces:
  - `GET /api/admin/promos` → `{ promos: Array<{ id,code,discountType,discountValue,active,expiresAt }> }`
  - `POST /api/admin/promos` body `{ code, discountType, discountValue, expiresAt? }` → 201 `{ promo }`; 400 on invalid input; 409 on duplicate code.
  - `POST /api/admin/promos/:id/deactivate` → `{ promo }`.

- [ ] **Step 1: Write failing tests**

In `fakeAdminRepository.ts`, add a `promos` array + implement:
```ts
  const promos: any[] = [];
    async listPromos() { return promos as any; },
    async findPromoByCode(code) { return (promos.find((p) => p.code === code) as any) ?? null; },
    async createPromo(data) { const p = { id: `p${promos.length + 1}`, active: true, createdAt: new Date(), ...data }; promos.push(p); return p as any; },
    async deactivatePromo(id) { const p = promos.find((x) => x.id === id); p.active = false; return p as any; },
```

In `adminRouter.test.ts`:
```ts
describe("promotions", () => {
  it("validates, creates, rejects duplicates, deactivates", async () => {
    const { app } = buildAdminApp();
    expect((await request(app).post("/api/admin/promos").set(adminAuth).send({ code: "", discountType: "percentage", discountValue: 10 })).status).toBe(400);
    expect((await request(app).post("/api/admin/promos").set(adminAuth).send({ code: "X", discountType: "percentage", discountValue: 150 })).status).toBe(400); // >100
    expect((await request(app).post("/api/admin/promos").set(adminAuth).send({ code: "X", discountType: "fixed", discountValue: 0 })).status).toBe(400); // not >0

    const c = await request(app).post("/api/admin/promos").set(adminAuth).send({ code: "welcome10", discountType: "percentage", discountValue: 10 });
    expect(c.status).toBe(201);
    expect(c.body.promo.code).toBe("WELCOME10"); // uppercased

    expect((await request(app).post("/api/admin/promos").set(adminAuth).send({ code: "welcome10", discountType: "percentage", discountValue: 10 })).status).toBe(409);

    const d = await request(app).post(`/api/admin/promos/${c.body.promo.id}/deactivate`).set(adminAuth);
    expect(d.body.promo.active).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the endpoints + validation + DTO**

```ts
function promoRow(p: { id: string; code: string; discountType: string; discountValue: number; active: boolean; expiresAt: Date | null }) {
  return { id: p.id, code: p.code, discountType: p.discountType, discountValue: p.discountValue, active: p.active, expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null };
}

router.get("/promos", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
  const promos = await deps.adminRepo.listPromos();
  return res.status(200).json({ promos: promos.map(promoRow) });
}));

router.post("/promos", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const { code, discountType, discountValue, expiresAt } = req.body ?? {};
  const validType = discountType === "percentage" || discountType === "fixed";
  const valueOk = Number.isInteger(discountValue) &&
    (discountType === "percentage" ? discountValue >= 1 && discountValue <= 100 : discountValue > 0);
  if (typeof code !== "string" || !code.trim() || !validType || !valueOk) {
    return res.status(400).json({ error: "Invalid promo code details." });
  }
  const normalizedCode = code.trim().toUpperCase();
  const existing = await deps.adminRepo.findPromoByCode(normalizedCode);
  if (existing) return res.status(409).json({ error: "A promo code with this code already exists." });
  const expiry = typeof expiresAt === "string" && expiresAt ? new Date(expiresAt) : null;
  if (expiry && Number.isNaN(expiry.getTime())) return res.status(400).json({ error: "Invalid expiry date." });
  const promo = await deps.adminRepo.createPromo({ code: normalizedCode, discountType, discountValue, expiresAt: expiry });
  return res.status(201).json({ promo: promoRow(promo) });
}));

router.post("/promos/:id/deactivate", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const promo = await deps.adminRepo.deactivatePromo(req.params.id);
  return res.status(200).json({ promo: promoRow(promo) });
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full backend suite + type-check**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: all tests pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminRouter.ts backend/tests/routes/adminRouter.test.ts backend/tests/test-helpers/fakeAdminRepository.ts
git commit -m "feat(admin): promo code endpoints"
```

---

### Task 9: Seed an admin account

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Produces: an idempotent admin `User` (`role = admin`) via `upsert`, printed to console like the other demo accounts.

- [ ] **Step 1: Add the admin upsert**

In `seed.ts`, after the demo delivery partner block (before the `menu`/historical-orders section), add:
```ts
  // Admin back-office account (FR-36) — idempotent via upsert.
  const ADMIN_EMAIL = "admin@demo.feastnow.pk";
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: "FeastNow Admin", email: ADMIN_EMAIL, phone: "03330000009",
      passwordHash: await hashPassword("Admin1234!"), role: "admin",
    },
  });
  console.log(`Admin: ${ADMIN_EMAIL} / Admin1234!`);
```

- [ ] **Step 2: Run the seed**

Run: `cd backend && npx prisma db seed`
Expected: console prints `Admin: admin@demo.feastnow.pk / Admin1234!`; re-running does not error (idempotent).

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(admin): seed admin account"
```

---

### Task 10: Frontend — types, AdminShell, full-width layout, routing

Stands up the shell: types, `App.tsx` wiring, `AdminShell` with a sidebar, the `#root` full-width override, and `admin.css`. Screens are empty placeholders here; Tasks 11–15 fill them.

**Files:**
- Modify: `app/src/lib/types.ts`
- Modify: `app/src/App.tsx`
- Create: `app/src/shells/AdminShell.tsx`
- Create: `app/src/styles/admin.css`
- Modify: `app/src/main.tsx` (import `admin.css`)

**Interfaces:**
- Produces (types):
```ts
export interface AdminMetrics { activeOrders: number; newSignups24h: number; pendingApprovals: number; }
export interface AdminApprovalRow { id: string; name: string; cuisines: string[]; address: string; createdAt: string; }
export interface AdminRestaurantDetail {
  id: string; name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; approvalStatus: "pending" | "approved" | "rejected";
  adminNote: string | null; createdAt: string;
}
export interface AdminUserRow { id: string; name: string; email: string; phone: string; role: UserRole; suspended: boolean; createdAt: string; }
export interface AdminReviewRow { id: string; stars: number; reviewText: string; authorName: string; createdAt: string; restaurantId: string; restaurantName: string; }
export type DiscountType = "percentage" | "fixed";
export interface AdminPromo { id: string; code: string; discountType: DiscountType; discountValue: number; active: boolean; expiresAt: string | null; }
```
- Produces (shell): `AdminShell` component; sidebar routes `/`, `/approvals`, `/users`, `/moderation`, `/promotions`.

- [ ] **Step 1: Add the types** to `app/src/lib/types.ts` (append the block above at the end).

- [ ] **Step 2: Wire `App.tsx`**

```tsx
import { AdminShell } from "./shells/AdminShell";
// ...
function RoleShell() {
  const me = useMe();
  return me.role === "admin" ? <AdminShell />
    : me.role === "restaurant" ? <RestaurantShell />
    : me.role === "delivery_partner" ? <DeliveryShell />
    : <CustomerShell />;
}
```
(Remove the stale "admin shell arrives in a later phase" comment.)

- [ ] **Step 3: Create `AdminShell.tsx`** (sidebar + routes; screens imported in later tasks — for now use inline placeholders so it compiles)

```tsx
import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { clearToken, redirectToLogin } from "../lib/session";
import { useMe } from "../AuthGate";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/approvals", label: "Approvals", end: false },
  { to: "/users", label: "Users", end: false },
  { to: "/moderation", label: "Moderation", end: false },
  { to: "/promotions", label: "Promotions", end: false },
];

function AdminSidebar() {
  const me = useMe();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand serif">FeastNow</div>
      <nav className="admin-sidebar__nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `admin-navlink${isActive ? " admin-navlink--active" : ""}`}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="admin-sidebar__foot">
        <span className="admin-sidebar__who">{me.email}</span>
        <button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }}>Log out</button>
      </div>
    </aside>
  );
}

export function AdminShell() {
  // Break out of the 480px phone frame — this is a back-office.
  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("admin-root");
    return () => root?.classList.remove("admin-root");
  }, []);

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<div className="admin-screen">Dashboard</div>} />
          <Route path="/approvals" element={<div className="admin-screen">Approvals</div>} />
          <Route path="/users" element={<div className="admin-screen">Users</div>} />
          <Route path="/moderation" element={<div className="admin-screen">Moderation</div>} />
          <Route path="/promotions" element={<div className="admin-screen">Promotions</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create `admin.css`** (tokens only; full-width override; sidebar reuses the tab-active idiom)

```css
/* Full-width back-office — overrides the phone-frame cap for admins only. */
#root.admin-root { max-width: none; box-shadow: none; background: var(--cream); }

.admin-shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100dvh; }

.admin-sidebar {
  display: flex; flex-direction: column; gap: var(--s-md);
  background: var(--off-white); border-right: 1px solid var(--dough);
  padding: var(--s-lg) var(--s-md);
}
.admin-sidebar__brand { font-size: 22px; color: var(--navy); padding: 0 var(--s-sm) var(--s-sm); }
.admin-sidebar__nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.admin-navlink {
  padding: 10px 12px; border-radius: var(--r-sm); color: var(--brown); font-weight: 600;
  transition: background var(--dur-fast) var(--ease-out-quart), color var(--dur-fast) var(--ease-out-quart);
}
.admin-navlink:hover { background: var(--dough); }
.admin-navlink--active { background: var(--navy); color: var(--cream); }
.admin-sidebar__foot { display: flex; flex-direction: column; gap: var(--s-sm); }
.admin-sidebar__who { font-size: 12px; color: var(--brown); word-break: break-all; }

.admin-main { padding: var(--s-xl) var(--gutter); max-width: var(--maxw); width: 100%; }
.admin-screen { color: var(--navy); }
.admin-screen__title { font-family: var(--font-display); font-size: 28px; color: var(--navy); margin: 0 0 var(--s-lg); }

/* Cards, shared by admin screens — same radius/shadow/tap-feel as restaurant-card. */
.admin-card { background: var(--off-white); border-radius: var(--r-md); box-shadow: var(--sh-raised); padding: var(--s-lg); }

/* Destructive action — tomato outline (matches .btn-logout family). */
.btn-danger { background: none; border: 1px solid var(--tomato); color: var(--tomato); border-radius: var(--r-pill); padding: 10px 22px; font-weight: 600; }

/* Status pill: color + label (color-blind safe). */
.admin-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; border-radius: var(--r-pill); padding: 3px 10px; }
.admin-pill--ok { background: var(--basil-deep); color: var(--cream); }
.admin-pill--warn { background: var(--butter); color: var(--gold-deep); }
.admin-pill--bad { background: var(--tomato); color: var(--cream); }

/* Responsive: stack the sidebar on top on narrow screens. */
@media (max-width: 720px) {
  .admin-shell { grid-template-columns: 1fr; }
  .admin-sidebar { flex-direction: row; flex-wrap: wrap; align-items: center; border-right: none; border-bottom: 1px solid var(--dough); }
  .admin-sidebar__nav { flex-direction: row; flex-wrap: wrap; }
  .admin-main { padding: var(--s-lg) var(--s-md); }
}
```

- [ ] **Step 5: Import `admin.css`** in `main.tsx` (after `delivery.css`):
```ts
import "./styles/admin.css";
```

- [ ] **Step 6: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: build succeeds, lint clean.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/types.ts app/src/App.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css app/src/main.tsx
git commit -m "feat(admin): AdminShell, full-width layout, routing"
```

---

### Task 11: Frontend — Dashboard screen

**Files:**
- Create: `app/src/screens/admin/ADashboardScreen.tsx`
- Modify: `app/src/shells/AdminShell.tsx` (use the real screen)

**Interfaces:**
- Consumes: `apiGet<{ metrics: AdminMetrics }>("/api/admin/metrics")`.

- [ ] **Step 1: Create the screen** (three metric cards; number in mono, label in sans; heading in display; Refresh is an outline button)

```tsx
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import type { AdminMetrics } from "../../lib/types";

const CARDS: { key: keyof AdminMetrics; label: string }[] = [
  { key: "activeOrders", label: "Active orders" },
  { key: "newSignups24h", label: "New sign-ups (24h)" },
  { key: "pendingApprovals", label: "Pending approvals" },
];

export function ADashboardScreen() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try { setMetrics(await apiGet<{ metrics: AdminMetrics }>("/api/admin/metrics").then((r) => r.metrics)); }
    catch { setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Dashboard</h1>
      {error && <p className="admin-error">Couldn't load metrics. <button className="btn-retry" onClick={() => void load()}>Retry</button></p>}
      <div className="admin-metrics">
        {CARDS.map((c) => (
          <div key={c.key} className="admin-card admin-metric">
            <span className="admin-metric__value mono">{metrics ? metrics[c.key] : "—"}</span>
            <span className="admin-metric__label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add screen CSS** to `admin.css`:
```css
.admin-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-md); }
.admin-metric { display: flex; flex-direction: column; gap: var(--s-xs); }
.admin-metric__value { font-size: 40px; color: var(--navy); line-height: 1; }
.admin-metric__label { font-size: 13px; color: var(--brown); }
.admin-error { color: var(--tomato); display: flex; align-items: center; gap: var(--s-sm); }
```

- [ ] **Step 3: Wire into `AdminShell`** — import and replace the `/` route element:
```tsx
import { ADashboardScreen } from "../screens/admin/ADashboardScreen";
// ...
<Route path="/" element={<ADashboardScreen />} />
```

- [ ] **Step 4: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/admin/ADashboardScreen.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css
git commit -m "feat(admin): dashboard screen"
```

---

### Task 12: Frontend — Approvals screen

**Files:**
- Create: `app/src/screens/admin/AApprovalsScreen.tsx`
- Modify: `app/src/shells/AdminShell.tsx`
- Modify: `app/src/styles/admin.css`

**Interfaces:**
- Consumes: `apiGet<{ approvals: AdminApprovalRow[] }>("/api/admin/approvals")`; `apiGet<{ restaurant: AdminRestaurantDetail }>("/api/admin/approvals/:id")`; `apiSend("POST", "/api/admin/approvals/:id/approve", { note })` and `.../reject`.

- [ ] **Step 1: Create the screen** (master list → detail panel; Approve is `.btn-primary`, Reject is `.btn-danger` with an optional reason input)

```tsx
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import type { AdminApprovalRow, AdminRestaurantDetail } from "../../lib/types";

export function AApprovalsScreen() {
  const [rows, setRows] = useState<AdminApprovalRow[]>([]);
  const [selected, setSelected] = useState<AdminRestaurantDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(await apiGet<{ approvals: AdminApprovalRow[] }>("/api/admin/approvals").then((r) => r.approvals));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    setNote("");
    setSelected(await apiGet<{ restaurant: AdminRestaurantDetail }>(`/api/admin/approvals/${id}`).then((r) => r.restaurant));
  };

  const decide = async (verb: "approve" | "reject") => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiSend("POST", `/api/admin/approvals/${selected.id}/${verb}`, { note: note.trim() || undefined });
      setSelected(null);
      await load();
    } catch { window.alert("Couldn't update this restaurant. Check your connection."); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Approvals</h1>
      {rows.length === 0 && <p className="admin-muted">No restaurants awaiting review.</p>}
      <div className="admin-split">
        <ul className="admin-list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className={`admin-row${selected?.id === r.id ? " admin-row--active" : ""}`} onClick={() => void open(r.id)}>
                <span className="admin-row__title">{r.name}</span>
                <span className="admin-row__sub">{r.cuisines.join(", ")} · {r.address}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div className="admin-card admin-detail">
            <h2 className="admin-detail__name serif">{selected.name}</h2>
            <p className="admin-detail__line">{selected.address}</p>
            <p className="admin-detail__line">{selected.cuisines.join(", ")}</p>
            <p className="admin-detail__line">Hours: {selected.opensAt}–{selected.closesAt}</p>
            <p className="admin-detail__desc">{selected.description || "No description provided."}</p>
            <label className="admin-field">
              <span>Reason (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for approve/reject" />
            </label>
            <div className="admin-actions">
              <button className="btn-primary" disabled={busy} onClick={() => void decide("approve")}>Approve</button>
              <button className="btn-danger" disabled={busy} onClick={() => void decide("reject")}>Reject</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add shared list/detail CSS** to `admin.css` (reused by Users/Moderation/Promotions too):
```css
.admin-split { display: grid; grid-template-columns: minmax(260px, 360px) 1fr; gap: var(--s-lg); align-items: start; }
.admin-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-sm); }
.admin-row { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px;
  background: var(--off-white); border: 1px solid var(--beige); border-radius: var(--r-md); padding: 12px 14px;
  transition: border-color var(--dur-fast) var(--ease-out-quart); }
.admin-row:active { transform: scale(0.99); }
.admin-row--active { border-color: var(--navy); }
.admin-row__title { color: var(--navy); font-weight: 600; }
.admin-row__sub { font-size: 12px; color: var(--brown); }
.admin-detail__name { margin: 0 0 var(--s-sm); color: var(--navy); }
.admin-detail__line { margin: 2px 0; color: var(--brown); font-size: 14px; }
.admin-detail__desc { margin: var(--s-md) 0; color: var(--ink); }
.admin-field { display: flex; flex-direction: column; gap: 4px; margin: var(--s-md) 0; font-size: 13px; color: var(--brown); }
.admin-field input, .admin-field select {
  font: inherit; color: var(--ink); background: var(--cream); border: 1px solid var(--beige);
  border-radius: var(--r-sm); padding: 10px 12px; }
.admin-field input:focus, .admin-field select:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(227,175,4,.25); }
.admin-actions { display: flex; gap: var(--s-sm); margin-top: var(--s-md); }
.admin-muted { color: var(--brown); }
@media (max-width: 720px) { .admin-split { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Wire into `AdminShell`** — import `AApprovalsScreen`, set `<Route path="/approvals" element={<AApprovalsScreen />} />`.

- [ ] **Step 4: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/admin/AApprovalsScreen.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css
git commit -m "feat(admin): approvals screen"
```

---

### Task 13: Frontend — Users screen

**Files:**
- Create: `app/src/screens/admin/AUsersScreen.tsx`
- Modify: `app/src/shells/AdminShell.tsx`
- Modify: `app/src/styles/admin.css`

**Interfaces:**
- Consumes: `SearchBar` (`app/src/components/SearchBar`), `Chip` (`app/src/components/Chip`); `apiGet<{ users: AdminUserRow[] }>("/api/admin/users?q=&role=")`; `apiSend("POST", "/api/admin/users/:id/suspend", { reason })` and `.../reinstate`.

- [ ] **Step 1: Confirm `SearchBar`/`Chip` prop shapes**

Run: `cd app && npx tsc --noEmit` after a quick read of `app/src/components/SearchBar.tsx` and `Chip.tsx` to match their exact props (value/onChange/placeholder for SearchBar; label/selected/onClick for Chip). Use those props verbatim in Step 2.

- [ ] **Step 2: Create the screen** (SearchBar + role Chips; results list; Suspend `.btn-danger` / Reinstate `.btn-primary`; status via `.admin-pill`)

```tsx
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { Chip } from "../../components/Chip";
import type { AdminUserRow, UserRole } from "../../lib/types";

const ROLES: { key: "" | UserRole; label: string }[] = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "restaurant", label: "Restaurants" },
  { key: "delivery_partner", label: "Riders" },
];

export function AUsersScreen() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    setUsers(await apiGet<{ users: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`).then((r) => r.users));
  }, [q, role]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (u: AdminUserRow) => {
    const verb = u.suspended ? "reinstate" : "suspend";
    if (verb === "suspend" && !window.confirm(`Suspend ${u.name}? They will be unable to log in.`)) return;
    setBusyId(u.id);
    try { await apiSend("POST", `/api/admin/users/${u.id}/${verb}`, verb === "suspend" ? { reason: undefined } : undefined); await load(); }
    catch (e) { window.alert("Couldn't update this account."); }
    finally { setBusyId(null); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Users</h1>
      <SearchBar value={q} onChange={setQ} placeholder="Search name, email, or phone" />
      <div className="admin-chips">
        {ROLES.map((r) => <Chip key={r.key} label={r.label} selected={role === r.key} onClick={() => setRole(r.key)} />)}
      </div>
      <ul className="admin-list admin-list--wide">
        {users.map((u) => (
          <li key={u.id} className="admin-card admin-userrow">
            <div>
              <span className="admin-row__title">{u.name}</span>
              <span className="admin-row__sub">{u.role} · {u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="admin-userrow__right">
              <span className={`admin-pill ${u.suspended ? "admin-pill--bad" : "admin-pill--ok"}`}>{u.suspended ? "Suspended" : "Active"}</span>
              {u.role !== "admin" && (
                <button className={u.suspended ? "btn-primary" : "btn-danger"} disabled={busyId === u.id} onClick={() => void toggle(u)}>
                  {u.suspended ? "Reinstate" : "Suspend"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {users.length === 0 && <p className="admin-muted">No matching accounts.</p>}
    </div>
  );
}
```
> Match `SearchBar`/`Chip` prop names to the actual components from Step 1; adjust the JSX if they differ (e.g. `onChangeText` vs `onChange`).

- [ ] **Step 3: Add CSS** to `admin.css`:
```css
.admin-chips { display: flex; flex-wrap: wrap; gap: var(--s-sm); margin: var(--s-md) 0; }
.admin-list--wide { margin-top: var(--s-md); }
.admin-userrow { display: flex; align-items: center; justify-content: space-between; gap: var(--s-md); }
.admin-userrow__right { display: flex; align-items: center; gap: var(--s-md); }
```

- [ ] **Step 4: Wire into `AdminShell`** — `<Route path="/users" element={<AUsersScreen />} />`.

- [ ] **Step 5: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add app/src/screens/admin/AUsersScreen.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css
git commit -m "feat(admin): users screen"
```

---

### Task 14: Frontend — Moderation screen

**Files:**
- Create: `app/src/screens/admin/AModerationScreen.tsx`
- Modify: `app/src/shells/AdminShell.tsx`
- Modify: `app/src/styles/admin.css`

**Interfaces:**
- Consumes: `SearchBar`; `apiGet<{ reviews: AdminReviewRow[] }>("/api/admin/reviews?q=")`; `apiSend("DELETE", "/api/admin/reviews/:id")`.

- [ ] **Step 1: Create the screen** (search by restaurant; list reviews; stars in `--gold-deep`; Remove is `.btn-danger` with confirm)

```tsx
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import type { AdminReviewRow } from "../../lib/types";

export function AModerationScreen() {
  const [q, setQ] = useState("");
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    setReviews(await apiGet<{ reviews: AdminReviewRow[] }>(`/api/admin/reviews?${params.toString()}`).then((r) => r.reviews));
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (r: AdminReviewRow) => {
    if (!window.confirm(`Remove this review of ${r.restaurantName}? This can't be undone.`)) return;
    setBusyId(r.id);
    try { await apiSend("DELETE", `/api/admin/reviews/${r.id}`); await load(); }
    catch { window.alert("Couldn't remove this review."); }
    finally { setBusyId(null); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Moderation</h1>
      <SearchBar value={q} onChange={setQ} placeholder="Search reviews by restaurant" />
      <ul className="admin-list admin-list--wide">
        {reviews.map((r) => (
          <li key={r.id} className="admin-card admin-reviewrow">
            <div className="admin-reviewrow__body">
              <span className="admin-reviewrow__head">
                <span className="admin-reviewrow__stars mono">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                <span className="admin-row__sub">{r.restaurantName} · {r.authorName}</span>
              </span>
              <p className="admin-reviewrow__text">{r.reviewText}</p>
            </div>
            <button className="btn-danger" disabled={busyId === r.id} onClick={() => void remove(r)}>Remove</button>
          </li>
        ))}
      </ul>
      {reviews.length === 0 && <p className="admin-muted">No reviews found.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS** to `admin.css`:
```css
.admin-reviewrow { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--s-md); }
.admin-reviewrow__body { display: flex; flex-direction: column; gap: 4px; }
.admin-reviewrow__head { display: flex; align-items: center; gap: var(--s-sm); }
.admin-reviewrow__stars { color: var(--gold-deep); letter-spacing: 1px; }
.admin-reviewrow__text { margin: 0; color: var(--ink); }
```

- [ ] **Step 3: Wire into `AdminShell`** — `<Route path="/moderation" element={<AModerationScreen />} />`.

- [ ] **Step 4: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/admin/AModerationScreen.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css
git commit -m "feat(admin): moderation screen"
```

---

### Task 15: Frontend — Promotions screen

**Files:**
- Create: `app/src/screens/admin/APromotionsScreen.tsx`
- Modify: `app/src/shells/AdminShell.tsx`
- Modify: `app/src/styles/admin.css`

**Interfaces:**
- Consumes: `apiGet<{ promos: AdminPromo[] }>("/api/admin/promos")`; `apiSend("POST", "/api/admin/promos", body)`; `apiSend("POST", "/api/admin/promos/:id/deactivate")`.

- [ ] **Step 1: Create the screen** (list codes in mono; Create form with discount-type Chips; Deactivate outline button)

```tsx
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import type { AdminPromo, DiscountType } from "../../lib/types";

export function APromotionsScreen() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPromos(await apiGet<{ promos: AdminPromo[] }>("/api/admin/promos").then((r) => r.promos));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setError(null); setBusy(true);
    try {
      await apiSend("POST", "/api/admin/promos", {
        code, discountType, discountValue: Number(value),
        expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
      });
      setCode(""); setValue(""); setExpiry("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? "That code already exists." : "Couldn't create the code. Check the values.");
    } finally { setBusy(false); }
  };

  const deactivate = async (p: AdminPromo) => {
    if (!window.confirm(`Deactivate ${p.code}?`)) return;
    try { await apiSend("POST", `/api/admin/promos/${p.id}/deactivate`); await load(); }
    catch { window.alert("Couldn't deactivate this code."); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Promotions</h1>
      <div className="admin-card admin-promoform">
        <div className="admin-field"><span>Code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" /></div>
        <div className="admin-field"><span>Type</span>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (Rs, in cents)</option>
          </select>
        </div>
        <div className="admin-field"><span>Value</span><input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder={discountType === "percentage" ? "1–100" : "cents"} /></div>
        <div className="admin-field"><span>Expiry (optional)</span><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
        <button className="btn-primary" disabled={busy} onClick={() => void create()}>Create Promo Code</button>
        {error && <p className="admin-error">{error}</p>}
      </div>
      <ul className="admin-list admin-list--wide">
        {promos.map((p) => (
          <li key={p.id} className="admin-card admin-promorow">
            <div>
              <span className="admin-promorow__code mono">{p.code}</span>
              <span className="admin-row__sub">
                {p.discountType === "percentage" ? `${p.discountValue}% off` : `Rs ${(p.discountValue / 100).toFixed(0)} off`}
                {p.expiresAt ? ` · expires ${new Date(p.expiresAt).toLocaleDateString()}` : ""}
              </span>
            </div>
            <div className="admin-userrow__right">
              <span className={`admin-pill ${p.active ? "admin-pill--ok" : "admin-pill--warn"}`}>{p.active ? "Active" : "Inactive"}</span>
              {p.active && <button className="btn-danger" onClick={() => void deactivate(p)}>Deactivate</button>}
            </div>
          </li>
        ))}
      </ul>
      {promos.length === 0 && <p className="admin-muted">No promo codes yet.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS** to `admin.css`:
```css
.admin-promoform { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--s-md); align-items: end; margin-bottom: var(--s-lg); }
.admin-promoform .btn-primary { align-self: end; }
.admin-promorow { display: flex; align-items: center; justify-content: space-between; gap: var(--s-md); }
.admin-promorow__code { display: block; color: var(--navy); font-size: 16px; }
```

- [ ] **Step 3: Wire into `AdminShell`** — `<Route path="/promotions" element={<APromotionsScreen />} />`.

- [ ] **Step 4: Verify build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/admin/APromotionsScreen.tsx app/src/shells/AdminShell.tsx app/src/styles/admin.css
git commit -m "feat(admin): promotions screen"
```

---

### Task 16: Full verification + push

**Files:** none (verification only).

- [ ] **Step 1: Backend — full suite + type-check**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: all tests green, exit 0.

- [ ] **Step 2: Frontend — build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: success.

- [ ] **Step 3: End-to-end manual verify (use the `verify` skill)**

Start the backend and app locally (or against the dev DB). Log in as `admin@demo.feastnow.pk / Admin1234!` and confirm:
- The AdminShell renders full-width with the sidebar (not the phone frame).
- Dashboard shows three numbers.
- Approvals: a pending restaurant (create one via a normal restaurant signup) can be approved and then appears in customer browse; reject keeps it hidden.
- Users: search returns accounts; suspending a customer blocks their next login (`/login` → 403) and `/me` → 401; reinstating restores access; suspending a restaurant owner removes their restaurant from browse and reinstating restores it; Suspend is not offered for admin rows.
- Moderation: a seeded review can be removed and the restaurant's rating recomputes.
- Promotions: create a code (verify it uppercases), duplicate is rejected, deactivate flips the pill.

- [ ] **Step 4: Push**

```bash
git push origin main
```
Expected: Render redeploys the backend (runs the new migration on boot); Vercel redeploys the app.

---

## Self-Review

**Spec coverage:**
- FR-36 (admin auth, separate credentials feel) → Tasks 2, 9 (requireAdmin + seeded admin; shared table per approved spec).
- FR-37 (approvals) → Task 5 (+ Task 12 UI).
- FR-38 (users suspend/reinstate) → Tasks 3, 6 (+ Task 13 UI).
- FR-39 (moderation) → Task 7 (+ Task 14 UI).
- FR-40 (promotions) → Task 8 (+ Task 15 UI).
- FR-41 (dashboard metrics) → Task 4 (+ Task 11 UI).
- Design fidelity mandate → Global Constraints + every frontend task uses tokens/idioms only.
- Suspension enforcement (spec §3.3) → Task 3 (login/me) + Task 6 (isActive flip, refined from "extend predicate" because no User↔RestaurantProfile relation exists to join on).
- Retire lazy auto-approve (implied by real approvals) → Task 5.

**Placeholder scan:** No "TBD/handle appropriately" left. The two "match the actual component props" notes (Tasks 3, 13) point to a concrete verification step, not deferred work.

**Type consistency:** `AdminMetrics`, `AdminUserRow`, `AdminReviewRow`, `AdminApprovalRow`, `AdminRestaurantDetail`, `AdminPromo`, `DiscountType`, `CreatePromoInput`, `AdminRepository` are defined once (Task 4 backend / Task 10 frontend) and referenced consistently. Router DTOs (`userRow`, `promoRow`, `approvalRow`) map Date→ISO string uniformly. `req.adminUser` from `AdminRequest` is used only after `requireAdmin`.

**Scope:** One cohesive role, sequenced backend→frontend; each task independently testable.
