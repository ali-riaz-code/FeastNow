# Delivery Partner Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Delivery Partner role — signup/approval, an availability toggle, nearest-partner order assignment with timed offers, an active-delivery flow (navigate via Google Maps deep-link, confirm pickup, mark delivered), earnings, and cross-role status visibility — as a plain web SPA plus backend, with zero external accounts.

**Architecture:** Backend adds a delivery aggregate (`DeliveryPartnerProfile`, `DeliveryOffer`, new `Order` fields) behind one `deliveryRepository`, a pure `deliveryAssignment` engine that runs on a lazy "tick", and a `/api/delivery/*` router guarded by a `requirePartner` middleware. The order state machine (the single source of truth) is extended past `ready`. The frontend adds a `DeliveryShell` (3 tabs) selected by `User.role`, mirroring the existing `RestaurantShell` pattern. Navigation is a Google Maps deep-link; contact is `tel:`; location uses the free browser Geolocation API.

**Tech Stack:** Node + TypeScript + Express + Prisma + Postgres (backend, Vitest + supertest tests); React + Vite + TypeScript SPA (frontend, no test runner — gated on `tsc` + ESLint + build); vanilla HTML/JS (`landing/`).

## Global Constraints

- TypeScript strict everywhere; camelCase vars/functions, PascalCase types/components, snake_case only mirroring DB columns.
- Money is **integer cents**; snapshot on write, never recompute historical values (same rule as `price_at_order`).
- Order status transitions validated in ONE place — `backend/src/lib/orderStateMachine.ts`. Never re-implement a transition per endpoint.
- Role-specific UI sits behind the shared API layer (NFR-7); fork presentation only, never business logic.
- Repositories expose an interface + a real Prisma impl + an in-memory fake (`backend/tests/test-helpers/`); routers are TDD-tested with supertest against fakes.
- Status is always shown as color **+ icon + label** (color-blind safe), per `DESIGN.md`. Motion 150–250ms with reduced-motion fallbacks.
- Payout config (one place): `PAYOUT_BASE_CENTS = 5000` (PKR 50), `PAYOUT_PER_KM_CENTS = 1500` (PKR 15/km). Offer window `OFFER_WINDOW_MS = 45000`, `MAX_OFFER_ATTEMPTS = 5`, `LOCATION_STALE_MS = 60000`, `LOCATION_PING_MS = 10000`.
- Partners are **auto-approved on signup this phase** (approval-gate UI wired but dormant); real admin approval arrives later.
- Customer live-map tracking is out of scope; customers see a **status timeline** only (FR-27 reduction, recorded in the spec).
- Commit after every task with a conventional message; end each with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Run backend tests before committing backend tasks.

**Spec:** `docs/superpowers/specs/2026-07-18-delivery-partner-role-design.md`

---

## File Structure

**Backend — create:**
- `backend/src/lib/geo.ts` — `haversineKm(a, b)` great-circle distance.
- `backend/src/lib/deliveryConfig.ts` — the numeric constants above + `computePayoutCents(distanceKm)`.
- `backend/src/lib/deliveryAssignment.ts` — pure engine: `runAssignmentTick`, `acceptOffer`, `declineOffer`, `releaseOrder` over the repo interface.
- `backend/src/lib/deliveryDTO.ts` — `toOfferDTO`, `toActiveDeliveryDTO`, `toPartnerDTO`, `toEarningsDTO`.
- `backend/src/repositories/deliveryRepository.ts` — the delivery aggregate (partner profile, eligibility, offers, delivery order ops, earnings) + interface.
- `backend/src/middleware/requirePartner.ts` — `requireAuth` + resolve caller's `DeliveryPartnerProfile`.
- `backend/src/routes/deliveryRouter.ts` — all `/api/delivery/*` endpoints.
- `backend/tests/test-helpers/fakeDeliveryRepository.ts` — in-memory fake + `makePartner`, `makeOffer` fixtures.
- Test files: `backend/tests/lib/geo.test.ts`, `.../deliveryConfig.test.ts`, `.../deliveryAssignment.test.ts`, `backend/tests/routes/deliveryRouter.test.ts`.

**Backend — modify:**
- `backend/prisma/schema.prisma` (+ a migration) — new models/enums/fields.
- `backend/src/lib/orderStateMachine.ts` — `delivery_partner` actor + post-ready transitions + timestamp fields.
- `backend/src/lib/orderDTO.ts` — delivery timestamps, `payoutCents`, `deliveryPartnerName`.
- `backend/src/repositories/orderRepository.ts` (+ `OrderWithItems`) — expose `deliveryPartner` relation + coords needed by DTO/engine.
- `backend/src/repositories/userRepository.ts` (+ fake) — `createDeliveryPartner`.
- `backend/src/routes/authRouter.ts` — delivery-partner signup branch.
- `backend/src/routes/customerOrdersRouter.ts` — accept optional `deliveryLat/deliveryLng` at checkout.
- `backend/src/routes/ownerOrdersRouter.ts` — trigger `runAssignmentTick` after a `ready` transition.
- `backend/src/app.ts` — instantiate `deliveryRepo`, mount `deliveryRouter`, pass `deliveryRepo` to owner-orders router.
- `backend/prisma/seed.ts` — backfill demo restaurant `lat/lng`; add a demo partner.

**Frontend — create:**
- `app/src/shells/DeliveryShell.tsx`, `app/src/PartnerContext.tsx`.
- `app/src/screens/delivery/DAvailabilityScreen.tsx`, `AssignmentOfferModal.tsx`, `DActiveDeliveryScreen.tsx`, `DEarningsScreen.tsx`, `DProfileScreen.tsx`, `DPendingApprovalScreen.tsx`.
- `app/src/lib/geolocation.ts` — browser Geolocation wrapper.
- `app/src/styles/delivery.css`.
- `landing/signup-delivery.html` + `landing/assets/js/signup-delivery.js` (or inline, matching the existing signup page).

**Frontend — modify:**
- `app/src/App.tsx` — route `delivery_partner` → `DeliveryShell`.
- `app/src/lib/types.ts` — delivery DTO types + `OrderDTO` additions.
- `app/src/components/OrderStatus.tsx` — render `assigned/out_for_delivery/delivered`.
- `app/src/screens/OrderDetailScreen.tsx` — extend the customer timeline past `ready`.
- `app/src/screens/restaurant/ROrderDetailScreen.tsx` — show assignment/rider status.
- `landing/role-select.html` — third role tile.

---

# PHASE 1 — BACKEND

### Task 1: Schema — delivery models, enums, and Order/Restaurant fields

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Produces: Prisma models `DeliveryPartnerProfile`, `DeliveryOffer`; enums `VehicleType`, `AvailabilityStatus`, `OfferStatus`; `Order.deliveryPartnerId/deliveryLat/deliveryLng/payoutCents/assignedAt/outForDeliveryAt/deliveredAt/proofNote`; `RestaurantProfile.lat/lng`. Generated Prisma client types consumed by every later backend task.

- [ ] **Step 1: Add enums and models to `schema.prisma`**

Add near the other enums:
```prisma
enum VehicleType { bike motorcycle car }
enum AvailabilityStatus { offline online }
enum OfferStatus { pending accepted declined expired }
```

Add two new models:
```prisma
model DeliveryPartnerProfile {
  id                 String             @id @default(uuid())
  userId             String             @unique
  vehicleType        VehicleType
  idDocumentUrl      String?
  availabilityStatus AvailabilityStatus @default(offline)
  currentLat         Float?
  currentLng         Float?
  locationUpdatedAt  DateTime?
  approvedAt         DateTime?
  createdAt          DateTime           @default(now())

  @@index([availabilityStatus])
}

model DeliveryOffer {
  id          String      @id @default(uuid())
  orderId     String
  partnerId   String      // User id of the offered partner
  status      OfferStatus @default(pending)
  sequence    Int         @default(1)
  offeredAt   DateTime    @default(now())
  expiresAt   DateTime
  respondedAt DateTime?

  @@index([partnerId, status])
  @@index([orderId, status])
}
```

- [ ] **Step 2: Add fields to `RestaurantProfile` and `Order`**

In `RestaurantProfile`, add (after `heroImageUrl`):
```prisma
  lat            Float?
  lng            Float?
```

In `Order`, add (after `closedAt`):
```prisma
  deliveryPartnerId String?
  deliveryLat       Float?
  deliveryLng       Float?
  payoutCents       Int?
  assignedAt        DateTime?
  outForDeliveryAt  DateTime?
  deliveredAt       DateTime?
  proofNote         String?
```
Add an index for the assignment tick's "ready orders" scan:
```prisma
  @@index([status])
```

- [ ] **Step 3: Create the migration**

Run: `cd backend && npx prisma migrate dev --name delivery_partner_role`
Expected: a new folder under `backend/prisma/migrations/` and "Your database is now in sync"; `@prisma/client` regenerated.

- [ ] **Step 4: Seed demo restaurant coordinates + a demo partner**

In `seed.ts`, give each demo restaurant a `lat`/`lng` around Karachi (spread them a little), e.g. add `lat: 24.86 + i * 0.01, lng: 67.01 + i * 0.01` where `i` is the loop index. Add one demo partner after users are created:
```ts
const partnerUser = await prisma.user.create({
  data: { name: "Demo Rider", email: "rider@demo.feastnow", phone: "03009990000",
    passwordHash: demoHash, role: "delivery_partner" },
});
await prisma.deliveryPartnerProfile.create({
  data: { userId: partnerUser.id, vehicleType: "motorcycle",
    availabilityStatus: "offline", approvedAt: new Date() },
});
```
(Reuse the same `demoHash` the seed already computes for demo users; match the existing seed's variable names.)

- [ ] **Step 5: Verify build + seed**

Run: `cd backend && npx tsc --noEmit && npx prisma db seed`
Expected: no type errors; seed completes without error.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma
git commit -m "feat(db): delivery partner schema — profile, offers, order delivery fields"
```

---

### Task 2: Extend the order state machine past `ready`

**Files:**
- Modify: `backend/src/lib/orderStateMachine.ts`
- Test: `backend/tests/lib/orderStateMachine.test.ts`

**Interfaces:**
- Consumes: existing `OrderActor`, `TRANSITIONS`, `canTransition`, `timestampFieldFor`.
- Produces: `OrderActor` now includes `"delivery_partner"`; `canTransition` allows `system: ready→assigned`, `delivery_partner: assigned→out_for_delivery→delivered`; `timestampFieldFor` returns `"assignedAt" | "outForDeliveryAt" | "deliveredAt"` for the new statuses.

- [ ] **Step 1: Write failing tests**

Append to `orderStateMachine.test.ts`:
```ts
import { canTransition, timestampFieldFor } from "../../src/lib/orderStateMachine";

describe("delivery lifecycle transitions", () => {
  it("system assigns a ready order", () => {
    expect(canTransition("ready", "assigned", "system")).toBe(true);
  });
  it("partner drives assigned → out_for_delivery → delivered", () => {
    expect(canTransition("assigned", "out_for_delivery", "delivery_partner")).toBe(true);
    expect(canTransition("out_for_delivery", "delivered", "delivery_partner")).toBe(true);
  });
  it("blocks illegal delivery moves", () => {
    expect(canTransition("assigned", "delivered", "delivery_partner")).toBe(false);   // skip
    expect(canTransition("ready", "assigned", "delivery_partner")).toBe(false);        // wrong actor
    expect(canTransition("delivered", "out_for_delivery", "delivery_partner")).toBe(false);
    expect(canTransition("assigned", "out_for_delivery", "restaurant")).toBe(false);   // wrong actor
  });
  it("maps delivery timestamps", () => {
    expect(timestampFieldFor("assigned")).toBe("assignedAt");
    expect(timestampFieldFor("out_for_delivery")).toBe("outForDeliveryAt");
    expect(timestampFieldFor("delivered")).toBe("deliveredAt");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/lib/orderStateMachine.test.ts`
Expected: FAIL (`ready→assigned` returns false; `timestampFieldFor("assigned")` returns null).

- [ ] **Step 3: Implement**

In `orderStateMachine.ts`:
- Widen the type: `export type OrderActor = "customer" | "restaurant" | "delivery_partner" | "system";`
- In `TRANSITIONS`, add the delivery actor and extend system:
```ts
  delivery_partner: {
    assigned: ["out_for_delivery"],
    out_for_delivery: ["delivered"],
  },
  system: { placed: ["rejected"], ready: ["assigned"] },
```
- Widen the timestamp map + return type to include the new fields:
```ts
const TIMESTAMP_FIELDS: Partial<Record<OrderStatus,
  "acceptedAt" | "preparingAt" | "readyAt" | "assignedAt" | "outForDeliveryAt" | "deliveredAt" | "closedAt">> = {
  accepted: "acceptedAt", preparing: "preparingAt", ready: "readyAt",
  assigned: "assignedAt", out_for_delivery: "outForDeliveryAt", delivered: "deliveredAt",
  rejected: "closedAt", cancelled: "closedAt",
};
export function timestampFieldFor(to: OrderStatus):
  "acceptedAt" | "preparingAt" | "readyAt" | "assignedAt" | "outForDeliveryAt" | "deliveredAt" | "closedAt" | null {
  return TIMESTAMP_FIELDS[to] ?? null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run tests/lib/orderStateMachine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/orderStateMachine.ts backend/tests/lib/orderStateMachine.test.ts
git commit -m "feat: extend order state machine to delivery lifecycle"
```

---

### Task 3: Geo distance + payout config

**Files:**
- Create: `backend/src/lib/geo.ts`, `backend/src/lib/deliveryConfig.ts`
- Test: `backend/tests/lib/geo.test.ts`, `backend/tests/lib/deliveryConfig.test.ts`

**Interfaces:**
- Produces: `haversineKm(a: LatLng, b: LatLng): number` where `LatLng = { lat: number; lng: number }`; `computePayoutCents(distanceKm: number | null): number`; constants `OFFER_WINDOW_MS`, `MAX_OFFER_ATTEMPTS`, `PAYOUT_BASE_CENTS`, `PAYOUT_PER_KM_CENTS`, `LOCATION_STALE_MS`, `LOCATION_PING_MS`.

- [ ] **Step 1: Write failing tests**

`geo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { haversineKm } from "../../src/lib/geo";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: 24.86, lng: 67.01 }, { lat: 24.86, lng: 67.01 })).toBe(0);
  });
  it("approximates a known short distance (~1.57 km per 0.01° lat)", () => {
    const d = haversineKm({ lat: 24.86, lng: 67.01 }, { lat: 24.87, lng: 67.01 });
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});
```
`deliveryConfig.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computePayoutCents, PAYOUT_BASE_CENTS } from "../../src/lib/deliveryConfig";

describe("computePayoutCents", () => {
  it("is base-only when distance is unknown", () => {
    expect(computePayoutCents(null)).toBe(PAYOUT_BASE_CENTS);
  });
  it("adds per-km, rounded", () => {
    expect(computePayoutCents(3.5)).toBe(PAYOUT_BASE_CENTS + Math.round(3.5 * 1500)); // 5000 + 5250 = 10250
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/lib/geo.test.ts tests/lib/deliveryConfig.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`geo.ts`:
```ts
export interface LatLng { lat: number; lng: number; }

const R_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}
```
`deliveryConfig.ts`:
```ts
export const OFFER_WINDOW_MS = 45_000;
export const MAX_OFFER_ATTEMPTS = 5;
export const PAYOUT_BASE_CENTS = 5_000;    // PKR 50.00
export const PAYOUT_PER_KM_CENTS = 1_500;  // PKR 15.00 / km
export const LOCATION_STALE_MS = 60_000;
export const LOCATION_PING_MS = 10_000;

/** Snapshot-friendly payout: base fare + per-km, or base-only when distance is unknown. */
export function computePayoutCents(distanceKm: number | null): number {
  if (distanceKm === null) return PAYOUT_BASE_CENTS;
  return PAYOUT_BASE_CENTS + Math.round(distanceKm * PAYOUT_PER_KM_CENTS);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run tests/lib/geo.test.ts tests/lib/deliveryConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/geo.ts backend/src/lib/deliveryConfig.ts backend/tests/lib/geo.test.ts backend/tests/lib/deliveryConfig.test.ts
git commit -m "feat: geo distance + delivery payout config"
```

---

### Task 4: Delivery repository interface + fake + Prisma impl

**Files:**
- Create: `backend/src/repositories/deliveryRepository.ts`, `backend/tests/test-helpers/fakeDeliveryRepository.ts`

**Interfaces:**
- Consumes: `OrderWithItems` (extended in Task 8), `VehicleType`, `AvailabilityStatus`, `OfferStatus` from Prisma.
- Produces the `DeliveryRepository` interface below; the engine (Task 5) and router (Tasks 6–10) depend only on it. The fake is the test double for all engine/router tests.

- [ ] **Step 1: Define the interface + Prisma impl**

Create `deliveryRepository.ts`:
```ts
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
```
Then the Prisma implementation. Key queries (write the full factory `createDeliveryRepository(prisma)`; representative methods shown — implement all interface methods analogously):
```ts
const ORDER_INCLUDE = {
  items: true,
  customer: { select: { name: true, phone: true } },
  restaurant: { select: { name: true } },
} as const;

// listEligiblePartners: online + approved + fresh location + coords present
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
listReadyOrders() {
  return prisma.order.findMany({
    where: { status: "ready" },
    select: { id: true, deliveryLat: true, deliveryLng: true, restaurant: { select: { lat: true, lng: true } } },
  }).then((rows) => rows.map((o) => ({ id: o.id, deliveryLat: o.deliveryLat, deliveryLng: o.deliveryLng,
    restaurantLat: o.restaurant.lat, restaurantLng: o.restaurant.lng })));
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
    include: { ...ORDER_INCLUDE, restaurant: { select: { name: true, address: true, lat: true, lng: true, user: { select: { phone: true } } } } },
  }).then((o) => o && ({ ...o, restaurantLat: o.restaurant.lat, restaurantLng: o.restaurant.lng, restaurantPhone: o.restaurant.user?.phone ?? null } as never));
},
```
For `updateProfile` (name/phone live on `User`, vehicleType on the profile), use a transaction:
```ts
async updateProfile(userId, { name, phone, vehicleType }) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { name, phone } }),
    prisma.deliveryPartnerProfile.update({ where: { userId }, data: { vehicleType } }),
  ]);
  return this.findByUserId(userId) as Promise<PartnerView>;
},
```
`findByUserId` joins the profile + user:
```ts
findByUserId(userId) {
  return prisma.deliveryPartnerProfile.findUnique({
    where: { userId }, include: { /* no relation defined; fetch user separately */ } })
    .then(async (p) => p && {
      id: p.id, userId: p.userId,
      ...(await prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } }))!,
      vehicleType: p.vehicleType, availabilityStatus: p.availabilityStatus, approvedAt: p.approvedAt,
      currentLat: p.currentLat, currentLng: p.currentLng, locationUpdatedAt: p.locationUpdatedAt,
    });
},
```

- [ ] **Step 2: Write the in-memory fake**

Create `fakeDeliveryRepository.ts` implementing `DeliveryRepository` over arrays, plus fixtures:
```ts
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

export function createFakeDeliveryRepository(
  partners: PartnerView[] = [], offers: OfferRecord[] = [], orders: OrderWithItems[] = [],
): DeliveryRepository & { partners: PartnerView[]; offers: OfferRecord[]; orders: OrderWithItems[] } {
  // Implement every method over these arrays. Guarded ops mirror the fakeOrderRepository semantics:
  //  - assignOrder: only when order.status === "ready"; set status/deliveryPartnerId/assignedAt/payoutCents.
  //  - deliveryTransition: only when status === from AND deliveryPartnerId === partnerUserId.
  //  - releaseOrder: only when status in {assigned,out_for_delivery} AND deliveryPartnerId === partnerUserId.
  //  - expireOverduePendingOffers: flip pending→expired where expiresAt <= now, return the changed rows.
  //  - listEligiblePartners: online + approvedAt + coords + locationUpdatedAt >= freshSince.
  //  - activePartnerUserIds: from orders in {assigned,out_for_delivery}.
  //  - findActiveForPartner / findOrderForDelivery: attach restaurantLat/Lng/Phone (default 24.87/67.02/"0311").
  // Return the arrays too so tests can assert on state.
}
```
(Write out every method fully — the comments above enumerate the exact semantics for each.)

- [ ] **Step 3: Type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. (Behaviour is proven by Tasks 5–10.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/repositories/deliveryRepository.ts backend/tests/test-helpers/fakeDeliveryRepository.ts
git commit -m "feat: delivery repository interface, prisma impl, and in-memory fake"
```

---

### Task 5: Assignment engine (the core)

**Files:**
- Create: `backend/src/lib/deliveryAssignment.ts`
- Test: `backend/tests/lib/deliveryAssignment.test.ts`

**Interfaces:**
- Consumes: `DeliveryRepository`, `haversineKm`, `computePayoutCents`, config constants.
- Produces:
  - `runAssignmentTick(repo, now): Promise<void>` — expire overdue offers, then offer each ready+unoffered order to the nearest eligible partner (respecting `MAX_OFFER_ATTEMPTS` and never re-offering a partner who already has an offer for that order).
  - `acceptOffer(repo, offerId, partnerUserId, now): Promise<{ ok: true; order: OrderWithItems } | { ok: false; code: "not_found" | "expired" | "taken" }>`.
  - `declineOffer(repo, offerId, partnerUserId, now): Promise<boolean>`.
  - `releaseOrder(repo, orderId, partnerUserId, now): Promise<OrderWithItems | null>`.

- [ ] **Step 1: Write failing tests**

`deliveryAssignment.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runAssignmentTick, acceptOffer, declineOffer } from "../../src/lib/deliveryAssignment";
import { createFakeDeliveryRepository, makePartner } from "../test-helpers/fakeDeliveryRepository";
import { makeOrder } from "../test-helpers/fakeOrderRepository";

const ready = (o = {}) => makeOrder({ status: "ready", deliveryLat: 24.90, deliveryLng: 67.05, ...o });

describe("runAssignmentTick", () => {
  it("offers a ready order to the nearest eligible partner", async () => {
    const near = makePartner({ userId: "near", currentLat: 24.861, currentLng: 67.011 });
    const far  = makePartner({ userId: "far", currentLat: 25.50, currentLng: 67.90 });
    const repo = createFakeDeliveryRepository([near, far], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    expect(repo.offers).toHaveLength(1);
    expect(repo.offers[0]).toMatchObject({ orderId: "o1", partnerId: "near", status: "pending" });
  });

  it("does not double-offer an order that already has a pending offer", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    await runAssignmentTick(repo, new Date());
    expect(repo.offers).toHaveLength(1);
  });

  it("re-offers to the next nearest after an offer expires, skipping the first partner", async () => {
    const p1 = makePartner({ userId: "p1", currentLat: 24.861, currentLng: 67.011 });
    const p2 = makePartner({ userId: "p2", currentLat: 24.870, currentLng: 67.020 });
    const repo = createFakeDeliveryRepository([p1, p2], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());                 // → p1
    const later = new Date(Date.now() + 46_000);
    await runAssignmentTick(repo, later);                       // p1 offer expires → p2
    const pending = repo.offers.filter((o) => o.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].partnerId).toBe("p2");
    expect(repo.offers.filter((o) => o.status === "expired")).toHaveLength(1);
  });

  it("stops after MAX_OFFER_ATTEMPTS and leaves the order ready (seeking rider)", async () => {
    const partners = Array.from({ length: 6 }, (_, i) => makePartner({ userId: `p${i}`, currentLat: 24.86 + i * 0.001, currentLng: 67.01 }));
    const repo = createFakeDeliveryRepository(partners, [], [ready({ id: "o1" })]);
    let t = Date.now();
    for (let i = 0; i < 7; i++) { await runAssignmentTick(repo, new Date(t)); t += 46_000; }
    expect(repo.offers.filter((o) => o.status === "pending")).toHaveLength(0);
    expect(repo.orders[0].status).toBe("ready");
  });
});

describe("acceptOffer", () => {
  it("assigns the order and snapshots payout", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    const offerId = repo.offers[0].id;
    const res = await acceptOffer(repo, offerId, "p1", new Date());
    expect(res.ok).toBe(true);
    expect(repo.orders[0]).toMatchObject({ status: "assigned", deliveryPartnerId: "p1" });
    expect(repo.orders[0].payoutCents).toBeGreaterThan(5000); // base + per-km
  });

  it("returns taken when the order was already assigned (race)", async () => {
    const a = makePartner({ userId: "a" }), b = makePartner({ userId: "b", currentLat: 24.862, currentLng: 67.012 });
    const repo = createFakeDeliveryRepository([a, b], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    // Force a second pending offer to a different partner for the same order:
    repo.offers.push({ ...repo.offers[0], id: "of-race", partnerId: "b" });
    await acceptOffer(repo, repo.offers[0].id, "a", new Date());
    const res = await acceptOffer(repo, "of-race", "b", new Date());
    expect(res).toEqual({ ok: false, code: "taken" });
  });

  it("returns expired for a stale offer", async () => {
    const p = makePartner({ userId: "p1" });
    const repo = createFakeDeliveryRepository([p], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    const res = await acceptOffer(repo, repo.offers[0].id, "p1", new Date(Date.now() + 46_000));
    expect(res).toEqual({ ok: false, code: "expired" });
  });
});

describe("declineOffer", () => {
  it("marks the offer declined so the next tick reassigns", async () => {
    const p1 = makePartner({ userId: "p1" }), p2 = makePartner({ userId: "p2", currentLat: 24.87, currentLng: 67.02 });
    const repo = createFakeDeliveryRepository([p1, p2], [], [ready({ id: "o1" })]);
    await runAssignmentTick(repo, new Date());
    await declineOffer(repo, repo.offers[0].id, "p1", new Date());
    await runAssignmentTick(repo, new Date());
    const pending = repo.offers.filter((o) => o.status === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].partnerId).toBe("p2");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/lib/deliveryAssignment.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the engine**

`deliveryAssignment.ts`:
```ts
import type { DeliveryRepository, EligiblePartner } from "../repositories/deliveryRepository";
import type { OrderWithItems } from "../repositories/orderRepository";
import { haversineKm } from "./geo";
import { computePayoutCents, LOCATION_STALE_MS, MAX_OFFER_ATTEMPTS, OFFER_WINDOW_MS } from "./deliveryConfig";

export async function runAssignmentTick(repo: DeliveryRepository, now: Date): Promise<void> {
  await repo.expireOverduePendingOffers(now);

  const [readyOrders, eligible, activeIds] = await Promise.all([
    repo.listReadyOrders(),
    repo.listEligiblePartners(new Date(now.getTime() - LOCATION_STALE_MS)),
    repo.activePartnerUserIds(),
  ]);
  const busy = new Set(activeIds);
  const free = eligible.filter((p) => !busy.has(p.userId));

  for (const order of readyOrders) {
    const offers = await repo.listOffersForOrder(order.id);
    if (offers.some((o) => o.status === "pending" || o.status === "accepted")) continue;
    if (offers.length >= MAX_OFFER_ATTEMPTS) continue;
    if (order.restaurantLat == null || order.restaurantLng == null) continue;

    const alreadyOffered = new Set(offers.map((o) => o.partnerId));
    const candidates = free.filter((p) => !alreadyOffered.has(p.userId));
    if (candidates.length === 0) continue;

    const restaurant = { lat: order.restaurantLat, lng: order.restaurantLng };
    const nearest = nearestTo(candidates, restaurant);
    const sequence = offers.length + 1;
    await repo.createOffer({ orderId: order.id, partnerId: nearest.userId, sequence,
      expiresAt: new Date(now.getTime() + OFFER_WINDOW_MS), now });
  }
}

function nearestTo(partners: EligiblePartner[], to: { lat: number; lng: number }): EligiblePartner {
  return partners.reduce((best, p) =>
    haversineKm(p, to) < haversineKm(best, to) ? p : best);
}

type AcceptResult =
  | { ok: true; order: OrderWithItems }
  | { ok: false; code: "not_found" | "expired" | "taken" };

export async function acceptOffer(repo: DeliveryRepository, offerId: string, partnerUserId: string, now: Date): Promise<AcceptResult> {
  const offer = await repo.findOfferById(offerId);
  if (!offer || offer.partnerId !== partnerUserId) return { ok: false, code: "not_found" };
  if (offer.status !== "pending" || offer.expiresAt.getTime() <= now.getTime()) {
    if (offer.status === "pending") await repo.setOfferStatus(offer.id, "expired", now);
    return { ok: false, code: "expired" };
  }
  const order = await repo.findOrderForDelivery(offer.orderId);
  if (!order) return { ok: false, code: "not_found" };

  const distanceKm = (order.restaurantLat != null && order.restaurantLng != null &&
    order.deliveryLat != null && order.deliveryLng != null)
    ? haversineKm({ lat: order.restaurantLat, lng: order.restaurantLng }, { lat: order.deliveryLat, lng: order.deliveryLng })
    : null;
  const assigned = await repo.assignOrder(offer.orderId, partnerUserId, computePayoutCents(distanceKm), now);
  if (!assigned) { await repo.setOfferStatus(offer.id, "expired", now); return { ok: false, code: "taken" }; }

  await repo.setOfferStatus(offer.id, "accepted", now);
  await repo.expireSiblingOffers(offer.orderId, offer.id, now);
  return { ok: true, order: assigned };
}

export async function declineOffer(repo: DeliveryRepository, offerId: string, partnerUserId: string, now: Date): Promise<boolean> {
  const offer = await repo.findOfferById(offerId);
  if (!offer || offer.partnerId !== partnerUserId || offer.status !== "pending") return false;
  await repo.setOfferStatus(offer.id, "declined", now);
  return true;
}

export async function releaseOrder(repo: DeliveryRepository, orderId: string, partnerUserId: string, now: Date): Promise<OrderWithItems | null> {
  // Mark this partner's offer(s) for the order declined so the tick won't re-offer them, then free the order.
  const offers = await repo.listOffersForOrder(orderId);
  for (const o of offers) if (o.partnerId === partnerUserId && o.status === "accepted") await repo.setOfferStatus(o.id, "declined", now);
  return repo.releaseOrder(orderId, partnerUserId, now);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run tests/lib/deliveryAssignment.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/deliveryAssignment.ts backend/tests/lib/deliveryAssignment.test.ts
git commit -m "feat: delivery assignment engine (nearest offer, reassignment, accept race)"
```

---

### Task 6: Delivery-partner signup (userRepository + authRouter)

**Files:**
- Modify: `backend/src/repositories/userRepository.ts`, `backend/tests/test-helpers/fakeUserRepository.ts`
- Modify: `backend/src/routes/authRouter.ts`
- Test: `backend/tests/routes/authRouter.test.ts`

**Interfaces:**
- Consumes: existing OTP verify flow.
- Produces: `UserRepository.createDeliveryPartner({ name, email, phone, passwordHash, vehicleType }): Promise<User>` (creates `User` role `delivery_partner` + `DeliveryPartnerProfile` with `approvedAt = now`, in one transaction). Signup verify-otp accepts `role: "delivery_partner"` + `vehicleType`.

- [ ] **Step 1: Write failing test**

Append to `authRouter.test.ts` (mirror the restaurant signup test that already exists there):
```ts
it("creates a delivery_partner account with a vehicle type", async () => {
  // ...request-otp + fetch the OTP from the fake otpRepo exactly as the restaurant test does...
  const res = await request(app).post("/api/auth/signup/verify-otp").send({
    name: "Rider Ray", email: "ray@x.com", phone: "03001112222", password: "password1",
    otp, role: "delivery_partner", vehicleType: "bike",
  });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe("delivery_partner");
});
it("rejects a delivery_partner signup without a valid vehicle type", async () => {
  // ...same setup...
  const res = await request(app).post("/api/auth/signup/verify-otp").send({
    name: "Rider Ray", email: "ray2@x.com", phone: "03001112223", password: "password1", otp, role: "delivery_partner",
  });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts`
Expected: FAIL (role ignored; created as customer / vehicle validation missing).

- [ ] **Step 3: Implement**

In `userRepository.ts` add to the interface and impl:
```ts
createDeliveryPartner(data: { name: string; email: string; phone: string; passwordHash: string; vehicleType: VehicleType }): Promise<User>;
```
```ts
createDeliveryPartner({ vehicleType, ...user }) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { ...user, role: "delivery_partner" } });
    await tx.deliveryPartnerProfile.create({
      data: { userId: created.id, vehicleType, availabilityStatus: "offline", approvedAt: new Date() },
    });
    return created;
  });
}
```
(Import `VehicleType` from `@prisma/client`.) Add the same method to `fakeUserRepository.ts` (create a user with role `delivery_partner`; store any partner seed the fake needs).

In `authRouter.ts` verify-otp, extend the role branch:
```ts
const isPartner = role === "delivery_partner";
const VEHICLES = ["bike", "motorcycle", "car"];
if (isPartner && (typeof vehicleType !== "string" || !VEHICLES.includes(vehicleType))) {
  return res.status(400).json({ error: "A valid vehicle type is required for a delivery account." });
}
```
Read `vehicleType` from `req.body`, and in the user-creation switch:
```ts
user = isRestaurant ? await deps.userRepo.createRestaurantOwner({ ... })
     : isPartner ? await deps.userRepo.createDeliveryPartner({ name, email, phone, passwordHash, vehicleType })
     : await deps.userRepo.create({ name, email, phone, passwordHash });
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/userRepository.ts backend/tests/test-helpers/fakeUserRepository.ts backend/src/routes/authRouter.ts backend/tests/routes/authRouter.test.ts
git commit -m "feat: delivery partner signup (auto-approved profile)"
```

---

### Task 7: requirePartner middleware + deliveryRouter profile/availability/location

**Files:**
- Create: `backend/src/middleware/requirePartner.ts`, `backend/src/lib/deliveryDTO.ts`, `backend/src/routes/deliveryRouter.ts`
- Test: `backend/tests/routes/deliveryRouter.test.ts`

**Interfaces:**
- Consumes: `DeliveryRepository`, `createRequireAuth`.
- Produces: `createRequirePartner(jwtSecret, deliveryRepo): RequestHandler[]` setting `req.partner: PartnerView`; `createDeliveryRouter({ deliveryRepo, jwtSecret })`; `toPartnerDTO(p)`. Endpoints in this task: `GET/PATCH /api/delivery/me`, `POST /api/delivery/availability`, `POST /api/delivery/location`.

- [ ] **Step 1: Write failing tests**

`deliveryRouter.test.ts`:
```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createDeliveryRouter } from "../../src/routes/deliveryRouter";
import { createFakeDeliveryRepository, makePartner } from "../test-helpers/fakeDeliveryRepository";
import { signToken } from "../../src/lib/jwt";

const JWT = "test-secret";
const auth = (userId: string) => ({ Authorization: `Bearer ${signToken({ userId }, JWT)}` });

function buildApp(partners = [makePartner({ userId: "p1" })], offers = [], orders = []) {
  const deliveryRepo = createFakeDeliveryRepository(partners, offers, orders);
  const app = express(); app.use(express.json());
  app.use("/api/delivery", createDeliveryRouter({ deliveryRepo, jwtSecret: JWT }));
  return { app, deliveryRepo };
}

describe("GET /api/delivery/me", () => {
  it("returns the partner profile", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/delivery/me").set(auth("p1"));
    expect(res.status).toBe(200);
    expect(res.body.partner).toMatchObject({ vehicleType: "motorcycle", approved: true });
  });
  it("403s a non-partner", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/delivery/me").set(auth("nobody"))).status).toBe(403);
  });
});

describe("availability + location", () => {
  it("goes online only with a recent location, and blocks offline mid-delivery", async () => {
    const { app, deliveryRepo } = buildApp();
    await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: 24.86, lng: 67.01 });
    const on = await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "online" });
    expect(on.body.partner.availabilityStatus).toBe("online");
    // simulate an active delivery for this partner:
    deliveryRepo.orders.push({ ...deliveryRepo.orders[0] });
  });
  it("400s an invalid location", async () => {
    const { app } = buildApp();
    expect((await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: "x" })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/routes/deliveryRouter.test.ts`
Expected: FAIL (router not found).

- [ ] **Step 3: Implement middleware + DTO + router (this task's endpoints)**

`requirePartner.ts` (mirror `requireOwner.ts`):
```ts
import type { Response, NextFunction, RequestHandler } from "express";
import type { DeliveryRepository, PartnerView } from "../repositories/deliveryRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface PartnerRequest extends AuthenticatedRequest { partner?: PartnerView; }

export function createRequirePartner(jwtSecret: string, repo: DeliveryRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolve = asyncHandler(async (req: PartnerRequest, res: Response, next: NextFunction) => {
    const partner = await repo.findByUserId(req.userId!);
    if (!partner) return res.status(403).json({ error: "Not a delivery account." });
    req.partner = partner;
    next();
  });
  return [requireAuth, resolve];
}
```
`deliveryDTO.ts` — `toPartnerDTO`:
```ts
import type { PartnerView } from "../repositories/deliveryRepository";
export function toPartnerDTO(p: PartnerView) {
  return { id: p.id, name: p.name, phone: p.phone, vehicleType: p.vehicleType,
    availabilityStatus: p.availabilityStatus, approved: p.approvedAt != null };
}
```
`deliveryRouter.ts` (this task's routes; later tasks append more):
```ts
import { Router } from "express";
import type { DeliveryRepository } from "../repositories/deliveryRepository";
import { createRequirePartner, type PartnerRequest } from "../middleware/requirePartner";
import { asyncHandler } from "../middleware/asyncHandler";
import { toPartnerDTO } from "../lib/deliveryDTO";
import { LOCATION_STALE_MS } from "../lib/deliveryConfig";

export interface DeliveryRouterDeps { deliveryRepo: DeliveryRepository; jwtSecret: string; }
const VEHICLES = ["bike", "motorcycle", "car"];

export function createDeliveryRouter(deps: DeliveryRouterDeps): Router {
  const router = Router();
  const requirePartner = createRequirePartner(deps.jwtSecret, deps.deliveryRepo);

  router.get("/me", requirePartner, asyncHandler(async (req: PartnerRequest, res) =>
    res.status(200).json({ partner: toPartnerDTO(req.partner!) })));

  router.patch("/me", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { name, phone, vehicleType } = req.body ?? {};
    if (typeof name !== "string" || !name.trim() || typeof phone !== "string" || !phone.trim() ||
        typeof vehicleType !== "string" || !VEHICLES.includes(vehicleType)) {
      return res.status(400).json({ error: "Name, phone, and vehicle type are required." });
    }
    const updated = await deps.deliveryRepo.updateProfile(req.partner!.userId,
      { name: name.trim(), phone: phone.trim(), vehicleType: vehicleType as never });
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  router.post("/location", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { lat, lng } = req.body ?? {};
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng must be numbers." });
    }
    const updated = await deps.deliveryRepo.updateLocation(req.partner!.userId, lat, lng, new Date());
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  router.post("/availability", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
    const { status } = req.body ?? {};
    if (status !== "online" && status !== "offline") return res.status(400).json({ error: "status must be online or offline." });
    if (status === "online") {
      const fresh = req.partner!.locationUpdatedAt && Date.now() - req.partner!.locationUpdatedAt.getTime() < LOCATION_STALE_MS;
      if (!fresh) return res.status(409).json({ error: "location_required", message: "Share your location before going online." });
    }
    if (status === "offline") {
      const active = await deps.deliveryRepo.findActiveForPartner(req.partner!.userId);
      if (active) return res.status(409).json({ error: "delivery_in_progress", message: "Finish your active delivery before going offline." });
    }
    const updated = await deps.deliveryRepo.setAvailability(req.partner!.userId, status);
    return res.status(200).json({ partner: toPartnerDTO(updated) });
  }));

  return router;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx vitest run tests/routes/deliveryRouter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requirePartner.ts backend/src/lib/deliveryDTO.ts backend/src/routes/deliveryRouter.ts backend/tests/routes/deliveryRouter.test.ts
git commit -m "feat: delivery router — profile, availability, location"
```

---

### Task 8: OrderWithItems + orderDTO delivery fields, then offers endpoints

**Files:**
- Modify: `backend/src/repositories/orderRepository.ts` (`OrderWithItems`, `INCLUDE`), `backend/src/lib/orderDTO.ts`, `backend/src/lib/orderDTO.test.ts` (if present) — extend `toOrderDTO`.
- Modify: `backend/src/routes/deliveryRouter.ts`
- Modify: `backend/src/lib/deliveryDTO.ts`
- Test: `backend/tests/routes/deliveryRouter.test.ts`, `backend/tests/lib/orderDTO.test.ts`

**Interfaces:**
- Produces: `OrderWithItems` gains `deliveryPartner: { name: string } | null` + the delivery timestamps/`payoutCents` are already on `Order`. `OrderDTO` gains `assignedAt`, `outForDeliveryAt`, `deliveredAt`, `payoutCents`, `deliveryPartnerName`. New endpoints: `GET /api/delivery/offers`, `POST /api/delivery/offers/:id/accept`, `POST /api/delivery/offers/:id/decline`.

- [ ] **Step 1: Extend OrderWithItems + toOrderDTO (write failing DTO test first)**

Append to `orderDTO.test.ts`:
```ts
it("exposes delivery fields", () => {
  const dto = toOrderDTO(makeOrder({ status: "assigned", assignedAt: new Date("2026-07-18T10:00:00Z"),
    payoutCents: 10250, deliveryPartner: { name: "Rider Ray" } } as never));
  expect(dto.assignedAt).toBe("2026-07-18T10:00:00.000Z");
  expect(dto.payoutCents).toBe(10250);
  expect(dto.deliveryPartnerName).toBe("Rider Ray");
});
```
Run it → FAIL. Then:
- In `orderRepository.ts`, add to `INCLUDE`: `deliveryPartner: { select: { name: true } }` — but `Order.deliveryPartnerId` has no Prisma relation yet. Add a named relation in `schema.prisma`: on `Order` add `deliveryPartner User? @relation("PartnerOrders", fields: [deliveryPartnerId], references: [id])` and on `User` add `partnerOrders Order[] @relation("PartnerOrders")` and keep the existing `orders Order[]` as `@relation("CustomerOrders")` with a matching name on `Order.customer`. Create a migration `npx prisma migrate dev --name order_delivery_partner_relation`.
- Extend the `OrderWithItems` type with `deliveryPartner: { name: string } | null`.
- In `orderDTO.ts`, add fields to `OrderDTO` and `toOrderDTO`:
```ts
assignedAt: iso(o.assignedAt), outForDeliveryAt: iso(o.outForDeliveryAt), deliveredAt: iso(o.deliveredAt),
payoutCents: o.payoutCents ?? null, deliveryPartnerName: o.deliveryPartner?.name ?? null,
```
Update the `makeOrder` fake to default `deliveryPartner: null` and the new nullable fields. Run the DTO test → PASS.

- [ ] **Step 2: Write failing offers tests**

Append to `deliveryRouter.test.ts`:
```ts
import { makeOrder } from "../test-helpers/fakeOrderRepository";

describe("offers", () => {
  it("lists a pending offer for the partner and accepts it", async () => {
    const order = makeOrder({ id: "o1", status: "ready", deliveryLat: 24.90, deliveryLng: 67.05 });
    const { app, deliveryRepo } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    // going online + a fresh location so the tick offers to p1:
    await request(app).post("/api/delivery/location").set(auth("p1")).send({ lat: 24.86, lng: 67.01 });
    await request(app).post("/api/delivery/availability").set(auth("p1")).send({ status: "online" });
    const list = await request(app).get("/api/delivery/offers").set(auth("p1"));
    expect(list.body.offers).toHaveLength(1);
    const id = list.body.offers[0].id;
    const acc = await request(app).post(`/api/delivery/offers/${id}/accept`).set(auth("p1"));
    expect(acc.status).toBe(200);
    expect(acc.body.order.status).toBe("assigned");
  });
  it("409s accepting an already-taken offer", async () => {
    // build two partners + one ready order, get two offers as in the engine race test, accept twice
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/routes/deliveryRouter.test.ts` → FAIL (routes missing).

- [ ] **Step 4: Implement offers endpoints + DTO**

Add `toOfferDTO` to `deliveryDTO.ts`:
```ts
import { haversineKm } from "./geo";
import { computePayoutCents } from "./deliveryConfig";
import type { OfferRecord } from "../repositories/deliveryRepository";

export function toOfferDTO(offer: OfferRecord, ctx: {
  orderNumber: number; restaurantName: string;
  partnerLat: number | null; partnerLng: number | null;
  restaurantLat: number | null; restaurantLng: number | null;
  deliveryLat: number | null; deliveryLng: number | null;
}) {
  const km = (a: number|null, b: number|null, c: number|null, d: number|null) =>
    (a != null && b != null && c != null && d != null) ? haversineKm({ lat: a, lng: b }, { lat: c, lng: d }) : null;
  const pickup = km(ctx.partnerLat, ctx.partnerLng, ctx.restaurantLat, ctx.restaurantLng);
  const dropoff = km(ctx.restaurantLat, ctx.restaurantLng, ctx.deliveryLat, ctx.deliveryLng);
  return { id: offer.id, orderNumber: ctx.orderNumber, restaurantName: ctx.restaurantName,
    pickupDistanceKm: pickup == null ? null : Number(pickup.toFixed(1)),
    dropoffDistanceKm: dropoff == null ? null : Number(dropoff.toFixed(1)),
    payoutCents: computePayoutCents(dropoff), expiresAt: offer.expiresAt.toISOString() };
}
```
In `deliveryRouter.ts`, import `runAssignmentTick, acceptOffer, declineOffer` and add:
```ts
router.get("/offers", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  await runAssignmentTick(deps.deliveryRepo, new Date());               // the lazy engine tick
  const offers = await deps.deliveryRepo.listPendingOffersForPartner(req.partner!.userId);
  const dtos = await Promise.all(offers.map(async (o) => {
    const order = await deps.deliveryRepo.findOrderForDelivery(o.orderId);
    return order ? toOfferDTO(o, { orderNumber: order.orderNumber, restaurantName: order.restaurant.name,
      partnerLat: req.partner!.currentLat, partnerLng: req.partner!.currentLng,
      restaurantLat: order.restaurantLat, restaurantLng: order.restaurantLng,
      deliveryLat: order.deliveryLat, deliveryLng: order.deliveryLng }) : null;
  }));
  return res.status(200).json({ offers: dtos.filter(Boolean) });
}));

router.post("/offers/:id/accept", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  const result = await acceptOffer(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 409;
    return res.status(status).json({ error: result.code });
  }
  return res.status(200).json({ order: toOrderDTO(result.order) });
}));

router.post("/offers/:id/decline", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  const ok = await declineOffer(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
  if (!ok) return res.status(404).json({ error: "not_found" });
  return res.status(200).json({ ok: true });
}));
```
(Import `toOrderDTO` from `../lib/orderDTO`.)

- [ ] **Step 5: Run to verify pass** — `npx vitest run tests/routes/deliveryRouter.test.ts tests/lib/orderDTO.test.ts` → PASS. Run the migration and `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma backend/src/repositories/orderRepository.ts backend/src/lib/orderDTO.ts backend/src/lib/deliveryDTO.ts backend/src/routes/deliveryRouter.ts backend/tests
git commit -m "feat: delivery offers endpoints + order DTO delivery fields"
```

---

### Task 9: Active delivery — GET active, pickup, deliver, unable

**Files:**
- Modify: `backend/src/routes/deliveryRouter.ts`, `backend/src/lib/deliveryDTO.ts`
- Test: `backend/tests/routes/deliveryRouter.test.ts`

**Interfaces:**
- Produces: `GET /api/delivery/active`, `POST /api/delivery/orders/:id/pickup`, `POST /api/delivery/orders/:id/deliver`, `POST /api/delivery/orders/:id/unable`; `toActiveDeliveryDTO(order, extras)`.

- [ ] **Step 1: Write failing tests**

```ts
describe("active delivery flow", () => {
  it("walks assigned → out_for_delivery → delivered", async () => {
    const order = makeOrder({ id: "o1", status: "assigned", deliveryPartnerId: "p1",
      deliveryLat: 24.9, deliveryLng: 67.05 });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    const active = await request(app).get("/api/delivery/active").set(auth("p1"));
    expect(active.body.active.order.id).toBe("o1");
    const pick = await request(app).post("/api/delivery/orders/o1/pickup").set(auth("p1"));
    expect(pick.body.order.status).toBe("out_for_delivery");
    const del = await request(app).post("/api/delivery/orders/o1/deliver").set(auth("p1")).send({ note: "Left at door" });
    expect(del.body.order.status).toBe("delivered");
  });
  it("blocks pickup on another partner's order (409/404)", async () => {
    const order = makeOrder({ id: "o1", status: "assigned", deliveryPartnerId: "someone" });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [order]);
    expect((await request(app).post("/api/delivery/orders/o1/pickup").set(auth("p1"))).status).toBe(409);
  });
  it("returns null active when the partner has none", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/delivery/active").set(auth("p1"))).body.active).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

`toActiveDeliveryDTO` in `deliveryDTO.ts`:
```ts
import { toOrderDTO } from "./orderDTO";
import type { OrderWithItems } from "../repositories/orderRepository";
export function toActiveDeliveryDTO(order: OrderWithItems & { restaurantLat: number | null; restaurantLng: number | null; restaurantPhone: string | null }) {
  return { order: toOrderDTO(order), restaurantAddress: (order as { restaurant: { address?: string } }).restaurant.address ?? "",
    restaurantPhone: order.restaurantPhone, restaurantLat: order.restaurantLat, restaurantLng: order.restaurantLng,
    deliveryLat: order.deliveryLat, deliveryLng: order.deliveryLng, payoutCents: order.payoutCents ?? null };
}
```
(Ensure `findActiveForPartner`/`findOrderForDelivery` include `restaurant.address`; add `address: true` to their selects.)
Router endpoints:
```ts
router.get("/active", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  const active = await deps.deliveryRepo.findActiveForPartner(req.partner!.userId);
  return res.status(200).json({ active: active ? toActiveDeliveryDTO(active) : null });
}));

async function move(req: PartnerRequest, res, from, to, proofNote?) {
  const updated = await deps.deliveryRepo.deliveryTransition(req.params.id, req.partner!.userId, from, to, new Date(), proofNote);
  if (!updated) return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this delivery." });
  return res.status(200).json({ order: toOrderDTO(updated) });
}
router.post("/orders/:id/pickup", requirePartner, asyncHandler((req: PartnerRequest, res) =>
  move(req, res, "assigned", "out_for_delivery")));
router.post("/orders/:id/deliver", requirePartner, asyncHandler((req: PartnerRequest, res) => {
  const { note } = req.body ?? {};
  if (note !== undefined && (typeof note !== "string" || note.length > 300)) return res.status(400).json({ error: "Note too long." });
  return move(req, res, "out_for_delivery", "delivered", typeof note === "string" ? note.trim() : undefined);
}));
router.post("/orders/:id/unable", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  const released = await releaseOrder(deps.deliveryRepo, req.params.id, req.partner!.userId, new Date());
  if (!released) return res.status(409).json({ error: "no_active_delivery" });
  return res.status(200).json({ order: toOrderDTO(released) });
}));
```
(Import `releaseOrder` from the engine.)

- [ ] **Step 4: Run to verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/deliveryRouter.ts backend/src/lib/deliveryDTO.ts backend/src/repositories/deliveryRepository.ts backend/tests/routes/deliveryRouter.test.ts
git commit -m "feat: active delivery endpoints — pickup, deliver, unable"
```

---

### Task 10: Earnings endpoint

**Files:**
- Modify: `backend/src/routes/deliveryRouter.ts`, `backend/src/lib/deliveryDTO.ts`
- Test: `backend/tests/routes/deliveryRouter.test.ts`

**Interfaces:**
- Produces: `GET /api/delivery/earnings` returning `{ today, week, deliveries }`; `toEarningsDTO(rows, now)`.

- [ ] **Step 1: Write failing test**

```ts
describe("GET /api/delivery/earnings", () => {
  it("totals today and this week and lists completed deliveries", async () => {
    const today = makeOrder({ id: "d1", status: "delivered", deliveryPartnerId: "p1", payoutCents: 10000, deliveredAt: new Date() });
    const { app } = buildApp([makePartner({ userId: "p1" })], [], [today]);
    const res = await request(app).get("/api/delivery/earnings").set(auth("p1"));
    expect(res.body.today.count).toBe(1);
    expect(res.body.today.cents).toBe(10000);
    expect(res.body.deliveries).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

`toEarningsDTO` in `deliveryDTO.ts`:
```ts
export function toEarningsDTO(rows: { id: string; orderNumber: number; restaurantName: string; payoutCents: number; deliveredAt: Date }[], now: Date) {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7)); // Monday
  const sum = (since: Date) => rows.filter((r) => r.deliveredAt >= since)
    .reduce((a, r) => ({ cents: a.cents + r.payoutCents, count: a.count + 1 }), { cents: 0, count: 0 });
  return { today: sum(startOfDay), week: sum(startOfWeek),
    deliveries: rows.map((r) => ({ id: r.id, orderNumber: r.orderNumber, restaurantName: r.restaurantName,
      payoutCents: r.payoutCents, deliveredAt: r.deliveredAt.toISOString() })) };
}
```
Router:
```ts
router.get("/earnings", requirePartner, asyncHandler(async (req: PartnerRequest, res) => {
  const rows = await deps.deliveryRepo.listDeliveredForPartner(req.partner!.userId);
  return res.status(200).json(toEarningsDTO(rows, new Date()));
}));
```

- [ ] **Step 4: Run to verify pass** → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/deliveryRouter.ts backend/src/lib/deliveryDTO.ts backend/tests/routes/deliveryRouter.test.ts
git commit -m "feat: delivery earnings endpoint"
```

---

### Task 11: Wire assignment trigger + checkout coords + mount router

**Files:**
- Modify: `backend/src/routes/ownerOrdersRouter.ts`, `backend/src/routes/customerOrdersRouter.ts`, `backend/src/repositories/orderRepository.ts` (`PlaceOrderInput`), `backend/src/app.ts`
- Test: `backend/tests/routes/ownerOrdersRouter.test.ts`, `backend/tests/routes/customerOrdersRouter.test.ts`, `backend/tests/app.test.ts`

**Interfaces:**
- Consumes: `runAssignmentTick`, `DeliveryRepository`.
- Produces: owner "mark ready" runs a tick; checkout persists `deliveryLat/deliveryLng`; `deliveryRouter` mounted at `/api/delivery`.

- [ ] **Step 1: Write failing tests**

In `ownerOrdersRouter.test.ts`, add a `deliveryRepo` to `buildApp` and assert a ready transition creates an offer when an eligible partner exists:
```ts
it("offers the order to an online partner when marked ready", async () => {
  const owned = makeOwnedRestaurant();
  const o = makeOrder({ restaurantId: owned.profile.id, status: "preparing", expiresAt: future(), deliveryLat: 24.9, deliveryLng: 67.05 });
  const deliveryRepo = createFakeDeliveryRepository([makePartner({ userId: "p1" })], [], [o]);
  const { app } = buildApp([o], owned, deliveryRepo); // buildApp passes deliveryRepo into the owner-orders router
  await request(app).post(`/api/restaurant/orders/${o.id}/status`).set(ownerAuth).send({ to: "ready" });
  expect(deliveryRepo.offers.length).toBe(1);
});
```
In `customerOrdersRouter.test.ts`, assert `deliveryLat/deliveryLng` round-trip when posted. In `app.test.ts`, assert `GET /api/delivery/me` without auth returns 401 (router mounted).

- [ ] **Step 2: Run to verify failure** → FAIL.

- [ ] **Step 3: Implement**

- `PlaceOrderInput` gains `deliveryLat?: number | null; deliveryLng?: number | null`; `create` passes them through. `customerOrdersRouter` reads optional numeric `deliveryLat/deliveryLng` from the body (validate: if present, must be finite numbers) and includes them in the `create` call.
- `OwnerOrdersRouterDeps` gains `deliveryRepo: DeliveryRepository`. In the `/status` handler, after a successful `to === "ready"` transition, call:
```ts
if (to === "ready") { await runAssignmentTick(deps.deliveryRepo, new Date()); }
```
(Import `runAssignmentTick`; the fake order the router updated must also be visible to the delivery repo — in production both read the same DB; in tests the same `makeOrder` object is shared by reference into both fakes.)
- `app.ts`: instantiate `const deliveryRepo = createDeliveryRepository(config.prisma);`, pass it to `createOwnerOrdersRouter({ ... deliveryRepo })`, and mount `app.use("/api/delivery", createDeliveryRouter({ deliveryRepo, jwtSecret: config.jwtSecret }));`.

- [ ] **Step 4: Run the full suite**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Expected: entire suite PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat: trigger assignment on ready, capture dropoff coords, mount delivery router"
```

---

# PHASE 2 — DELIVERY PARTNER SHELL (FRONTEND)

> No frontend test runner exists. Each task's gate is: `cd app && npx tsc --noEmit && npm run lint && npm run build`, plus the stated manual check. Follow `DESIGN.md` tokens; status is color + icon + label.

### Task 12: Types, PartnerContext, DeliveryShell scaffold, routing

**Files:**
- Modify: `app/src/lib/types.ts`, `app/src/App.tsx`
- Create: `app/src/PartnerContext.tsx`, `app/src/shells/DeliveryShell.tsx`, `app/src/styles/delivery.css`, stub screens under `app/src/screens/delivery/`

**Interfaces:**
- Produces: `PartnerProfile`, `DeliveryOfferDTO`, `ActiveDeliveryDTO`, `EarningsDTO`, `VehicleType` types; `usePartner()` context; `DeliveryShell` selected by role.

- [ ] **Step 1: Add types**

In `types.ts` add (and extend `OrderDTO` with the fields Task 8 produced):
```ts
export type VehicleType = "bike" | "motorcycle" | "car";
export interface PartnerProfile { id: string; name: string; phone: string; vehicleType: VehicleType;
  availabilityStatus: "offline" | "online"; approved: boolean; }
export interface DeliveryOfferDTO { id: string; orderNumber: number; restaurantName: string;
  pickupDistanceKm: number | null; dropoffDistanceKm: number | null; payoutCents: number; expiresAt: string; }
export interface ActiveDeliveryDTO { order: OrderDTO; restaurantAddress: string; restaurantPhone: string | null;
  restaurantLat: number | null; restaurantLng: number | null; deliveryLat: number | null; deliveryLng: number | null; payoutCents: number | null; }
export interface EarningsDTO { today: { cents: number; count: number }; week: { cents: number; count: number };
  deliveries: { id: string; orderNumber: number; restaurantName: string; payoutCents: number; deliveredAt: string }[]; }
```
Add to `OrderDTO`: `assignedAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null; payoutCents: number | null; deliveryPartnerName: string | null;`.

- [ ] **Step 2: PartnerContext** — mirror `OwnerContext.tsx`: fetch `GET /api/delivery/me`, expose `{ profile, setProfile, refresh }`, and when `!profile.approved` render `<DPendingApprovalScreen />` (stub returns a simple message for now).

- [ ] **Step 3: DeliveryShell** — mirror `RestaurantShell.tsx`: three `TabDef`s (`Active` `/`, `Availability` `/availability`, `Earnings` `/earnings`) + a `/profile` route; wrap in `PartnerProvider`; routes point at stub screens (each returns a titled empty `<section>` for now). Add SVG icons (truck, power, wallet, user).

- [ ] **Step 4: Routing** — in `App.tsx`:
```tsx
return me.role === "restaurant" ? <RestaurantShell />
  : me.role === "delivery_partner" ? <DeliveryShell />
  : <CustomerShell />;
```

- [ ] **Step 5: Gate + manual check**

Run: `cd app && npx tsc --noEmit && npm run lint && npm run build`
Manual: log in as the seeded `rider@demo.feastnow` (set its password via seed), confirm the 3-tab delivery shell renders.

- [ ] **Step 6: Commit** — `git commit -m "feat(app): delivery shell scaffold, partner context, routing"`

---

### Task 13: Availability screen + geolocation + location ping

**Files:**
- Create: `app/src/lib/geolocation.ts`, `app/src/screens/delivery/DAvailabilityScreen.tsx`
- Modify: `app/src/styles/delivery.css`

**Interfaces:**
- Consumes: `PartnerContext`, `apiSend`. Produces the Online/Offline toggle with the four states + a location-ping loop.

- [ ] **Step 1: geolocation helper**
```ts
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 });
  });
}
```

- [ ] **Step 2: DAvailabilityScreen**

- Large toggle (`role="switch"`, mirror `RestaurantShell`'s `rtoggle`). Going online: `getPosition()` → `POST /api/delivery/location` → `POST /api/delivery/availability {status:"online"}`; on geolocation denial show an inline permission message and stay offline; on `409 location_required` show the same.
- While online, a `useEffect` interval every `LOCATION_PING_MS` (10s) calls `getPosition()` → `POST /location` (silently ignore transient failures); clears on offline/unmount.
- Poll `GET /api/delivery/active` (via `usePolling`); if an active delivery exists, lock the toggle to Online and show a banner with a `Link` to `/`.
- States rendered: Offline (empty illustration), Online-searching (pulse animation, respect `prefers-reduced-motion`), Online-locked.

- [ ] **Step 3: Gate + manual check** — build/lint/tsc; manually toggle online (grant location), confirm status label + that offline is blocked during a delivery.

- [ ] **Step 4: Commit** — `git commit -m "feat(app): delivery availability toggle + location sharing"`

---

### Task 14: Assignment offer modal

**Files:**
- Create: `app/src/screens/delivery/AssignmentOfferModal.tsx`
- Modify: `app/src/shells/DeliveryShell.tsx` (mount the watcher), `app/src/styles/delivery.css`

**Interfaces:**
- Consumes: `usePolling`, `useCountdown`, `apiSend`, `lib/chime`. Produces a global offer watcher that shows the modal when a pending offer arrives.

- [ ] **Step 1: Component**

- A watcher (mounted in the shell like `NewOrderWatcher`) polls `GET /api/delivery/offers` every 4s. On the first pending offer, play `chime` and render the modal.
- Modal shows restaurant name, `pickupDistanceKm`, `dropoffDistanceKm`, formatted payout (`formatMoney(payoutCents)`), and a countdown bar driven by `useCountdown(expiresAt)`. At expiry, close and resume polling (treated as decline server-side).
- Buttons: Accept → `POST /offers/:id/accept` → on 200 navigate to `/` (Active); on 409 close + toast "Just taken". Decline → `POST /offers/:id/decline` → close.

- [ ] **Step 2: Gate + manual check** — with two browser sessions (restaurant marks an order ready; rider online), confirm the modal appears with distances + payout and Accept routes to Active.

- [ ] **Step 3: Commit** — `git commit -m "feat(app): assignment offer modal with countdown"`

---

### Task 15: Active delivery screen

**Files:**
- Create: `app/src/screens/delivery/DActiveDeliveryScreen.tsx`
- Modify: `app/src/styles/delivery.css`

**Interfaces:**
- Consumes: `GET /api/delivery/active`, `apiSend`. Produces the heading-to-pickup / out-for-delivery / arrived flow.

- [ ] **Step 1: Component**

- Poll `GET /api/delivery/active`. If `active` is null, render the empty state ("You're online — waiting for a delivery", link to Availability).
- Order card: restaurant name, order number, item count. State = order status.
- **Navigate** button → `window.open(mapsUrl(destination))` where `mapsUrl(addr) = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(addr)`. Destination is the restaurant address while `assigned`, the customer `deliveryAddress` while `out_for_delivery`.
- **Call** button → `tel:` link (restaurant phone while heading to pickup; `customerPhone` after pickup) — hidden when the number is null.
- `assigned`: show **Confirm Pickup** → `POST /orders/:id/pickup`.
- `out_for_delivery`: show dropoff address + customer name, an optional proof-note `<textarea>`, and **Mark as Delivered** → `POST /orders/:id/deliver { note }` → on success navigate to `/availability`.
- An **Unable to complete** secondary action → confirm → `POST /orders/:id/unable`.

- [ ] **Step 2: Gate + manual check** — drive one order assigned → delivered; confirm Navigate opens Google Maps with the right destination and status flips for customer/restaurant.

- [ ] **Step 3: Commit** — `git commit -m "feat(app): active delivery screen — navigate, pickup, deliver"`

---

### Task 16: Earnings screen

**Files:**
- Create: `app/src/screens/delivery/DEarningsScreen.tsx`

- [ ] **Step 1: Component** — fetch `GET /api/delivery/earnings`; render two summary cards (Today, This Week) with `formatMoney(cents)` + delivery counts, then a list of completed deliveries (date via `format`, restaurant name, payout). Read-only; no filters.

- [ ] **Step 2: Gate + manual check** — build/lint; after completing a delivery, confirm it appears with the right payout.

- [ ] **Step 3: Commit** — `git commit -m "feat(app): delivery earnings screen"`

---

### Task 17: Profile/settings + real pending-approval screen

**Files:**
- Create: `app/src/screens/delivery/DProfileScreen.tsx`, `app/src/screens/delivery/DPendingApprovalScreen.tsx`

**Interfaces:**
- Consumes: `usePartner`, `apiSend`, `clearToken`/`redirectToLogin`.

- [ ] **Step 1: DProfileScreen** — view/edit name, phone, vehicle type (`PATCH /api/delivery/me`); ID document shown read-only ("Contact support to change"); **Log Out** → `clearToken()` + `redirectToLogin()`. (No password-change endpoint this phase; omit the control rather than stub it.)

- [ ] **Step 2: DPendingApprovalScreen** — mirror the restaurant `PendingApprovalScreen` shape (message + a subtle poll/refresh). Dormant this phase since partners auto-approve, but wired so the gate works when Admin ships.

- [ ] **Step 3: Gate + manual check** — build/lint; edit vehicle type and confirm it persists; log out returns to the landing login.

- [ ] **Step 4: Commit** — `git commit -m "feat(app): delivery profile + pending-approval screen"`

---

### Task 18: Landing — delivery signup

**Files:**
- Modify: `landing/role-select.html`
- Create: `landing/signup-delivery.html` (+ its inline/module JS mirroring `signup-restaurant.html`)

- [ ] **Step 1: role-select** — add a third `roleselect__tile` ("Deliver with FeastNow → Earn on your schedule") linking to `signup-delivery.html`; update the page `<h1>`/`<title>` copy to include riders.

- [ ] **Step 2: signup-delivery.html** — copy `signup-restaurant.html`, replace business fields with a **Vehicle type** `<select>` (Bike/Motorcycle/Car) and an **Upload ID Document** file input (captured client-side; not uploaded this phase — the field is presentational, matching the spec's "collected, not gated"). On submit, POST the OTP request then `verify-otp` with `role: "delivery_partner", vehicleType`. On success, store the token and redirect to `/app/` (the SPA reads role from `/api/me`).

- [ ] **Step 3: Manual check** — sign up a new rider end-to-end (OTP via the dev mailer), land in the delivery shell auto-approved.

- [ ] **Step 4: Commit** — `git commit -m "feat(landing): delivery partner signup + role tile"`

---

# PHASE 3 — CROSS-ROLE STATUS VISIBILITY

### Task 19: Customer order timeline past ready

**Files:**
- Modify: `app/src/components/OrderStatus.tsx`, `app/src/screens/OrderDetailScreen.tsx`

**Interfaces:**
- Consumes: extended `OrderDTO` (delivery timestamps + `deliveryPartnerName`).

- [ ] **Step 1: OrderStatus** — add `assigned`, `out_for_delivery`, `delivered` cases with color + icon + label (e.g. assigned = gold "Rider assigned", out_for_delivery = basil "On the way", delivered = basil "Delivered"). Verify no status falls through to a default.

- [ ] **Step 2: OrderDetailScreen** — extend the timeline/steps to include Assigned → Out for Delivery → Delivered, driven by `assignedAt/outForDeliveryAt/deliveredAt`; show `deliveryPartnerName` once assigned ("Your rider: {name}"). While `ready` with no partner yet, show "Finding a rider…". No map.

- [ ] **Step 3: Gate + manual check** — build/lint; from the customer view, watch an order move through the full lifecycle via polling.

- [ ] **Step 4: Commit** — `git commit -m "feat(app): customer order timeline through delivery"`

---

### Task 20: Restaurant order detail — assignment status

**Files:**
- Modify: `app/src/screens/restaurant/ROrderDetailScreen.tsx`

- [ ] **Step 1: Implement** — once an order is `ready` or beyond, show an assignment line: "Finding a rider…" (ready, no `deliveryPartnerName`) → "Rider assigned: {deliveryPartnerName}" (assigned) → "Out for delivery" → "Delivered", reading the extended `OrderDTO`. Reuse the `OrderStatus` colors/icons.

- [ ] **Step 2: Gate + manual check** — build/lint; mark an order ready and confirm the restaurant sees the rider-assignment progression.

- [ ] **Step 3: Commit** — `git commit -m "feat(app): restaurant order detail shows rider assignment"`

---

### Task 21: Full-suite verification + docs + push

**Files:**
- Modify: `docs/superpowers/specs/2026-07-18-delivery-partner-role-design.md` (mark implemented), add a short completion note under `docs/superpowers/`.

- [ ] **Step 1: Backend suite** — `cd backend && npx vitest run && npx tsc --noEmit` → all PASS, zero type errors.
- [ ] **Step 2: Frontend** — `cd app && npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] **Step 3: Manual multi-actor E2E** — three sessions (customer, restaurant, rider): place → accept → preparing → ready (offer fires) → rider accepts → pickup → delivered; verify earnings + both cross-role views. Record the walkthrough result.
- [ ] **Step 4: Commit + push** — `git commit -m "docs: delivery partner role completion ledger"` then `git push`.

---

## Self-Review notes (for the executor)

- **Spec coverage:** FR-23 (T6/T18), FR-24 (T13), FR-25 (T5/T8/T14), FR-26 (T9/T15), FR-27 reduced to status timeline (T19/T20 — no map, per spec §1.1), FR-28 proof note (T9/T15), FR-29 (T10/T16), auth FR-3–FR-7 reuse existing flow (T6). Assignment/reassignment/payout/approval gaps resolved in T1/T5/T6.
- **Type consistency:** `computePayoutCents`, `haversineKm`, `runAssignmentTick`, `acceptOffer`, `DeliveryRepository`, `PartnerView`, `OfferRecord`, `toOrderDTO` fields, and the frontend `PartnerProfile/DeliveryOfferDTO/ActiveDeliveryDTO/EarningsDTO` names are used identically across tasks.
- **Watch-outs:** (1) the Prisma named relation for `deliveryPartner` (Task 8) requires renaming the existing `customer`/`orders` relation with `@relation` names — do the migration carefully. (2) In router/engine tests the same `makeOrder` object must be shared by reference into both the order fake and the delivery fake so a `ready` transition is visible to the tick. (3) `delivered` sets `deliveredAt` only (not `closedAt`); the history/earnings queries key off `deliveredAt`.
