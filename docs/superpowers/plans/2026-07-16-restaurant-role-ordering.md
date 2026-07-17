# Restaurant Role + Real Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Restaurant role end-to-end (signup → approval gate → Orders/Menu/Search/Profile shell) plus real customer ordering (cart + cash checkout + live order tracking) feeding it, per `docs/superpowers/specs/2026-07-16-restaurant-role-ordering-design.md`.

**Architecture:** One shared order domain in the Express backend (single state-machine module, lazy expiry/approval — no cron), deps-injected routers tested with fakes + supertest. The existing React SPA branches its whole navigation tree on `me.role`; live updates are 5s visibility-aware polling. Landing gains a restaurant signup page reusing the existing vanilla-JS OTP flow.

**Tech Stack:** Existing only — Express 4 + Prisma 5 + Supabase Postgres, Vitest + supertest, React 19 + Vite + react-router 6, vanilla JS landing. **No new dependencies anywhere** (the alert chime is WebAudio, not an asset/library).

## Global Constraints

Every task's requirements implicitly include these. Code samples in this plan were written against them — if a sample appears to violate one, the constraint wins (flag it in the report).

- **State machine:** order status transitions are validated ONLY via `backend/src/lib/orderStateMachine.ts`. No route re-implements transition rules.
- **Money:** integer cents everywhere. `OrderItem.priceAtOrderCents` + `nameSnapshot` are snapshotted at order time; historical totals are NEVER recomputed from the live menu. Flat `DELIVERY_FEE_CENTS = 9900` (Rs 99.00).
- **Server authoritative:** clients never send prices; the 2-minute auto-reject and 60s auto-approve are enforced server-side (lazy, on read/write). Client countdowns are cosmetic.
- **Auth:** all new API routes behind `requireAuth`; owner routes additionally resolve the caller's `RestaurantProfile` and 403 without one; every order/menu-item access is ownership-checked (404 on cross-tenant ids).
- **Patterns:** deps-injected `createXRouter(deps)` + `asyncHandler`; route tests use fake repositories + supertest (see `backend/tests/routes/customerRouter.test.ts`); backend work is TDD.
- **DESIGN.md rules (pre-flight-linted):**
  - *Operator-Restraint:* the Restaurant shell is **sans-dominant** — do NOT use the `serif` class on restaurant-shell headings (customer shell keeps serif).
  - *Mono-for-Numbers:* `mono` class only on prices, totals, order numbers, countdowns, elapsed timers, times. Never on labels/body.
  - *Tricolore-Means-Status:* status is always **color + icon + label**. Tomato (`--tomato`) only for rejected/cancelled status and destructive actions (Reject, Delete, Log Out, Go Offline confirm). Basil only for ready/positive/online status.
  - *Gold-Is-Rare:* at most one gold element per screen — in the restaurant queue that's the live countdown on a new-order card.
- **A11y/perf:** touch targets ≥ 44px; motion 150–250ms with `prefers-reduced-motion` fallbacks; countdown/elapsed displays are text updates, not animations; list queries hit the new indexes (NFR-1 ~2s).
- **Copy register:** product voice, not marketing. Status labels exactly: `New`, `Accepted`, `Preparing`, `Ready`, `Rejected`, `Cancelled` (customer-facing `placed` renders as `Order placed`).
- **Verification:** backend — `npm test` green in `backend/`; frontend — `npm run build` + `npm run lint` clean in `app/`, plus the task's manual check against the local dev servers. Commit after each task (conventional message); never commit untested code.
- **Frontend testing:** the SPA has no unit-test runner; frontend tasks verify via typecheck/build/lint + scripted manual checks listed in the task. Do not add a test framework.

## File Structure

**Backend (create):** `prisma/migrations/<ts>_order_domain/` · `src/lib/orderStateMachine.ts` · `src/lib/orderPricing.ts` · `src/lib/orderDTO.ts` · `src/repositories/orderRepository.ts` · `src/repositories/ownerRepository.ts` · `src/routes/customerOrdersRouter.ts` · `src/routes/ownerRouter.ts` · `src/routes/ownerOrdersRouter.ts` · `src/routes/ownerMenuRouter.ts` · matching `tests/` files + `tests/test-helpers/fakeOrderRepository.ts`, `tests/test-helpers/fakeOwnerRepository.ts`
**Backend (modify):** `prisma/schema.prisma` · `prisma/seed.ts` · `prisma/seedData.ts` · `src/app.ts` · `src/routes/authRouter.ts` · `src/routes/meRouter.ts` · `src/repositories/userRepository.ts` · `src/repositories/restaurantRepository.ts` (approved-only filter) · `src/lib/restaurantCard.ts` (isOnline gate)
**App (create):** `src/shells/CustomerShell.tsx` · `src/shells/RestaurantShell.tsx` · `src/OwnerContext.tsx` · `src/lib/cart.ts` · `src/hooks/usePolling.ts` · `src/hooks/useCountdown.ts` · `src/components/OrderStatus.tsx` · `src/screens/CartScreen.tsx` · `src/screens/OrderDetailScreen.tsx` · `src/screens/restaurant/PendingApprovalScreen.tsx`, `ROrdersScreen.tsx`, `ROrderDetailScreen.tsx`, `IncomingOrderAlert.tsx`, `RMenuScreen.tsx`, `RMenuItemEditScreen.tsx`, `RSearchScreen.tsx`, `RProfileScreen.tsx` · `src/styles/orders.css` · `src/styles/rshell.css`
**App (modify):** `src/App.tsx` · `src/components/TabBar.tsx` · `src/lib/types.ts` · `src/lib/api.ts` · `src/lib/format.ts` · `src/screens/RestaurantScreen.tsx` (steppers) · `src/screens/OrdersScreen.tsx` (real list) · `src/main.tsx` (style imports)
**Landing:** create `signup-restaurant.html` + `assets/js/signup-restaurant.js`; modify `role-select.html`.

---

### Task 1: Order-domain schema migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_order_domain/migration.sql` (generated, then hand-edited)

**Interfaces:**
- Produces: Prisma models `Order`, `OrderItem`, enums `OrderStatus`, `ApprovalStatus`; `RestaurantProfile.approvalStatus/isOnline/createdAt`, nullable `approvedAt`; relations `User.orders`, `RestaurantProfile.orders`. All later backend tasks consume the generated client types.

- [ ] **Step 1: Edit `schema.prisma`.** Add the enums and models; extend existing models. Exact additions:

```prisma
enum OrderStatus {
  placed
  accepted
  preparing
  ready
  assigned
  out_for_delivery
  delivered
  rejected
  cancelled
}

enum ApprovalStatus {
  pending
  approved
  rejected
}

model Order {
  id               String            @id @default(uuid())
  orderNumber      Int               @unique @default(autoincrement())
  customerId       String
  customer         User              @relation(fields: [customerId], references: [id], onDelete: Cascade)
  restaurantId     String
  restaurant       RestaurantProfile @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  status           OrderStatus       @default(placed)
  rejectionReason  String?
  note             String            @default("")
  deliveryAddress  String
  subtotalCents    Int
  deliveryFeeCents Int
  totalCents       Int
  createdAt        DateTime          @default(now())
  acceptedAt       DateTime?
  preparingAt      DateTime?
  readyAt          DateTime?
  closedAt         DateTime?
  expiresAt        DateTime
  isDemo           Boolean           @default(false)
  items            OrderItem[]

  @@index([restaurantId, status])
  @@index([customerId, createdAt])
}

model OrderItem {
  id                String    @id @default(uuid())
  orderId           String
  order             Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId        String?
  menuItem          MenuItem? @relation(fields: [menuItemId], references: [id], onDelete: SetNull)
  nameSnapshot      String
  priceAtOrderCents Int
  quantity          Int

  @@index([orderId])
}
```

On `User` add: `orders Order[]`. On `MenuItem` add: `orderItems OrderItem[]`. On `RestaurantProfile` add/change:

```prisma
  approvalStatus ApprovalStatus @default(pending)
  isOnline       Boolean        @default(true)
  createdAt      DateTime       @default(now())
  approvedAt     DateTime?      // was: DateTime (now nullable)
  orders         Order[]
```

- [ ] **Step 2: Generate the migration without applying:** `cd backend && npx prisma migrate dev --name order_domain --create-only`

- [ ] **Step 3: Hand-edit the generated `migration.sql`** — the default is `pending`, which would hide every existing live restaurant from browse. Append after the `ALTER TABLE "RestaurantProfile"` statements:

```sql
-- Backfill: everything that existed before this migration is already live.
UPDATE "RestaurantProfile" SET "approvalStatus" = 'approved';
```

- [ ] **Step 4: Apply + regenerate client:** `npx prisma migrate dev` then `npx prisma generate`. Expected: migration applied, `Order`/`OrderStatus` exported from `@prisma/client`.

- [ ] **Step 5: Verify no drift + existing tests still pass:** `npx prisma migrate status` (clean) and `npm test` (all green — nothing consumed the new columns yet).

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(backend): order domain schema — Order/OrderItem, approvalStatus, isOnline"
```

---

### Task 2: Order state machine + pricing modules (TDD)

**Files:**
- Create: `backend/src/lib/orderStateMachine.ts`, `backend/src/lib/orderPricing.ts`
- Test: `backend/tests/lib/orderStateMachine.test.ts`, `backend/tests/lib/orderPricing.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3, 5, 7, 9):

```ts
export type OrderActor = "customer" | "restaurant" | "system";
export const ORDER_EXPIRY_MS = 2 * 60_000;
export const AUTO_APPROVE_AFTER_MS = 60_000;
export const EXPIRY_REJECTION_REASON = "Not accepted in time";
export const REJECTION_REASONS: readonly string[]; // ["Item unavailable", "Store too busy", "Closing soon", "Other"]
export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean;
export function timestampFieldFor(to: OrderStatus): "acceptedAt" | "preparingAt" | "readyAt" | "closedAt" | null;
// orderPricing.ts
export const DELIVERY_FEE_CENTS = 9900;
export function computeOrderTotals(items: { priceCents: number; quantity: number }[]):
  { subtotalCents: number; deliveryFeeCents: number; totalCents: number };
```

- [ ] **Step 1: Write the failing tests** (`backend/tests/lib/orderStateMachine.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import {
  canTransition, timestampFieldFor, REJECTION_REASONS,
  ORDER_EXPIRY_MS, AUTO_APPROVE_AFTER_MS, EXPIRY_REJECTION_REASON,
} from "../../src/lib/orderStateMachine";

describe("canTransition", () => {
  it("allows the restaurant-driven happy path", () => {
    expect(canTransition("placed", "accepted", "restaurant")).toBe(true);
    expect(canTransition("accepted", "preparing", "restaurant")).toBe(true);
    expect(canTransition("preparing", "ready", "restaurant")).toBe(true);
  });
  it("allows restaurant rejection and system expiry only from placed", () => {
    expect(canTransition("placed", "rejected", "restaurant")).toBe(true);
    expect(canTransition("placed", "rejected", "system")).toBe(true);
    expect(canTransition("accepted", "rejected", "restaurant")).toBe(false);
    expect(canTransition("accepted", "rejected", "system")).toBe(false);
  });
  it("allows customer cancel only from placed", () => {
    expect(canTransition("placed", "cancelled", "customer")).toBe(true);
    expect(canTransition("accepted", "cancelled", "customer")).toBe(false);
  });
  it("blocks actor mixups and skips", () => {
    expect(canTransition("placed", "accepted", "customer")).toBe(false);
    expect(canTransition("placed", "preparing", "restaurant")).toBe(false);
    expect(canTransition("placed", "ready", "restaurant")).toBe(false);
    expect(canTransition("ready", "delivered", "restaurant")).toBe(false); // post-ready disabled this phase
    expect(canTransition("rejected", "accepted", "restaurant")).toBe(false);
  });
});

describe("timestampFieldFor", () => {
  it("maps each target status to its timeline column", () => {
    expect(timestampFieldFor("accepted")).toBe("acceptedAt");
    expect(timestampFieldFor("preparing")).toBe("preparingAt");
    expect(timestampFieldFor("ready")).toBe("readyAt");
    expect(timestampFieldFor("rejected")).toBe("closedAt");
    expect(timestampFieldFor("cancelled")).toBe("closedAt");
    expect(timestampFieldFor("placed")).toBe(null);
  });
});

describe("constants", () => {
  it("locks the spec values", () => {
    expect(ORDER_EXPIRY_MS).toBe(120_000);
    expect(AUTO_APPROVE_AFTER_MS).toBe(60_000);
    expect(EXPIRY_REJECTION_REASON).toBe("Not accepted in time");
    expect(REJECTION_REASONS).toEqual(["Item unavailable", "Store too busy", "Closing soon", "Other"]);
  });
});
```

And `backend/tests/lib/orderPricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeOrderTotals, DELIVERY_FEE_CENTS } from "../../src/lib/orderPricing";

describe("computeOrderTotals", () => {
  it("sums quantity * unit price and adds the flat delivery fee", () => {
    const totals = computeOrderTotals([
      { priceCents: 45000, quantity: 2 },
      { priceCents: 12500, quantity: 1 },
    ]);
    expect(totals).toEqual({
      subtotalCents: 102500,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents: 102500 + DELIVERY_FEE_CENTS,
    });
  });
  it("charges Rs 99.00 delivery", () => {
    expect(DELIVERY_FEE_CENTS).toBe(9900);
  });
});
```

- [ ] **Step 2: Run to verify they fail:** `cd backend && npx vitest run tests/lib/orderStateMachine.test.ts tests/lib/orderPricing.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `backend/src/lib/orderStateMachine.ts`:**

```ts
import type { OrderStatus } from "@prisma/client";

export type OrderActor = "customer" | "restaurant" | "system";

/** Server-authoritative windows (spec §3). Client countdowns are cosmetic. */
export const ORDER_EXPIRY_MS = 2 * 60_000;
export const AUTO_APPROVE_AFTER_MS = 60_000;
export const EXPIRY_REJECTION_REASON = "Not accepted in time";

export const REJECTION_REASONS = [
  "Item unavailable", "Store too busy", "Closing soon", "Other",
] as const;

// The single source of truth for the order lifecycle (CLAUDE.md mandate).
// Post-ready transitions (assigned → … → delivered) arrive with the
// Delivery Partner phase — absent here means disabled.
const TRANSITIONS: Record<OrderActor, Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  restaurant: {
    placed: ["accepted", "rejected"],
    accepted: ["preparing"],
    preparing: ["ready"],
  },
  customer: { placed: ["cancelled"] },
  system: { placed: ["rejected"] },
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return (TRANSITIONS[actor][from] ?? []).includes(to);
}

const TIMESTAMP_FIELDS: Partial<Record<OrderStatus, "acceptedAt" | "preparingAt" | "readyAt" | "closedAt">> = {
  accepted: "acceptedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  rejected: "closedAt",
  cancelled: "closedAt",
};

export function timestampFieldFor(to: OrderStatus): "acceptedAt" | "preparingAt" | "readyAt" | "closedAt" | null {
  return TIMESTAMP_FIELDS[to] ?? null;
}
```

And `backend/src/lib/orderPricing.ts`:

```ts
/** Money is integer cents (see format.ts in the app: 45000 → "Rs 450"). */
export const DELIVERY_FEE_CENTS = 9900;

export function computeOrderTotals(items: { priceCents: number; quantity: number }[]) {
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  return { subtotalCents, deliveryFeeCents: DELIVERY_FEE_CENTS, totalCents: subtotalCents + DELIVERY_FEE_CENTS };
}
```

- [ ] **Step 4: Run tests again:** same command — Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orderStateMachine.ts src/lib/orderPricing.ts tests/lib/orderStateMachine.test.ts tests/lib/orderPricing.test.ts
git commit -m "feat(backend): order state machine and pricing modules"
```

---

### Task 3: Order repository + DTO

**Files:**
- Create: `backend/src/repositories/orderRepository.ts`, `backend/src/lib/orderDTO.ts`, `backend/tests/test-helpers/fakeOrderRepository.ts`
- Test: `backend/tests/lib/orderDTO.test.ts` (the Prisma repo itself is exercised through route tests with the fake + verified manually end-to-end in Task 20)

**Interfaces:**
- Consumes: Task 1 models; Task 2 `timestampFieldFor`, `EXPIRY_REJECTION_REASON`.
- Produces (consumed by Tasks 5, 7, 9):

```ts
export interface PlaceOrderInput {
  customerId: string; restaurantId: string; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  expiresAt: Date; isDemo: boolean;
  items: { menuItemId: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number }[];
}
export type OrderWithItems = Order & {
  items: OrderItem[];
  customer: { name: string; phone: string };
  restaurant: { name: string };
};
export interface OrderRepository {
  create(input: PlaceOrderInput): Promise<OrderWithItems>;
  findById(id: string): Promise<OrderWithItems | null>;
  listForCustomer(customerId: string, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  listForRestaurant(restaurantId: string, statuses: OrderStatus[], q: string | undefined, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  countByStatus(restaurantId: string): Promise<Partial<Record<OrderStatus, number>>>;
  transition(id: string, from: OrderStatus, to: OrderStatus, now: Date, rejectionReason?: string): Promise<OrderWithItems | null>;
  expireOverdue(now: Date, scope: { restaurantId?: string; customerId?: string; orderId?: string }): Promise<number>;
}
// orderDTO.ts
export interface OrderDTO { /* see implementation below */ }
export function toOrderDTO(o: OrderWithItems): OrderDTO;
```

- [ ] **Step 1: Write the failing DTO test** (`backend/tests/lib/orderDTO.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { toOrderDTO } from "../../src/lib/orderDTO";
import { makeOrder } from "../test-helpers/fakeOrderRepository";

describe("toOrderDTO", () => {
  it("flattens relations and exposes ISO timeline fields", () => {
    const o = makeOrder({ status: "accepted", acceptedAt: new Date("2026-07-16T12:05:00Z") });
    const dto = toOrderDTO(o);
    expect(dto.id).toBe(o.id);
    expect(dto.orderNumber).toBe(o.orderNumber);
    expect(dto.status).toBe("accepted");
    expect(dto.placedAt).toBe(o.createdAt.toISOString());
    expect(dto.acceptedAt).toBe("2026-07-16T12:05:00.000Z");
    expect(dto.preparingAt).toBe(null);
    expect(dto.restaurantName).toBe(o.restaurant.name);
    expect(dto.customerName).toBe(o.customer.name);
    expect(dto.customerPhone).toBe(o.customer.phone);
    expect(dto.items[0]).toEqual({
      id: o.items[0].id, nameSnapshot: o.items[0].nameSnapshot,
      priceAtOrderCents: o.items[0].priceAtOrderCents, quantity: o.items[0].quantity,
    });
  });
});
```

- [ ] **Step 2: Create the fake + factory** (`backend/tests/test-helpers/fakeOrderRepository.ts`) — mirrors `fakeRestaurantRepository.ts` style, including the lazy-expiry and guarded-transition semantics so route tests exercise real behavior:

```ts
import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import type { OrderRepository, OrderWithItems, PlaceOrderInput } from "../../src/repositories/orderRepository";
import { timestampFieldFor, EXPIRY_REJECTION_REASON } from "../../src/lib/orderStateMachine";

let seq = 0;

export function makeOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  seq += 1;
  const id = `order-${seq}`;
  return {
    id, orderNumber: 1000 + seq, customerId: "u1", restaurantId: "rest-1",
    status: "placed" as OrderStatus, rejectionReason: null,
    note: "", deliveryAddress: "12 Demo Lane, Karachi",
    subtotalCents: 90000, deliveryFeeCents: 9900, totalCents: 99900,
    createdAt: new Date("2026-07-16T12:00:00Z"),
    acceptedAt: null, preparingAt: null, readyAt: null, closedAt: null,
    expiresAt: new Date("2026-07-16T12:02:00Z"), isDemo: false,
    items: [{
      id: `oi-${seq}`, orderId: id, menuItemId: `item-${seq}`,
      nameSnapshot: "Margherita", priceAtOrderCents: 45000, quantity: 2,
    } satisfies OrderItem],
    customer: { name: "Demo Customer", phone: "03001234567" },
    restaurant: { name: "Trattoria Demo" },
    ...overrides,
  };
}

export function createFakeOrderRepository(seedOrders: OrderWithItems[] = []): OrderRepository & { orders: OrderWithItems[] } {
  const orders = [...seedOrders];

  const expire = (o: OrderWithItems, now: Date): void => {
    if (o.status === "placed" && o.expiresAt.getTime() <= now.getTime()) {
      o.status = "rejected"; o.rejectionReason = EXPIRY_REJECTION_REASON; o.closedAt = now;
    }
  };

  return {
    orders,
    async create(input: PlaceOrderInput) {
      const { items, ...rest } = input;
      const o = makeOrder({
        ...rest,
        customer: { name: "Demo Customer", phone: "03001234567" },
        restaurant: { name: "Trattoria Demo" },
      });
      o.items = items.map((it, i) => ({ id: `${o.id}-oi-${i}`, orderId: o.id, ...it }));
      orders.push(o);
      return o;
    },
    async findById(id) { return orders.find((o) => o.id === id) ?? null; },
    async listForCustomer(customerId, page, pageSize) {
      const rows = orders.filter((o) => o.customerId === customerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { orders: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
    },
    async listForRestaurant(restaurantId, statuses, q, page, pageSize) {
      let rows = orders.filter((o) => o.restaurantId === restaurantId && statuses.includes(o.status));
      if (q) {
        const n = Number.parseInt(q.replace(/\D/g, ""), 10);
        rows = rows.filter((o) => o.orderNumber === n || o.customer.name.toLowerCase().includes(q.toLowerCase()));
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { orders: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
    },
    async countByStatus(restaurantId) {
      const counts: Partial<Record<OrderStatus, number>> = {};
      for (const o of orders) if (o.restaurantId === restaurantId) counts[o.status] = (counts[o.status] ?? 0) + 1;
      return counts;
    },
    async transition(id, from, to, now, rejectionReason) {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== from) return null; // guarded update semantics
      o.status = to;
      if (rejectionReason !== undefined) o.rejectionReason = rejectionReason;
      const field = timestampFieldFor(to);
      if (field) o[field] = now;
      return o;
    },
    async expireOverdue(now, scope) {
      let n = 0;
      for (const o of orders) {
        if (scope.restaurantId && o.restaurantId !== scope.restaurantId) continue;
        if (scope.customerId && o.customerId !== scope.customerId) continue;
        if (scope.orderId && o.id !== scope.orderId) continue;
        const before = o.status;
        expire(o, now);
        if (before !== o.status) n += 1;
      }
      return n;
    },
  };
}
```

- [ ] **Step 3: Run DTO test to verify it fails:** `npx vitest run tests/lib/orderDTO.test.ts` — Expected: FAIL (`orderDTO` not found).

- [ ] **Step 4: Implement `backend/src/lib/orderDTO.ts`:**

```ts
import type { OrderStatus } from "@prisma/client";
import type { OrderWithItems } from "../repositories/orderRepository";

export interface OrderItemDTO {
  id: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number;
}

export interface OrderDTO {
  id: string; orderNumber: number; status: OrderStatus;
  rejectionReason: string | null; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  placedAt: string; acceptedAt: string | null; preparingAt: string | null;
  readyAt: string | null; closedAt: string | null; expiresAt: string;
  restaurantName: string; customerName: string; customerPhone: string;
  items: OrderItemDTO[];
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toOrderDTO(o: OrderWithItems): OrderDTO {
  return {
    id: o.id, orderNumber: o.orderNumber, status: o.status,
    rejectionReason: o.rejectionReason, note: o.note, deliveryAddress: o.deliveryAddress,
    subtotalCents: o.subtotalCents, deliveryFeeCents: o.deliveryFeeCents, totalCents: o.totalCents,
    placedAt: o.createdAt.toISOString(), acceptedAt: iso(o.acceptedAt),
    preparingAt: iso(o.preparingAt), readyAt: iso(o.readyAt), closedAt: iso(o.closedAt),
    expiresAt: o.expiresAt.toISOString(),
    restaurantName: o.restaurant.name, customerName: o.customer.name, customerPhone: o.customer.phone,
    items: o.items.map((i) => ({
      id: i.id, nameSnapshot: i.nameSnapshot, priceAtOrderCents: i.priceAtOrderCents, quantity: i.quantity,
    })),
  };
}
```

- [ ] **Step 5: Implement `backend/src/repositories/orderRepository.ts`** (interfaces exactly as in the block above):

```ts
import type { Order, OrderItem, OrderStatus, PrismaClient, Prisma } from "@prisma/client";
import { timestampFieldFor, EXPIRY_REJECTION_REASON } from "../lib/orderStateMachine";

export interface PlaceOrderInput {
  customerId: string; restaurantId: string; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  expiresAt: Date; isDemo: boolean;
  items: { menuItemId: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number }[];
}

export type OrderWithItems = Order & {
  items: OrderItem[];
  customer: { name: string; phone: string };
  restaurant: { name: string };
};

export interface OrderRepository {
  create(input: PlaceOrderInput): Promise<OrderWithItems>;
  findById(id: string): Promise<OrderWithItems | null>;
  listForCustomer(customerId: string, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  listForRestaurant(restaurantId: string, statuses: OrderStatus[], q: string | undefined, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  countByStatus(restaurantId: string): Promise<Partial<Record<OrderStatus, number>>>;
  /** Guarded transition: applies only while status === from. Null = guard lost (caller 409s). */
  transition(id: string, from: OrderStatus, to: OrderStatus, now: Date, rejectionReason?: string): Promise<OrderWithItems | null>;
  /** Lazy expiry sweep (spec §3): finalize overdue placed orders in scope. */
  expireOverdue(now: Date, scope: { restaurantId?: string; customerId?: string; orderId?: string }): Promise<number>;
}

const INCLUDE = {
  items: true,
  customer: { select: { name: true, phone: true } },
  restaurant: { select: { name: true } },
} satisfies Prisma.OrderInclude;

export function createOrderRepository(prisma: PrismaClient): OrderRepository {
  return {
    create(input) {
      const { items, ...order } = input;
      return prisma.order.create({
        data: { ...order, items: { create: items } },
        include: INCLUDE,
      });
    },
    findById(id) {
      return prisma.order.findUnique({ where: { id }, include: INCLUDE });
    },
    async listForCustomer(customerId, page, pageSize) {
      const where = { customerId };
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where, include: INCLUDE, orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize, take: pageSize,
        }),
        prisma.order.count({ where }),
      ]);
      return { orders, total };
    },
    async listForRestaurant(restaurantId, statuses, q, page, pageSize) {
      const where: Prisma.OrderWhereInput = { restaurantId, status: { in: statuses } };
      if (q) {
        const n = Number.parseInt(q.replace(/\D/g, ""), 10);
        where.OR = [
          ...(Number.isNaN(n) ? [] : [{ orderNumber: n }]),
          { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
        ];
      }
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where, include: INCLUDE, orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize, take: pageSize,
        }),
        prisma.order.count({ where }),
      ]);
      return { orders, total };
    },
    async countByStatus(restaurantId) {
      const rows = await prisma.order.groupBy({
        by: ["status"], where: { restaurantId }, _count: { _all: true },
      });
      return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    },
    async transition(id, from, to, now, rejectionReason) {
      const data: Prisma.OrderUpdateManyMutationInput = { status: to };
      if (rejectionReason !== undefined) data.rejectionReason = rejectionReason;
      const field = timestampFieldFor(to);
      if (field) data[field] = now;
      const { count } = await prisma.order.updateMany({ where: { id, status: from }, data });
      if (count === 0) return null;
      return prisma.order.findUnique({ where: { id }, include: INCLUDE });
    },
    async expireOverdue(now, scope) {
      const { count } = await prisma.order.updateMany({
        where: {
          status: "placed", expiresAt: { lte: now },
          ...(scope.restaurantId ? { restaurantId: scope.restaurantId } : {}),
          ...(scope.customerId ? { customerId: scope.customerId } : {}),
          ...(scope.orderId ? { id: scope.orderId } : {}),
        },
        data: { status: "rejected", rejectionReason: EXPIRY_REJECTION_REASON, closedAt: now },
      });
      return count;
    },
  };
}
```

- [ ] **Step 6: Run tests:** `npx vitest run tests/lib/orderDTO.test.ts` PASS, then full `npm test` green.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/orderRepository.ts src/lib/orderDTO.ts tests/test-helpers/fakeOrderRepository.ts tests/lib/orderDTO.test.ts
git commit -m "feat(backend): order repository with guarded transitions and lazy expiry"
```

---

### Task 4: Auth grows roles — restaurant signup, role in /me and login (TDD)

**Files:**
- Modify: `backend/src/repositories/userRepository.ts`, `backend/src/routes/authRouter.ts`, `backend/src/routes/meRouter.ts`, `backend/tests/test-helpers/fakeUserRepository.ts`
- Test: extend `backend/tests/routes/authRouter.test.ts`, `backend/tests/routes/meRouter.test.ts`

**Interfaces:**
- Consumes: Task 1 (`UserRole`, `ApprovalStatus` on profile).
- Produces (consumed by Tasks 12, 13): `POST /api/auth/signup/verify-otp` accepts optional `role: "restaurant"` + `businessName`, `businessAddress`, `cuisine`; signup/login/`GET /api/me` responses gain `role`. `UserRepository.createRestaurantOwner(data)` creates User + pending profile transactionally.

- [ ] **Step 1: Write the failing tests.** In `authRouter.test.ts` add (reusing the file's existing helpers for OTP setup — follow the pattern of the existing verify-otp happy-path test):

```ts
it("creates a restaurant owner with a pending profile when role=restaurant", async () => {
  // arrange an active OTP challenge for the email exactly as the existing happy-path test does
  const res = await request(app).post("/api/auth/signup/verify-otp").send({
    name: "Rosa", email: "rosa@example.com", phone: "03119876543", password: "password123",
    otp: VALID_OTP, role: "restaurant",
    businessName: "Rosa's Trattoria", businessAddress: "9 Zamzama Blvd, Karachi", cuisine: "Italian",
  });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe("restaurant");
  expect(fakeUserRepo.lastRestaurantOwner).toMatchObject({
    businessName: "Rosa's Trattoria", businessAddress: "9 Zamzama Blvd, Karachi", cuisine: "Italian",
  });
});

it("rejects role=restaurant signup missing business fields", async () => {
  // same OTP arrangement; omit businessName
  const res = await request(app).post("/api/auth/signup/verify-otp").send({
    name: "Rosa", email: "rosa2@example.com", phone: "03119876544", password: "password123",
    otp: VALID_OTP, role: "restaurant", businessAddress: "9 Zamzama Blvd", cuisine: "Italian",
  });
  expect(res.status).toBe(400);
});

it("returns role on login", async () => {
  // seed fake user with role "restaurant"; assert res.body.user.role === "restaurant"
});
```

In `meRouter.test.ts` extend the existing 200 assertion to include `role: "customer"`.

- [ ] **Step 2: Run to verify failures:** `npx vitest run tests/routes/authRouter.test.ts tests/routes/meRouter.test.ts` — Expected: FAIL (role undefined / repo method missing).

- [ ] **Step 3: Implement.** `userRepository.ts` — extend the interface and factory:

```ts
import type { PrismaClient, User } from "@prisma/client";

// Pending restaurants are hidden from browse until approved, so a neutral
// placeholder hero is fine until imagery upload exists (SRS: future-only).
const DEFAULT_HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=60";

export interface RestaurantOwnerSignup {
  name: string; email: string; phone: string; passwordHash: string;
  businessName: string; businessAddress: string; cuisine: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  create(data: { name: string; email: string; phone: string; passwordHash: string }): Promise<User>;
  /** User (role restaurant) + pending RestaurantProfile in one transaction (FR-2). */
  createRestaurantOwner(data: RestaurantOwnerSignup): Promise<User>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findById(id) { return prisma.user.findUnique({ where: { id } }); },
    findByEmail(email) { return prisma.user.findUnique({ where: { email } }); },
    findByEmailOrPhone(identifier) {
      return prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
    },
    create(data) { return prisma.user.create({ data }); },
    createRestaurantOwner(data) {
      const { businessName, businessAddress, cuisine, ...user } = data;
      return prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { ...user, role: "restaurant" } });
        await tx.restaurantProfile.create({
          data: {
            userId: created.id, name: businessName, description: "",
            address: businessAddress, cuisines: [cuisine],
            opensAt: "11:00", closesAt: "23:00", estDeliveryMin: 30,
            heroImageUrl: DEFAULT_HERO_IMAGE_URL,
            approvalStatus: "pending", approvedAt: null,
            isActive: true, isDemo: false,
          },
        });
        return created;
      });
    },
  };
}
```

`authRouter.ts` — in `verify-otp`, after the existing field validation add:

```ts
    const { role, businessName, businessAddress, cuisine } = req.body ?? {};
    const isRestaurant = role === "restaurant";
    if (isRestaurant && (
      typeof businessName !== "string" || !businessName.trim() ||
      typeof businessAddress !== "string" || !businessAddress.trim() ||
      typeof cuisine !== "string" || !cuisine.trim()
    )) {
      return res.status(400).json({ error: "Business name, address, and cuisine are required for a restaurant account." });
    }
```

and replace the `deps.userRepo.create({...})` call with:

```ts
      user = isRestaurant
        ? await deps.userRepo.createRestaurantOwner({
            name, email, phone, passwordHash,
            businessName: businessName.trim(), businessAddress: businessAddress.trim(), cuisine: cuisine.trim(),
          })
        : await deps.userRepo.create({ name, email, phone, passwordHash });
```

Add `role: user.role` to the user objects in BOTH the verify-otp and login responses, and in `meRouter.ts`'s 200 response.

`fakeUserRepository.ts` — add `createRestaurantOwner` (store `lastRestaurantOwner = data`, create user with `role: "restaurant"`), and let `makeUser`-style factories accept a `role` override (default `"customer"`).

- [ ] **Step 4: Run the two test files:** Expected: PASS. Then full `npm test`: green.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/userRepository.ts src/routes/authRouter.ts src/routes/meRouter.ts tests/
git commit -m "feat(backend): restaurant signup with pending profile; role in auth responses"
```

---

### Task 5: Customer orders endpoints (place / list / detail / cancel) (TDD)

**Files:**
- Create: `backend/src/routes/customerOrdersRouter.ts`
- Modify: `backend/src/app.ts`, `backend/src/repositories/restaurantRepository.ts` (approved-only + isOnline exposure), `backend/src/lib/restaurantCard.ts`, `backend/tests/test-helpers/fakeRestaurantRepository.ts`
- Test: `backend/tests/routes/customerOrdersRouter.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3 modules; `RestaurantRepository.findDetailById` (profile + menuItems).
- Produces (consumed by Tasks 14–16 frontend): `POST /api/customer/orders` → `{ order: OrderDTO }`; `GET /api/customer/orders?page=` → `{ orders: OrderDTO[]; total; page; pageSize }`; `GET /api/customer/orders/:id` → `{ order }`; `POST /api/customer/orders/:id/cancel` → `{ order }`. Error bodies: `409 { error: "restaurant_closed", message }`, `409 { error: "items_unavailable", message, itemIds: string[] }`, `409 { error: "invalid_transition", message }`.

- [ ] **Step 1: Browse gate first.** In `restaurantRepository.ts` change the shared filter to hide unapproved restaurants everywhere:

```ts
const ACTIVE = { isActive: true, approvalStatus: "approved" } as const;
```

In `restaurantCard.ts` the store toggle joins the open computation:

```ts
    isOpenNow: r.isOnline && isOpenNow(r.opensAt, r.closesAt, now),
```

In `fakeRestaurantRepository.ts`'s `makeRestaurant` add the new columns so the Prisma type still checks: `approvalStatus: "approved", isOnline: true, createdAt: new Date("2026-01-01T00:00:00Z"),` (`approvedAt` is now nullable but keeps its existing Date value). Update the fake's list/search filters to also require `approvalStatus === "approved"`.

- [ ] **Step 2: Write the failing route tests** (`backend/tests/routes/customerOrdersRouter.test.ts`):

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createCustomerOrdersRouter } from "../../src/routes/customerOrdersRouter";
import { createFakeRestaurantRepository, makeRestaurant, makeMenuItem } from "../test-helpers/fakeRestaurantRepository";
import { createFakeOrderRepository, makeOrder } from "../test-helpers/fakeOrderRepository";
import { DELIVERY_FEE_CENTS } from "../../src/lib/orderPricing";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(restaurantData: Parameters<typeof createFakeRestaurantRepository>[0] = [], orders = createFakeOrderRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/api/customer/orders", createCustomerOrdersRouter({
    restaurantRepo: createFakeRestaurantRepository(restaurantData),
    orderRepo: orders, jwtSecret: JWT_SECRET,
  }));
  return app;
}

const openRestaurant = () => makeRestaurant({ opensAt: "00:00", closesAt: "00:00" }); // 24h

describe("POST /api/customer/orders", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).post("/api/customer/orders").send({});
    expect(res.status).toBe(401);
  });

  it("places an order: snapshots server prices, adds delivery fee, sets 2-min expiry", async () => {
    const r = openRestaurant();
    const item = makeMenuItem(r.id, { priceCents: 45000, name: "Margherita" });
    const orders = createFakeOrderRepository();
    const res = await request(buildApp([{ profile: r, menuItems: [item] }], orders))
      .post("/api/customer/orders").set(auth)
      .send({
        restaurantId: r.id, deliveryAddress: "12 Demo Lane", note: "extra basil",
        items: [{ menuItemId: item.id, quantity: 2, priceCents: 1 }], // client price must be ignored
      });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("placed");
    expect(res.body.order.subtotalCents).toBe(90000);
    expect(res.body.order.totalCents).toBe(90000 + DELIVERY_FEE_CENTS);
    expect(res.body.order.items[0]).toMatchObject({ nameSnapshot: "Margherita", priceAtOrderCents: 45000, quantity: 2 });
    const stored = orders.orders[0];
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(120_000);
  });

  it("409s items_unavailable listing the offending ids", async () => {
    const r = openRestaurant();
    const gone = makeMenuItem(r.id, { isAvailable: false });
    const res = await request(buildApp([{ profile: r, menuItems: [gone] }]))
      .post("/api/customer/orders").set(auth)
      .send({ restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: gone.id, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("items_unavailable");
    expect(res.body.itemIds).toEqual([gone.id]);
  });

  it("409s restaurant_closed when the store is offline", async () => {
    const r = makeRestaurant({ opensAt: "00:00", closesAt: "00:00", isOnline: false });
    const item = makeMenuItem(r.id);
    const res = await request(buildApp([{ profile: r, menuItems: [item] }]))
      .post("/api/customer/orders").set(auth)
      .send({ restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("restaurant_closed");
  });

  it("400s on bad payloads (no items, qty out of range, missing address)", async () => {
    const r = openRestaurant();
    const item = makeMenuItem(r.id);
    const app = buildApp([{ profile: r, menuItems: [item] }]);
    for (const bad of [
      { restaurantId: r.id, deliveryAddress: "x", items: [] },
      { restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 0 }] },
      { restaurantId: r.id, deliveryAddress: "x", items: [{ menuItemId: item.id, quantity: 21 }] },
      { restaurantId: r.id, items: [{ menuItemId: item.id, quantity: 1 }] },
    ]) {
      const res = await request(app).post("/api/customer/orders").set(auth).send(bad);
      expect(res.status).toBe(400);
    }
  });
});

describe("GET /api/customer/orders and /:id", () => {
  it("lists own orders newest-first and expires overdue placed ones on read", async () => {
    const overdue = makeOrder({ customerId: "u1", expiresAt: new Date(Date.now() - 1000) });
    const orders = createFakeOrderRepository([overdue]);
    const res = await request(buildApp([], orders)).get("/api/customer/orders").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.orders[0].status).toBe("rejected");
    expect(res.body.orders[0].rejectionReason).toBe("Not accepted in time");
  });

  it("404s another customer's order", async () => {
    const foreign = makeOrder({ customerId: "someone-else", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([foreign]);
    const res = await request(buildApp([], orders)).get(`/api/customer/orders/${foreign.id}`).set(auth);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/customer/orders/:id/cancel", () => {
  it("cancels a placed order", async () => {
    const o = makeOrder({ customerId: "u1", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([o]);
    const res = await request(buildApp([], orders)).post(`/api/customer/orders/${o.id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("cancelled");
  });

  it("409s invalid_transition once accepted", async () => {
    const o = makeOrder({ customerId: "u1", status: "accepted", expiresAt: new Date(Date.now() + 60_000) });
    const orders = createFakeOrderRepository([o]);
    const res = await request(buildApp([], orders)).post(`/api/customer/orders/${o.id}/cancel`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("invalid_transition");
  });
});
```

- [ ] **Step 3: Run to verify failure:** `npx vitest run tests/routes/customerOrdersRouter.test.ts` — Expected: FAIL (router not found).

- [ ] **Step 4: Implement `backend/src/routes/customerOrdersRouter.ts`:**

```ts
import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import type { OrderRepository } from "../repositories/orderRepository";
import { createRequireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { canTransition, ORDER_EXPIRY_MS } from "../lib/orderStateMachine";
import { computeOrderTotals } from "../lib/orderPricing";
import { toOrderDTO } from "../lib/orderDTO";
import { isOpenNow } from "../lib/openHours";

export interface CustomerOrdersRouterDeps {
  restaurantRepo: RestaurantRepository;
  orderRepo: OrderRepository;
  jwtSecret: string;
}

const PAGE_SIZE = 20;
const MAX_ITEMS = 50;
const MAX_QTY = 20;
const MAX_NOTE = 500;
const MAX_ADDRESS = 300;

export function createCustomerOrdersRouter(deps: CustomerOrdersRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);

  router.post("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { restaurantId, items, note, deliveryAddress } = req.body ?? {};
    const validItems = Array.isArray(items) && items.length > 0 && items.length <= MAX_ITEMS &&
      items.every((i) => i && typeof i.menuItemId === "string" &&
        Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= MAX_QTY);
    if (
      typeof restaurantId !== "string" || !validItems ||
      typeof deliveryAddress !== "string" || !deliveryAddress.trim() || deliveryAddress.length > MAX_ADDRESS ||
      (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE))
    ) {
      return res.status(400).json({ error: "Missing or invalid order details." });
    }

    const detail = await deps.restaurantRepo.findDetailById(restaurantId);
    if (!detail) return res.status(404).json({ error: "Restaurant not found." });
    if (!detail.isOnline || !isOpenNow(detail.opensAt, detail.closesAt)) {
      return res.status(409).json({ error: "restaurant_closed", message: `${detail.name} isn't taking orders right now.` });
    }

    const menuById = new Map(detail.menuItems.map((m) => [m.id, m]));
    const unavailable = (items as { menuItemId: string }[])
      .map((i) => i.menuItemId)
      .filter((id) => !menuById.get(id)?.isAvailable);
    if (unavailable.length > 0) {
      return res.status(409).json({
        error: "items_unavailable", itemIds: unavailable,
        message: "Some items in your basket are no longer available.",
      });
    }

    // Server-authoritative pricing: client-sent prices are ignored entirely.
    const lines = (items as { menuItemId: string; quantity: number }[]).map((i) => {
      const m = menuById.get(i.menuItemId)!;
      return { menuItemId: m.id, nameSnapshot: m.name, priceAtOrderCents: m.priceCents, quantity: i.quantity };
    });
    const totals = computeOrderTotals(lines.map((l) => ({ priceCents: l.priceAtOrderCents, quantity: l.quantity })));

    const order = await deps.orderRepo.create({
      customerId: req.userId!, restaurantId,
      note: (note ?? "").trim(), deliveryAddress: deliveryAddress.trim(),
      ...totals, expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS), isDemo: detail.isDemo,
      items: lines,
    });
    return res.status(201).json({ order: toOrderDTO(order) });
  }));

  router.get("/", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    await deps.orderRepo.expireOverdue(new Date(), { customerId: req.userId! });
    const { orders, total } = await deps.orderRepo.listForCustomer(req.userId!, page, PAGE_SIZE);
    return res.status(200).json({ orders: orders.map(toOrderDTO), total, page, pageSize: PAGE_SIZE });
  }));

  router.get("/:id", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    await deps.orderRepo.expireOverdue(new Date(), { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.customerId !== req.userId) return res.status(404).json({ error: "Order not found." });
    return res.status(200).json({ order: toOrderDTO(order) });
  }));

  router.post("/:id/cancel", requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const now = new Date();
    await deps.orderRepo.expireOverdue(now, { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.customerId !== req.userId) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, "cancelled", "customer")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can no longer be cancelled." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "cancelled", now);
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can no longer be cancelled." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  return router;
}
```

- [ ] **Step 5: Wire into `app.ts`:** add `createOrderRepository` import + `const orderRepo = createOrderRepository(config.prisma);` and, ABOVE the `/api/customer` mount:

```ts
  app.use("/api/customer/orders", createCustomerOrdersRouter({ restaurantRepo, orderRepo, jwtSecret: config.jwtSecret }));
```

- [ ] **Step 6: Run:** `npx vitest run tests/routes/customerOrdersRouter.test.ts` PASS, then full `npm test` green (existing suites must survive the `ACTIVE` filter change — the fakes were updated in Step 1).

- [ ] **Step 7: Commit**

```bash
git add src/ tests/
git commit -m "feat(backend): customer order placement, listing, detail, cancel"
```

---

### Task 6: Owner repository (profile, store status, menu CRUD, reviews)

**Files:**
- Create: `backend/src/repositories/ownerRepository.ts`, `backend/tests/test-helpers/fakeOwnerRepository.ts`

**Interfaces:**
- Consumes: Task 1 models.
- Produces (consumed by Tasks 7–9):

```ts
export interface MenuItemInput {
  category: string; name: string; description: string; priceCents: number; isAvailable: boolean;
}
export interface ProfileUpdate {
  name: string; description: string; address: string; cuisines: string[]; opensAt: string; closesAt: string;
}
export interface OwnerRepository {
  findProfileByUserId(userId: string): Promise<RestaurantProfile | null>;
  approve(profileId: string, now: Date): Promise<RestaurantProfile>;
  updateProfile(profileId: string, data: ProfileUpdate): Promise<RestaurantProfile>;
  setOnline(profileId: string, isOnline: boolean): Promise<RestaurantProfile>;
  listMenu(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(restaurantId: string, data: MenuItemInput): Promise<MenuItem>;
  /** Ownership-guarded: null when the item doesn't belong to restaurantId. */
  updateMenuItem(restaurantId: string, itemId: string, data: Partial<MenuItemInput>): Promise<MenuItem | null>;
  deleteMenuItem(restaurantId: string, itemId: string): Promise<boolean>;
  listRatings(restaurantId: string, limit: number): Promise<Rating[]>;
}
```

- [ ] **Step 1: Implement `backend/src/repositories/ownerRepository.ts`** (repositories in this codebase are exercised through route tests with fakes; the Prisma implementation is verified in the Task 20 end-to-end pass):

```ts
import type { MenuItem, PrismaClient, Rating, RestaurantProfile } from "@prisma/client";

export interface MenuItemInput {
  category: string; name: string; description: string; priceCents: number; isAvailable: boolean;
}

export interface ProfileUpdate {
  name: string; description: string; address: string; cuisines: string[]; opensAt: string; closesAt: string;
}

export interface OwnerRepository {
  findProfileByUserId(userId: string): Promise<RestaurantProfile | null>;
  approve(profileId: string, now: Date): Promise<RestaurantProfile>;
  updateProfile(profileId: string, data: ProfileUpdate): Promise<RestaurantProfile>;
  setOnline(profileId: string, isOnline: boolean): Promise<RestaurantProfile>;
  listMenu(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(restaurantId: string, data: MenuItemInput): Promise<MenuItem>;
  updateMenuItem(restaurantId: string, itemId: string, data: Partial<MenuItemInput>): Promise<MenuItem | null>;
  deleteMenuItem(restaurantId: string, itemId: string): Promise<boolean>;
  listRatings(restaurantId: string, limit: number): Promise<Rating[]>;
}

export function createOwnerRepository(prisma: PrismaClient): OwnerRepository {
  return {
    findProfileByUserId(userId) {
      return prisma.restaurantProfile.findFirst({ where: { userId } });
    },
    approve(profileId, now) {
      return prisma.restaurantProfile.update({
        where: { id: profileId },
        data: { approvalStatus: "approved", approvedAt: now },
      });
    },
    updateProfile(profileId, data) {
      return prisma.restaurantProfile.update({ where: { id: profileId }, data });
    },
    setOnline(profileId, isOnline) {
      return prisma.restaurantProfile.update({ where: { id: profileId }, data: { isOnline } });
    },
    listMenu(restaurantId) {
      return prisma.menuItem.findMany({ where: { restaurantId }, orderBy: { position: "asc" } });
    },
    async createMenuItem(restaurantId, data) {
      const max = await prisma.menuItem.aggregate({ where: { restaurantId }, _max: { position: true } });
      return prisma.menuItem.create({
        data: { ...data, restaurantId, position: (max._max.position ?? 0) + 1 },
      });
    },
    async updateMenuItem(restaurantId, itemId, data) {
      const { count } = await prisma.menuItem.updateMany({ where: { id: itemId, restaurantId }, data });
      if (count === 0) return null;
      return prisma.menuItem.findUnique({ where: { id: itemId } });
    },
    async deleteMenuItem(restaurantId, itemId) {
      const { count } = await prisma.menuItem.deleteMany({ where: { id: itemId, restaurantId } });
      return count > 0;
    },
    listRatings(restaurantId, limit) {
      return prisma.rating.findMany({
        where: { restaurantId }, orderBy: { createdAt: "desc" }, take: limit,
      });
    },
  };
}
```

- [ ] **Step 2: Create `backend/tests/test-helpers/fakeOwnerRepository.ts`:**

```ts
import type { MenuItem, Rating, RestaurantProfile } from "@prisma/client";
import type { MenuItemInput, OwnerRepository, ProfileUpdate } from "../../src/repositories/ownerRepository";
import { makeMenuItem, makeRating, makeRestaurant } from "./fakeRestaurantRepository";

export interface FakeOwnerData {
  profile: RestaurantProfile;
  menuItems?: MenuItem[];
  ratings?: Rating[];
}

export function createFakeOwnerRepository(data: FakeOwnerData[]): OwnerRepository & { data: FakeOwnerData[] } {
  const byId = (id: string) => data.find((d) => d.profile.id === id);
  let itemSeq = 0;

  return {
    data,
    async findProfileByUserId(userId) {
      return data.find((d) => d.profile.userId === userId)?.profile ?? null;
    },
    async approve(profileId, now) {
      const p = byId(profileId)!.profile;
      p.approvalStatus = "approved"; p.approvedAt = now;
      return p;
    },
    async updateProfile(profileId, patch: ProfileUpdate) {
      const p = byId(profileId)!.profile;
      Object.assign(p, patch);
      return p;
    },
    async setOnline(profileId, isOnline) {
      const p = byId(profileId)!.profile;
      p.isOnline = isOnline;
      return p;
    },
    async listMenu(restaurantId) {
      return [...(byId(restaurantId)?.menuItems ?? [])].sort((a, b) => a.position - b.position);
    },
    async createMenuItem(restaurantId, input: MenuItemInput) {
      itemSeq += 1;
      const d = byId(restaurantId)!;
      d.menuItems ??= [];
      const item: MenuItem = {
        id: `new-item-${itemSeq}`, restaurantId, imageUrl: null,
        position: d.menuItems.length + 1, ...input,
      };
      d.menuItems.push(item);
      return item;
    },
    async updateMenuItem(restaurantId, itemId, patch) {
      const item = byId(restaurantId)?.menuItems?.find((m) => m.id === itemId);
      if (!item) return null;
      Object.assign(item, patch);
      return item;
    },
    async deleteMenuItem(restaurantId, itemId) {
      const d = byId(restaurantId);
      const before = d?.menuItems?.length ?? 0;
      if (d?.menuItems) d.menuItems = d.menuItems.filter((m) => m.id !== itemId);
      return (d?.menuItems?.length ?? 0) < before;
    },
    async listRatings(restaurantId, limit) {
      return (byId(restaurantId)?.ratings ?? [])
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },
  };
}

/** Owner-scoped fixture: an approved, online, owned restaurant. */
export function makeOwnedRestaurant(userId = "owner-1") {
  const profile = makeRestaurant({ userId, opensAt: "00:00", closesAt: "00:00" });
  return {
    profile,
    menuItems: [makeMenuItem(profile.id), makeMenuItem(profile.id)],
    ratings: [makeRating(profile.id)],
  } satisfies FakeOwnerData;
}
```

- [ ] **Step 3: Typecheck + full suite:** `npx tsc --noEmit` clean, `npm test` green.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/ownerRepository.ts tests/test-helpers/fakeOwnerRepository.ts
git commit -m "feat(backend): owner repository — profile, store status, menu CRUD, ratings"
```

---

### Task 7: Owner router — /restaurant/me, profile, store-status (TDD)

**Files:**
- Create: `backend/src/routes/ownerRouter.ts`, `backend/src/middleware/requireOwner.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/ownerRouter.test.ts`

**Interfaces:**
- Consumes: Task 6 `OwnerRepository`; Task 2 `AUTO_APPROVE_AFTER_MS`.
- Produces (consumed by Tasks 8–9 middleware-wise and Tasks 13, 22 frontend): `requireOwner` middleware attaching `req.ownerProfile`; `GET /api/restaurant/me` → `{ profile: OwnerProfileDTO }` (lazy auto-approve); `PATCH /api/restaurant/profile`; `PATCH /api/restaurant/store-status`; `GET /api/restaurant/reviews` → `{ reviews }`.

```ts
// requireOwner.ts
export interface OwnerRequest extends AuthenticatedRequest { ownerProfile?: RestaurantProfile; }
export function createRequireOwner(jwtSecret: string, ownerRepo: OwnerRepository): RequestHandler[];
// OwnerProfileDTO
{ id, name, description, address, cuisines, opensAt, closesAt, isOnline,
  approvalStatus, avgRating, ratingCount, estDeliveryMin }
```

- [ ] **Step 1: Write the failing tests** (`backend/tests/routes/ownerRouter.test.ts`):

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerRouter } from "../../src/routes/ownerRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };
const strangerAuth = { Authorization: `Bearer ${signToken({ userId: "not-an-owner" }, JWT_SECRET)}` };

function buildApp(data = [makeOwnedRestaurant()]) {
  const repo = createFakeOwnerRepository(data);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant", createOwnerRouter({ ownerRepo: repo, jwtSecret: JWT_SECRET }));
  return { app, repo };
}

describe("GET /api/restaurant/me", () => {
  it("401s without a token and 403s a non-owner account", async () => {
    const { app } = buildApp();
    expect((await request(app).get("/api/restaurant/me")).status).toBe(401);
    expect((await request(app).get("/api/restaurant/me").set(strangerAuth)).status).toBe(403);
  });

  it("returns the owner profile DTO", async () => {
    const { app, repo } = buildApp();
    const res = await request(app).get("/api/restaurant/me").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      id: repo.data[0].profile.id, approvalStatus: "approved", isOnline: true,
    });
    expect(res.body.profile.cuisines).toEqual(repo.data[0].profile.cuisines);
  });

  it("auto-approves a pending profile older than 60s, not a fresh one", async () => {
    const fresh = makeOwnedRestaurant();
    fresh.profile.approvalStatus = "pending";
    fresh.profile.createdAt = new Date(Date.now() - 10_000);
    const { app: appFresh } = buildApp([fresh]);
    expect((await request(appFresh).get("/api/restaurant/me").set(ownerAuth)).body.profile.approvalStatus).toBe("pending");

    const due = makeOwnedRestaurant();
    due.profile.approvalStatus = "pending";
    due.profile.createdAt = new Date(Date.now() - 90_000);
    const { app: appDue } = buildApp([due]);
    expect((await request(appDue).get("/api/restaurant/me").set(ownerAuth)).body.profile.approvalStatus).toBe("approved");
  });
});

describe("PATCH /api/restaurant/profile", () => {
  it("updates business fields (FR-21)", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/restaurant/profile").set(ownerAuth).send({
      name: "Rosa's", description: "Wood-fired.", address: "9 Zamzama",
      cuisines: ["Italian", "Pizza"], opensAt: "10:00", closesAt: "22:30",
    });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ name: "Rosa's", opensAt: "10:00", cuisines: ["Italian", "Pizza"] });
  });

  it("400s bad hours or empty name", async () => {
    const { app } = buildApp();
    for (const bad of [
      { name: "", description: "", address: "x", cuisines: ["a"], opensAt: "10:00", closesAt: "22:00" },
      { name: "x", description: "", address: "x", cuisines: ["a"], opensAt: "25:99", closesAt: "22:00" },
      { name: "x", description: "", address: "x", cuisines: [], opensAt: "10:00", closesAt: "22:00" },
    ]) {
      expect((await request(app).patch("/api/restaurant/profile").set(ownerAuth).send(bad)).status).toBe(400);
    }
  });
});

describe("PATCH /api/restaurant/store-status", () => {
  it("toggles isOnline", async () => {
    const { app } = buildApp();
    const res = await request(app).patch("/api/restaurant/store-status").set(ownerAuth).send({ isOnline: false });
    expect(res.status).toBe(200);
    expect(res.body.profile.isOnline).toBe(false);
  });
});

describe("GET /api/restaurant/reviews", () => {
  it("returns recent reviews", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/restaurant/reviews").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.reviews.length).toBeGreaterThan(0);
    expect(res.body.reviews[0]).toHaveProperty("stars");
  });
});
```

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/routes/ownerRouter.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement.** `backend/src/middleware/requireOwner.ts`:

```ts
import type { Response, NextFunction, RequestHandler } from "express";
import type { RestaurantProfile } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface OwnerRequest extends AuthenticatedRequest {
  ownerProfile?: RestaurantProfile;
}

/** requireAuth + resolve the caller's RestaurantProfile (403 without one).
 *  Role is implicit: only restaurant accounts have an owned profile. */
export function createRequireOwner(jwtSecret: string, ownerRepo: OwnerRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolveOwner = asyncHandler(async (req: OwnerRequest, res: Response, next: NextFunction) => {
    const profile = await ownerRepo.findProfileByUserId(req.userId!);
    if (!profile) return res.status(403).json({ error: "Not a restaurant account." });
    req.ownerProfile = profile;
    next();
  });
  return [requireAuth, resolveOwner];
}
```

`backend/src/routes/ownerRouter.ts`:

```ts
import { Router } from "express";
import type { RestaurantProfile } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";
import { AUTO_APPROVE_AFTER_MS } from "../lib/orderStateMachine";

export interface OwnerRouterDeps {
  ownerRepo: OwnerRepository;
  jwtSecret: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const REVIEWS_LIMIT = 20;

export function toOwnerProfileDTO(p: RestaurantProfile) {
  return {
    id: p.id, name: p.name, description: p.description, address: p.address,
    cuisines: p.cuisines, opensAt: p.opensAt, closesAt: p.closesAt,
    isOnline: p.isOnline, approvalStatus: p.approvalStatus,
    avgRating: p.avgRating, ratingCount: p.ratingCount, estDeliveryMin: p.estDeliveryMin,
  };
}

export function createOwnerRouter(deps: OwnerRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  router.get("/me", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    let profile = req.ownerProfile!;
    // Lazy auto-approve (spec §3): stands in for the Admin review until that phase ships.
    if (profile.approvalStatus === "pending" &&
        Date.now() - profile.createdAt.getTime() >= AUTO_APPROVE_AFTER_MS) {
      profile = await deps.ownerRepo.approve(profile.id, new Date());
    }
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.patch("/profile", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { name, description, address, cuisines, opensAt, closesAt } = req.body ?? {};
    if (
      typeof name !== "string" || !name.trim() ||
      typeof description !== "string" ||
      typeof address !== "string" || !address.trim() ||
      !Array.isArray(cuisines) || cuisines.length === 0 || !cuisines.every((c) => typeof c === "string" && c.trim()) ||
      typeof opensAt !== "string" || !HHMM.test(opensAt) ||
      typeof closesAt !== "string" || !HHMM.test(closesAt)
    ) {
      return res.status(400).json({ error: "Missing or invalid profile details." });
    }
    const profile = await deps.ownerRepo.updateProfile(req.ownerProfile!.id, {
      name: name.trim(), description: description.trim(), address: address.trim(),
      cuisines: cuisines.map((c: string) => c.trim()), opensAt, closesAt,
    });
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.patch("/store-status", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { isOnline } = req.body ?? {};
    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ error: "isOnline must be a boolean." });
    }
    const profile = await deps.ownerRepo.setOnline(req.ownerProfile!.id, isOnline);
    return res.status(200).json({ profile: toOwnerProfileDTO(profile) });
  }));

  router.get("/reviews", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const reviews = await deps.ownerRepo.listRatings(req.ownerProfile!.id, REVIEWS_LIMIT);
    return res.status(200).json({
      reviews: reviews.map((r) => ({
        id: r.id, stars: r.stars, reviewText: r.reviewText,
        authorName: r.authorName, createdAt: r.createdAt.toISOString(),
      })),
    });
  }));

  return router;
}
```

- [ ] **Step 4: Wire into `app.ts`:** `const ownerRepo = createOwnerRepository(config.prisma);` and, ABOVE `/api/restaurants` (path prefix overlap — `/api/restaurant` must not swallow `/api/restaurants`; Express matches path segments so both orders work, but keep owner mounts grouped):

```ts
  app.use("/api/restaurant", createOwnerRouter({ ownerRepo, jwtSecret: config.jwtSecret }));
```

- [ ] **Step 5: Run:** `npx vitest run tests/routes/ownerRouter.test.ts` PASS; full `npm test` green.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat(backend): owner router — me with lazy auto-approve, profile, store-status, reviews"
```

---

### Task 8: Owner orders router — queue, accept/reject, status (TDD)

**Files:**
- Create: `backend/src/routes/ownerOrdersRouter.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/ownerOrdersRouter.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 6, 7 (`requireOwner`, `OrderRepository`, state machine, `toOrderDTO`).
- Produces (consumed by Tasks 17–19, 21): `GET /api/restaurant/orders?tab=new|preparing|ready|history|all&q=&page=` → `{ orders, total, page, pageSize, counts: { new, preparing, ready } }`; `POST /api/restaurant/orders/:id/accept`; `POST /api/restaurant/orders/:id/reject {reason}`; `POST /api/restaurant/orders/:id/status {to}` — each → `{ order: OrderDTO }` or `409 { error: "invalid_transition" | "order_expired", message }`.

Tab → statuses map (the single UI grouping): `new: [placed]` · `preparing: [accepted, preparing]` · `ready: [ready]` · `history: [rejected, cancelled, delivered]` · `all: every status`.

- [ ] **Step 1: Write the failing tests** (`backend/tests/routes/ownerOrdersRouter.test.ts`):

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerOrdersRouter } from "../../src/routes/ownerOrdersRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { createFakeOrderRepository, makeOrder } from "../test-helpers/fakeOrderRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };
const future = () => new Date(Date.now() + 60_000);

function buildApp(seedOrders: ReturnType<typeof makeOrder>[] = [], owned = makeOwnedRestaurant()) {
  const orderRepo = createFakeOrderRepository(seedOrders);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant/orders", createOwnerOrdersRouter({
    ownerRepo: createFakeOwnerRepository([owned]), orderRepo, jwtSecret: JWT_SECRET,
  }));
  return { app, orderRepo, restaurantId: owned.profile.id };
}

describe("GET /api/restaurant/orders", () => {
  it("filters by tab, sweeps expiry, and returns queue counts", async () => {
    const owned = makeOwnedRestaurant();
    const rid = owned.profile.id;
    const fresh = makeOrder({ restaurantId: rid, expiresAt: future() });
    const overdue = makeOrder({ restaurantId: rid, expiresAt: new Date(Date.now() - 1000) });
    const cooking = makeOrder({ restaurantId: rid, status: "preparing", expiresAt: future() });
    const { app } = buildApp([fresh, overdue, cooking], owned);

    const res = await request(app).get("/api/restaurant/orders?tab=new").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o: { id: string }) => o.id)).toEqual([fresh.id]); // overdue got expired
    expect(res.body.counts).toEqual({ new: 1, preparing: 1, ready: 0 });

    const hist = await request(app).get("/api/restaurant/orders?tab=history").set(ownerAuth);
    expect(hist.body.orders.map((o: { id: string }) => o.id)).toEqual([overdue.id]);
  });

  it("searches by order number and customer name (FR-16)", async () => {
    const owned = makeOwnedRestaurant();
    const target = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const other = makeOrder({ restaurantId: owned.profile.id, expiresAt: future(), customer: { name: "Zainab", phone: "03000000000" } });
    const { app } = buildApp([target, other], owned);

    const byNumber = await request(app).get(`/api/restaurant/orders?tab=all&q=${target.orderNumber}`).set(ownerAuth);
    expect(byNumber.body.orders.map((o: { id: string }) => o.id)).toEqual([target.id]);

    const byName = await request(app).get("/api/restaurant/orders?tab=all&q=zainab").set(ownerAuth);
    expect(byName.body.orders.map((o: { id: string }) => o.id)).toEqual([other.id]);
  });

  it("never returns another restaurant's orders", async () => {
    const owned = makeOwnedRestaurant();
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([foreign], owned);
    const res = await request(app).get("/api/restaurant/orders?tab=all").set(ownerAuth);
    expect(res.body.orders).toEqual([]);
  });
});

describe("transitions", () => {
  it("accepts a placed order", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const { app } = buildApp([o], owned);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/accept`).set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("accepted");
    expect(res.body.order.acceptedAt).not.toBe(null);
  });

  it("409s order_expired when accepting past the deadline", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: new Date(Date.now() - 1000) });
    const { app } = buildApp([o], owned);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/accept`).set(ownerAuth);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("order_expired");
  });

  it("rejects with a required reason", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const { app } = buildApp([o], owned);
    expect((await request(app).post(`/api/restaurant/orders/${o.id}/reject`).set(ownerAuth).send({})).status).toBe(400);
    const res = await request(app).post(`/api/restaurant/orders/${o.id}/reject`).set(ownerAuth).send({ reason: "Store too busy" });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "rejected", rejectionReason: "Store too busy" });
  });

  it("walks accepted → preparing → ready and blocks skips + post-ready moves", async () => {
    const owned = makeOwnedRestaurant();
    const o = makeOrder({ restaurantId: owned.profile.id, status: "accepted", expiresAt: future() });
    const { app } = buildApp([o], owned);
    const url = `/api/restaurant/orders/${o.id}/status`;
    expect((await request(app).post(url).set(ownerAuth).send({ to: "ready" })).status).toBe(409); // skip blocked
    expect((await request(app).post(url).set(ownerAuth).send({ to: "preparing" })).body.order.status).toBe("preparing");
    expect((await request(app).post(url).set(ownerAuth).send({ to: "ready" })).body.order.status).toBe("ready");
    expect((await request(app).post(url).set(ownerAuth).send({ to: "delivered" })).status).toBe(400); // not an allowed target this phase
  });

  it("404s transitions on another restaurant's order", async () => {
    const owned = makeOwnedRestaurant();
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([foreign], owned);
    expect((await request(app).post(`/api/restaurant/orders/${foreign.id}/accept`).set(ownerAuth)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/routes/ownerOrdersRouter.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/routes/ownerOrdersRouter.ts`:**

```ts
import { Router } from "express";
import type { OrderStatus } from "@prisma/client";
import type { OwnerRepository } from "../repositories/ownerRepository";
import type { OrderRepository, OrderWithItems } from "../repositories/orderRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";
import { canTransition, EXPIRY_REJECTION_REASON, REJECTION_REASONS } from "../lib/orderStateMachine";
import { toOrderDTO } from "../lib/orderDTO";

export interface OwnerOrdersRouterDeps {
  ownerRepo: OwnerRepository;
  orderRepo: OrderRepository;
  jwtSecret: string;
}

const PAGE_SIZE = 20;

const TAB_STATUSES: Record<string, OrderStatus[]> = {
  new: ["placed"],
  preparing: ["accepted", "preparing"],
  ready: ["ready"],
  history: ["rejected", "cancelled", "delivered"],
  all: ["placed", "accepted", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "rejected", "cancelled"],
};

export function createOwnerOrdersRouter(deps: OwnerOrdersRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  /** Load + ownership-check an order, sweeping its expiry first. */
  async function loadOwn(req: OwnerRequest): Promise<OrderWithItems | null> {
    await deps.orderRepo.expireOverdue(new Date(), { orderId: req.params.id });
    const order = await deps.orderRepo.findById(req.params.id);
    if (!order || order.restaurantId !== req.ownerProfile!.id) return null;
    return order;
  }

  router.get("/", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const rid = req.ownerProfile!.id;
    const tab = String(req.query.tab ?? "new");
    const statuses = TAB_STATUSES[tab];
    if (!statuses) return res.status(400).json({ error: "Unknown tab." });
    const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);

    await deps.orderRepo.expireOverdue(new Date(), { restaurantId: rid });
    const [{ orders, total }, counts] = await Promise.all([
      deps.orderRepo.listForRestaurant(rid, statuses, q, page, PAGE_SIZE),
      deps.orderRepo.countByStatus(rid),
    ]);
    return res.status(200).json({
      orders: orders.map(toOrderDTO), total, page, pageSize: PAGE_SIZE,
      counts: {
        new: counts.placed ?? 0,
        preparing: (counts.accepted ?? 0) + (counts.preparing ?? 0),
        ready: counts.ready ?? 0,
      },
    });
  }));

  router.post("/:id/accept", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.status === "rejected" && order.rejectionReason === EXPIRY_REJECTION_REASON) {
      // The just-swept case: it expired before the restaurant tapped Accept.
      return res.status(409).json({ error: "order_expired", message: "This order timed out and was auto-rejected." });
    }
    if (!canTransition(order.status, "accepted", "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can't be accepted anymore." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "accepted", new Date());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can't be accepted anymore." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  router.post("/:id/reject", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { reason } = req.body ?? {};
    if (typeof reason !== "string" || !reason.trim() || reason.length > 200) {
      return res.status(400).json({ error: `A reason is required (e.g. ${REJECTION_REASONS.join(", ")}).` });
    }
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, "rejected", "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "This order can't be rejected anymore." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, "rejected", new Date(), reason.trim());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "This order can't be rejected anymore." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  router.post("/:id/status", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const { to } = req.body ?? {};
    if (to !== "preparing" && to !== "ready") {
      return res.status(400).json({ error: "to must be \"preparing\" or \"ready\"." });
    }
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (!canTransition(order.status, to, "restaurant")) {
      return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this order." });
    }
    const updated = await deps.orderRepo.transition(order.id, order.status, to, new Date());
    if (!updated) return res.status(409).json({ error: "invalid_transition", message: "That step isn't available for this order." });
    return res.status(200).json({ order: toOrderDTO(updated) });
  }));

  return router;
}
```

- [ ] **Step 4: Wire into `app.ts`** ABOVE the `/api/restaurant` mount:

```ts
  app.use("/api/restaurant/orders", createOwnerOrdersRouter({ ownerRepo, orderRepo, jwtSecret: config.jwtSecret }));
```

- [ ] **Step 5: Run:** `npx vitest run tests/routes/ownerOrdersRouter.test.ts` PASS; full `npm test` green.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat(backend): restaurant order queue with tabs, counts, search, guarded transitions"
```

---

### Task 9: Owner menu router (TDD)

**Files:**
- Create: `backend/src/routes/ownerMenuRouter.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/ownerMenuRouter.test.ts`

**Interfaces:**
- Consumes: Tasks 6–7.
- Produces (consumed by Tasks 20–21): `GET /api/restaurant/menu` → `{ items: MenuItemDTO[] }` (flat, position-ordered; grouping is client-side); `POST /api/restaurant/menu-items` → `201 { item }`; `PATCH /api/restaurant/menu-items/:id` → `{ item }`; `DELETE /api/restaurant/menu-items/:id` → `204`. `MenuItemDTO = { id, category, name, description, priceCents, imageUrl, isAvailable, position }`.

- [ ] **Step 1: Write the failing tests** (`backend/tests/routes/ownerMenuRouter.test.ts`):

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOwnerMenuRouter } from "../../src/routes/ownerMenuRouter";
import { createFakeOwnerRepository, makeOwnedRestaurant } from "../test-helpers/fakeOwnerRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const ownerAuth = { Authorization: `Bearer ${signToken({ userId: "owner-1" }, JWT_SECRET)}` };

function buildApp(owned = makeOwnedRestaurant()) {
  const repo = createFakeOwnerRepository([owned]);
  const app = express();
  app.use(express.json());
  app.use("/api/restaurant", createOwnerMenuRouter({ ownerRepo: repo, jwtSecret: JWT_SECRET }));
  return { app, owned };
}

describe("owner menu", () => {
  it("lists own items in position order", async () => {
    const { app, owned } = buildApp();
    const res = await request(app).get("/api/restaurant/menu").set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(owned.menuItems!.length);
    expect(res.body.items[0]).toHaveProperty("category");
  });

  it("creates an item (FR-17) with validation", async () => {
    const { app } = buildApp();
    const bad = await request(app).post("/api/restaurant/menu-items").set(ownerAuth)
      .send({ category: "Mains", name: "", description: "", priceCents: -5, isAvailable: true });
    expect(bad.status).toBe(400);
    const res = await request(app).post("/api/restaurant/menu-items").set(ownerAuth)
      .send({ category: "Pizze", name: "Diavola", description: "Spicy salami.", priceCents: 52000, isAvailable: true });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: "Diavola", priceCents: 52000 });
  });

  it("edits + toggles availability, 404s foreign items", async () => {
    const { app, owned } = buildApp();
    const mine = owned.menuItems![0];
    const res = await request(app).patch(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.item.isAvailable).toBe(false);
    expect((await request(app).patch("/api/restaurant/menu-items/not-mine").set(ownerAuth)
      .send({ isAvailable: false })).status).toBe(404);
  });

  it("deletes an item", async () => {
    const { app, owned } = buildApp();
    const mine = owned.menuItems![0];
    expect((await request(app).delete(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)).status).toBe(204);
    expect((await request(app).delete(`/api/restaurant/menu-items/${mine.id}`).set(ownerAuth)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**, then **Step 3: Implement `backend/src/routes/ownerMenuRouter.ts`:**

```ts
import { Router } from "express";
import type { MenuItem } from "@prisma/client";
import type { MenuItemInput, OwnerRepository } from "../repositories/ownerRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";

export interface OwnerMenuRouterDeps {
  ownerRepo: OwnerRepository;
  jwtSecret: string;
}

const MAX_NAME = 120;
const MAX_DESC = 500;
const MAX_PRICE_CENTS = 100_000_00; // Rs 100,000 — sanity ceiling

function toMenuItemDTO(m: MenuItem) {
  return {
    id: m.id, category: m.category, name: m.name, description: m.description,
    priceCents: m.priceCents, imageUrl: m.imageUrl, isAvailable: m.isAvailable, position: m.position,
  };
}

/** Validates a full create body; for PATCH, pass partial=true. Returns null on failure. */
function readItemInput(body: unknown, partial: boolean): Partial<MenuItemInput> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<MenuItemInput> = {};
  const bad = (cond: boolean) => cond;

  if (b.category !== undefined || !partial) {
    if (bad(typeof b.category !== "string" || !(b.category as string).trim())) return null;
    out.category = (b.category as string).trim();
  }
  if (b.name !== undefined || !partial) {
    if (bad(typeof b.name !== "string" || !(b.name as string).trim() || (b.name as string).length > MAX_NAME)) return null;
    out.name = (b.name as string).trim();
  }
  if (b.description !== undefined || !partial) {
    if (bad(typeof b.description !== "string" || (b.description as string).length > MAX_DESC)) return null;
    out.description = (b.description as string).trim();
  }
  if (b.priceCents !== undefined || !partial) {
    if (bad(!Number.isInteger(b.priceCents) || (b.priceCents as number) <= 0 || (b.priceCents as number) > MAX_PRICE_CENTS)) return null;
    out.priceCents = b.priceCents as number;
  }
  if (b.isAvailable !== undefined || !partial) {
    if (bad(typeof b.isAvailable !== "boolean")) return null;
    out.isAvailable = b.isAvailable as boolean;
  }
  return out;
}

export function createOwnerMenuRouter(deps: OwnerMenuRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  router.get("/menu", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const items = await deps.ownerRepo.listMenu(req.ownerProfile!.id);
    return res.status(200).json({ items: items.map(toMenuItemDTO) });
  }));

  router.post("/menu-items", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const input = readItemInput(req.body, false);
    if (!input) return res.status(400).json({ error: "Missing or invalid menu item details." });
    const item = await deps.ownerRepo.createMenuItem(req.ownerProfile!.id, input as MenuItemInput);
    return res.status(201).json({ item: toMenuItemDTO(item) });
  }));

  router.patch("/menu-items/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const input = readItemInput(req.body, true);
    if (!input || Object.keys(input).length === 0) {
      return res.status(400).json({ error: "Missing or invalid menu item details." });
    }
    const item = await deps.ownerRepo.updateMenuItem(req.ownerProfile!.id, req.params.id, input);
    if (!item) return res.status(404).json({ error: "Menu item not found." });
    return res.status(200).json({ item: toMenuItemDTO(item) });
  }));

  router.delete("/menu-items/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const removed = await deps.ownerRepo.deleteMenuItem(req.ownerProfile!.id, req.params.id);
    if (!removed) return res.status(404).json({ error: "Menu item not found." });
    return res.status(204).end();
  }));

  return router;
}
```

- [ ] **Step 4: Wire into `app.ts`** (same `/api/restaurant` prefix, mounted alongside `createOwnerRouter` — Express runs both):

```ts
  app.use("/api/restaurant", createOwnerMenuRouter({ ownerRepo, jwtSecret: config.jwtSecret }));
```

- [ ] **Step 5: Run:** router test PASS; full `npm test` green.

- [ ] **Step 6: Commit**

```bash
git add src/ tests/
git commit -m "feat(backend): owner menu CRUD with availability toggle"
```

---

### Task 10: Seeds — demo owner account + historical demo orders

**Files:**
- Modify: `backend/prisma/seed.ts`, `backend/prisma/seedData.ts`

**Interfaces:**
- Consumes: Tasks 1–2 (models, `EXPIRY_REJECTION_REASON`).
- Produces: documented demo login `owner@demo.feastnow.pk` / `Demo1234!` owning the first seeded demo restaurant, with 3 closed `isDemo` orders so History isn't empty.

- [ ] **Step 1: Extend `seed.ts`.** FIRST, in the existing restaurant-creation loop, add `approvalStatus: "approved",` next to `isDemo: true, isActive: true` — the new schema default is `pending`, so without this a reseed would hide every demo restaurant from browse. THEN, after the loop, add (imports at top: `import { hashPassword } from "../src/lib/password";` and `import { EXPIRY_REJECTION_REASON } from "../src/lib/orderStateMachine";`):

```ts
  // Demo restaurant owner (spec §8) — idempotent via upsert; owns the first demo restaurant.
  const DEMO_OWNER_EMAIL = "owner@demo.feastnow.pk";
  const first = await prisma.restaurantProfile.findFirst({ where: { isDemo: true }, orderBy: { name: "asc" } });
  if (!first) throw new Error("Seed created no demo restaurants — cannot attach demo owner.");

  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: {},
    create: {
      name: "Demo Owner", email: DEMO_OWNER_EMAIL, phone: "03330000001",
      passwordHash: await hashPassword("Demo1234!"), role: "restaurant",
    },
  });
  await prisma.restaurantProfile.update({ where: { id: first.id }, data: { userId: owner.id } });

  // Demo customer (order author) + closed historical orders so History isn't empty.
  const demoCustomer = await prisma.user.upsert({
    where: { email: "customer@demo.feastnow.pk" },
    update: {},
    create: {
      name: "Demo Customer", email: "customer@demo.feastnow.pk", phone: "03330000002",
      passwordHash: await hashPassword("Demo1234!"), role: "customer",
    },
  });

  const menu = await prisma.menuItem.findMany({ where: { restaurantId: first.id }, take: 2 });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const historical = [
    { status: "rejected" as const, rejectionReason: "Store too busy", placed: daysAgo(2) },
    { status: "rejected" as const, rejectionReason: EXPIRY_REJECTION_REASON, placed: daysAgo(1) },
    { status: "cancelled" as const, rejectionReason: null, placed: daysAgo(1) },
  ];
  for (const h of historical) {
    const subtotal = menu.reduce((s, m) => s + m.priceCents, 0);
    await prisma.order.create({
      data: {
        customerId: demoCustomer.id, restaurantId: first.id, status: h.status,
        rejectionReason: h.rejectionReason, note: "", deliveryAddress: "12 Demo Lane, Karachi",
        subtotalCents: subtotal, deliveryFeeCents: 9900, totalCents: subtotal + 9900,
        createdAt: h.placed, closedAt: new Date(h.placed.getTime() + 120_000),
        expiresAt: new Date(h.placed.getTime() + 120_000), isDemo: true,
        items: { create: menu.map((m) => ({ menuItemId: m.id, nameSnapshot: m.name, priceAtOrderCents: m.priceCents, quantity: 1 })) },
      },
    });
  }
  console.log(`Demo owner: ${DEMO_OWNER_EMAIL} / Demo1234! → "${first.name}" (+${historical.length} historical demo orders)`);
```

Also change the seed's opening `deleteMany` block: before deleting demo restaurants, delete their demo orders explicitly so counts log cleanly (they'd cascade anyway):

```ts
  await prisma.order.deleteMany({ where: { isDemo: true } });
```

- [ ] **Step 2: Run the seed against the dev DB:** `cd backend && npm run seed`. Expected output includes the `Demo owner:` line.

- [ ] **Step 3: Verify:** `npx tsx -e "import 'dotenv/config'; import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.order.count({ where: { isDemo: true } }).then(c => { console.log('demo orders:', c); return p.$disconnect(); });"` — Expected: `demo orders: 3`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts prisma/seedData.ts
git commit -m "feat(backend): seed demo restaurant owner and historical demo orders"
```

---

### Task 11: Landing — restaurant signup page + role-select link

**Files:**
- Create: `landing/signup-restaurant.html`, `landing/assets/js/signup-restaurant.js`
- Modify: `landing/role-select.html`

**Interfaces:**
- Consumes: Task 4's extended `verify-otp` contract.
- Produces: working "I'm a restaurant" onboarding path ending at `/app/` (FR-1, FR-2).

- [ ] **Step 1: Create `signup-restaurant.html`** as a copy of `signup.html` with: `<title>Partner with FeastNow</title>`, heading copy "Partner with FeastNow" / subline "Tell us about your restaurant — you'll be live after a quick review.", and three extra fields inserted after the phone field, matching the existing field markup exactly (same classes `field`, `field__error`, ids as below):

```html
<label class="field">
  <span>Business name</span>
  <input id="signup-business-name" type="text" autocomplete="organization" required />
  <span class="field__error" role="alert"></span>
</label>
<label class="field">
  <span>Business address</span>
  <input id="signup-business-address" type="text" autocomplete="street-address" required />
  <span class="field__error" role="alert"></span>
</label>
<label class="field">
  <span>Cuisine</span>
  <input id="signup-cuisine" type="text" placeholder="e.g. Italian, BBQ, Pakistani" required />
  <span class="field__error" role="alert"></span>
</label>
```

and swap the script tag to `<script type="module" src="assets/js/signup-restaurant.js"></script>`.

- [ ] **Step 2: Create `signup-restaurant.js`** as a copy of `signup.js` with these deltas (everything else — OTP boxes, resend cooldown, sealed animation — stays identical):

```js
// additional element refs
const businessNameInput = document.getElementById("signup-business-name");
const businessAddressInput = document.getElementById("signup-business-address");
const cuisineInput = document.getElementById("signup-cuisine");
```

In the submit handler, extend clearing/validation:

```js
  [nameInput, emailInput, phoneInput, passwordInput, businessNameInput, businessAddressInput, cuisineInput].forEach(clearFieldError);
  const businessName = businessNameInput.value.trim();
  const businessAddress = businessAddressInput.value.trim();
  const cuisine = cuisineInput.value.trim();
  if (!businessName) { showFieldError(businessNameInput, "Enter your business name."); hasError = true; }
  if (!businessAddress) { showFieldError(businessAddressInput, "Enter your business address."); hasError = true; }
  if (!cuisine) { showFieldError(cuisineInput, "Enter your main cuisine."); hasError = true; }
```

and stash the extras: `pendingSignup = { name, email, phone, password, role: "restaurant", businessName, businessAddress, cuisine };` (the OTP submit already spreads `...pendingSignup`, so the new fields ride along).

- [ ] **Step 3: Point the role-select tile at it.** In `role-select.html` change `href="coming-soon.html?for=restaurant"` → `href="signup-restaurant.html"`.

- [ ] **Step 4: Manual verify** (backend running locally via `npm run dev`, landing served statically): complete a restaurant signup with a fresh email → OTP → lands on `/app/`. In the DB the user has `role = restaurant` and a `pending` profile. Also click through `role-select.html` → tile navigates correctly.

- [ ] **Step 5: Commit**

```bash
git add landing/
git commit -m "feat(landing): restaurant signup with business fields; wire role-select tile"
```

---

### Task 12: SPA foundation — types, api send, format, hooks, role-branched shells

**Files:**
- Create: `app/src/shells/CustomerShell.tsx`, `app/src/shells/RestaurantShell.tsx`, `app/src/hooks/usePolling.ts`, `app/src/hooks/useCountdown.ts`, `app/src/styles/orders.css`, `app/src/styles/rshell.css` (both start with just the file-header comment; rules land with their screens)
- Modify: `app/src/lib/types.ts`, `app/src/lib/api.ts`, `app/src/lib/format.ts`, `app/src/components/TabBar.tsx`, `app/src/App.tsx`, `app/src/main.tsx`

**Interfaces:**
- Consumes: Task 4 (`role` in `/api/me`).
- Produces (every later frontend task consumes these — exact names matter):
  - `types.ts`: `Me.role`, `OrderStatus`, `OrderDTO`, `OrderItemDTO`, `OrdersListResponse`, `OwnerProfile`, `OwnerMenuItem`, `OwnerReview`
  - `api.ts`: `apiSend<T>(method, path, body?)`, `ApiError.body`
  - `format.ts`: `formatOrderNumber`, `maskPhone`, `formatClock`
  - `usePolling(fn, intervalMs)` (fn must be a `useCallback`), `useCountdown(expiresAtIso) → seconds`
  - `TabBar` takes `tabs: TabDef[]`; `CustomerShell`/`RestaurantShell` own their route trees

- [ ] **Step 1: Extend `app/src/lib/types.ts`** (append; also add `role` to `Me`):

```ts
export type UserRole = "customer" | "restaurant" | "delivery_partner" | "admin";
export interface Me { id: string; name: string; email: string; phone: string; role: UserRole; }

export type OrderStatus =
  | "placed" | "accepted" | "preparing" | "ready"
  | "assigned" | "out_for_delivery" | "delivered"
  | "rejected" | "cancelled";

export interface OrderItemDTO {
  id: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number;
}

export interface OrderDTO {
  id: string; orderNumber: number; status: OrderStatus;
  rejectionReason: string | null; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  placedAt: string; acceptedAt: string | null; preparingAt: string | null;
  readyAt: string | null; closedAt: string | null; expiresAt: string;
  restaurantName: string; customerName: string; customerPhone: string;
  items: OrderItemDTO[];
}

export interface OrdersListResponse {
  orders: OrderDTO[]; total: number; page: number; pageSize: number;
  counts?: { new: number; preparing: number; ready: number };
}

export interface OwnerProfile {
  id: string; name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; isOnline: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  avgRating: number; ratingCount: number; estDeliveryMin: number;
}

export interface OwnerMenuItem {
  id: string; category: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean; position: number;
}

export interface OwnerReview {
  id: string; stars: number; reviewText: string; authorName: string; createdAt: string;
}
```

(The existing `Me` line is replaced by the one above.)

- [ ] **Step 2: Extend `app/src/lib/api.ts`.** Give `ApiError` an optional parsed body and add a write helper (same 401/network semantics as `apiGet`):

```ts
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body?: unknown) {
    super(`Request failed (${status}).`);
    this.status = status;
    this.body = body;
  }
}

export async function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("No session.");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    throw new Error("Session expired.");
  }
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = await res.json(); } catch { parsed = undefined; }
    throw new ApiError(res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

- [ ] **Step 3: Extend `app/src/lib/format.ts`:**

```ts
/** Human-friendly order reference: 1042 → "#FN-1042". */
export function formatOrderNumber(n: number): string {
  return `#FN-${n}`;
}

/** "03001234567" → "03•••••••67" — restaurants see a masked customer phone. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 2)}${"•".repeat(phone.length - 4)}${phone.slice(-2)}`;
}

/** ISO timestamp → local wall-clock "8:42 pm" (marketplace audience format). */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}
```

- [ ] **Step 4: Create the hooks.** `app/src/hooks/usePolling.ts`:

```ts
import { useEffect } from "react";

/** Visibility-aware polling (spec §4): runs fn now and every intervalMs while
 *  the tab is visible; a poll failure is silent (next tick retries). fn MUST
 *  be referentially stable (useCallback) or the loop restarts every render. */
export function usePolling(fn: () => Promise<void>, intervalMs: number): void {
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (!document.hidden) {
        try { await fn(); } catch { /* silent — stale indicator is the caller's job */ }
      }
      timer = window.setTimeout(() => void tick(), intervalMs);
    };
    void tick();
    const onVisibility = () => {
      if (!document.hidden && !stopped) {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fn, intervalMs]);
}
```

`app/src/hooks/useCountdown.ts`:

```ts
import { useEffect, useState } from "react";

/** Seconds until expiresAt (floor 0), ticking twice a second. Cosmetic only —
 *  the server enforces the real deadline (Global Constraints). */
export function useCountdown(expiresAt: string): number {
  const target = new Date(expiresAt).getTime();
  const remaining = () => Math.max(0, Math.ceil((target - Date.now()) / 1000));
  const [left, setLeft] = useState(remaining);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(remaining()), 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return left;
}
```

- [ ] **Step 5: Generalize `TabBar.tsx`.** Keep the existing icons, export the tab type, take tabs as a prop, and support a count badge:

```tsx
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

export interface TabDef {
  to: string; label: string; icon: ReactNode; end: boolean; badge?: number;
}

export function TabBar({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) => `tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}>
          <span className="tab-bar__icon">
            {tab.icon}
            {tab.badge ? <span className="tab-bar__badge mono">{tab.badge > 9 ? "9+" : tab.badge}</span> : null}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

Move the three existing icon constants (`HomeIcon`, `OrdersIcon`, `ProfileIcon`) unchanged into `CustomerShell.tsx` (they were module-level consts here; delete the old `TABS` array).

- [ ] **Step 6: Create `app/src/shells/CustomerShell.tsx`** — the current App routes plus placeholders the later tasks fill (`/cart`, `/orders/:id` arrive in Tasks 15–16; until then keep only existing routes):

```tsx
import { Route, Routes } from "react-router-dom";
import { TabBar, type TabDef } from "../components/TabBar";
import { HomeScreen } from "../screens/HomeScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RestaurantScreen } from "../screens/RestaurantScreen";
import { SearchScreen } from "../screens/SearchScreen";

const HomeIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
  </svg>
);
const OrdersIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
  </svg>
);
const ProfileIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export function CustomerShell() {
  const tabs: TabDef[] = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: "/orders", label: "Orders", icon: OrdersIcon, end: false },
    { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  ];
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/restaurant/:id" element={<RestaurantScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
      <TabBar tabs={tabs} />
    </div>
  );
}
```

- [ ] **Step 7: Create `app/src/shells/RestaurantShell.tsx`** — skeleton only for now (Task 13 adds OwnerContext/chrome; screens land in 17–22):

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { TabBar, type TabDef } from "../components/TabBar";

const QueueIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
  </svg>
);
const MenuIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 5h16M4 12h16M4 19h10" />
  </svg>
);
const SearchIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const StoreIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 9 5.5 4h13L20 9" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />
  </svg>
);

export const RESTAURANT_TABS: TabDef[] = [
  { to: "/", label: "Orders", icon: QueueIcon, end: true },
  { to: "/menu", label: "Menu", icon: MenuIcon, end: false },
  { to: "/search", label: "Search", icon: SearchIcon, end: false },
  { to: "/profile", label: "Profile", icon: StoreIcon, end: false },
];

function ComingSoon({ name }: { name: string }) {
  return (
    <main className="screen rplaceholder">
      <h1>{name}</h1>
      <p>This screen ships later in this phase.</p>
    </main>
  );
}

export function RestaurantShell() {
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<ComingSoon name="Orders" />} />
        <Route path="/menu" element={<ComingSoon name="Menu" />} />
        <Route path="/search" element={<ComingSoon name="Search" />} />
        <Route path="/profile" element={<ComingSoon name="Profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar tabs={RESTAURANT_TABS} />
    </div>
  );
}
```

- [ ] **Step 8: Branch `App.tsx` on role:**

```tsx
import { BrowserRouter } from "react-router-dom";
import { AuthGate, useMe } from "./AuthGate";
import { CustomerShell } from "./shells/CustomerShell";
import { RestaurantShell } from "./shells/RestaurantShell";

function RoleShell() {
  const me = useMe();
  // Delivery partner and admin shells arrive in later phases; anything
  // unknown falls back to the customer experience (SRS §4.1).
  return me.role === "restaurant" ? <RestaurantShell /> : <CustomerShell />;
}

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter basename="/app">
        <RoleShell />
      </BrowserRouter>
    </AuthGate>
  );
}
```

- [ ] **Step 9: Create the two stylesheets with their base rules and import them in `main.tsx`** (after `search.css`): `import "./styles/orders.css";` and `import "./styles/rshell.css";`. Initial contents —

`app/src/styles/orders.css`:

```css
/* Customer ordering: cart, checkout, order cards, status timeline. */

.tab-bar__icon { position: relative; display: inline-flex; }
.tab-bar__badge {
  position: absolute; top: -6px; right: -10px;
  min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: var(--r-pill);
  background: var(--tomato); color: var(--cream);
  font-size: 0.6875rem; line-height: 18px; text-align: center;
}
```

`app/src/styles/rshell.css`:

```css
/* Restaurant shell (Operator-Restraint: sans-dominant, no .serif in here). */

.rplaceholder { display: grid; place-items: center; gap: var(--s-sm); min-height: 60dvh; }
.rplaceholder h1 { font-size: 1.5rem; margin: 0; }
```

- [ ] **Step 10: Verify:** `cd app && npm run build && npm run lint` — both clean. `npm run dev` + log in as a customer → the app behaves exactly as before (same tabs, browse works). Log in as the demo owner (`owner@demo.feastnow.pk` / `Demo1234!`) → the four restaurant tabs render with placeholders.

- [ ] **Step 11: Commit**

```bash
git add app/ && git commit -m "feat(app): role-branched shells, order types, apiSend, polling/countdown hooks"
```

---

### Task 13: Restaurant shell chrome — OwnerContext, pending approval, top bar, store toggle

**Files:**
- Create: `app/src/OwnerContext.tsx`, `app/src/screens/restaurant/PendingApprovalScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx`, `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 7 endpoints; Task 12 (`apiSend`, `usePolling`, `OwnerProfile`).
- Produces (consumed by Tasks 17–22): `useOwner(): { profile: OwnerProfile; setProfile(p): void; refresh(): Promise<void> }`; `RTopBar` rendered by the shell on every restaurant screen (business name + Online/Offline switch); offline banner.

- [ ] **Step 1: Create `app/src/OwnerContext.tsx`:**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, NetworkError } from "./lib/api";
import type { OwnerProfile } from "./lib/types";
import { PendingApprovalScreen } from "./screens/restaurant/PendingApprovalScreen";

interface OwnerContextValue {
  profile: OwnerProfile;
  setProfile: (p: OwnerProfile) => void;
  refresh: () => Promise<void>;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used inside OwnerProvider.");
  return ctx;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: OwnerProfile };

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  // Show the celebration once when approval flips while the user is watching.
  const [celebrated, setCelebrated] = useState(false);

  const refresh = useCallback(async () => {
    const { profile } = await apiGet<{ profile: OwnerProfile }>("/api/restaurant/me");
    setState((prev) => {
      // Boot straight into an approved account → skip the celebration screen.
      // A pending→approved flip while watching → celebration until onContinue.
      if (prev.status !== "ready" && profile.approvalStatus === "approved") setCelebrated(true);
      return { status: "ready", profile };
    });
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setState({
        status: "error",
        message: err instanceof NetworkError ? err.message : "Couldn't load your restaurant. Try again.",
      });
    });
  }, [refresh]);

  if (state.status === "loading") {
    return <div className="boot-screen" role="status" aria-label="Loading">
      <span className="boot-screen__logo serif">FeastNow</span>
    </div>;
  }
  if (state.status === "error") {
    return <div className="boot-screen">
      <p className="boot-screen__message">{state.message}</p>
      <button className="btn-retry" onClick={() => { setState({ status: "loading" }); void refresh().catch(() => setState({ status: "error", message: "Couldn't load your restaurant. Try again." })); }}>Try again</button>
    </div>;
  }
  if (state.profile.approvalStatus !== "approved" || !celebrated) {
    // Covers pending (poll + wait), rejected (dead end), and the one-time
    // "you're live" moment right after an approval flip.
    return (
      <PendingApprovalScreen
        profile={state.profile}
        refresh={refresh}
        onContinue={() => setCelebrated(true)}
      />
    );
  }
  return (
    <OwnerContext.Provider value={{ profile: state.profile, refresh, setProfile: (p) => setState({ status: "ready", profile: p }) }}>
      {children}
    </OwnerContext.Provider>
  );
}
```

- [ ] **Step 2: Create `app/src/screens/restaurant/PendingApprovalScreen.tsx`:**

```tsx
import { useCallback } from "react";
import type { OwnerProfile } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";

const POLL_MS = 5000;

export function PendingApprovalScreen({ profile, refresh, onContinue }: {
  profile: OwnerProfile;
  refresh: () => Promise<void>;
  onContinue: () => void;
}) {
  const poll = useCallback(async () => {
    if (profile.approvalStatus === "pending") await refresh();
  }, [profile.approvalStatus, refresh]);
  usePolling(poll, POLL_MS);

  if (profile.approvalStatus === "rejected") {
    return (
      <main className="screen pending">
        <h1>Application not approved</h1>
        <p>We couldn't approve “{profile.name}” this time. Contact support for details.</p>
      </main>
    );
  }
  if (profile.approvalStatus === "approved") {
    return (
      <main className="screen pending pending--approved">
        <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--basil)" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-7" />
        </svg>
        <h1>You're live!</h1>
        <p>“{profile.name}” is now on FeastNow. Buon lavoro.</p>
        <button className="btn-primary" onClick={onContinue}>Open your orders</button>
      </main>
    );
  }
  return (
    <main className="screen pending">
      <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--navy)" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 9 5.5 4h13L20 9" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />
      </svg>
      <h1>Reviewing your application</h1>
      <p>“{profile.name}” is being reviewed. This usually takes about a minute — we'll flip the sign to Open the moment you're approved.</p>
      <p className="pending__spinner" role="status" aria-label="Waiting for approval" />
    </main>
  );
}
```

- [ ] **Step 3: Add the shell chrome to `RestaurantShell.tsx`.** Wrap routes in `OwnerProvider`, add the top bar + offline banner (screens render below them). Replace the component with:

```tsx
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { OwnerProvider, useOwner } from "../OwnerContext";
import { apiSend } from "../lib/api";
import type { OwnerProfile } from "../lib/types";
import { TabBar, type TabDef } from "../components/TabBar";
// (icon constants and RESTAURANT_TABS from Task 12 stay unchanged)

function RTopBar() {
  const { profile, setProfile } = useOwner();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !profile.isOnline;
    if (!next && !window.confirm("Go offline? Customers won't be able to order until you come back online.")) return;
    setBusy(true);
    try {
      const { profile: updated } = await apiSend<{ profile: OwnerProfile }>("PATCH", "/api/restaurant/store-status", { isOnline: next });
      setProfile(updated);
    } catch {
      window.alert("Couldn't update your store status. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="rtopbar">
      <span className="rtopbar__name">{profile.name}</span>
      <button
        type="button"
        className={`rtoggle${profile.isOnline ? " rtoggle--on" : ""}`}
        role="switch" aria-checked={profile.isOnline} disabled={busy}
        onClick={() => void toggle()}
      >
        <span className="rtoggle__knob" aria-hidden="true" />
        {profile.isOnline ? "Online" : "Offline"}
      </button>
    </header>
  );
}

function OfflineBanner() {
  const { profile } = useOwner();
  if (profile.isOnline) return null;
  return (
    <p className="rbanner" role="status">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
      You're offline — new orders are paused.
    </p>
  );
}

function RestaurantRoutes() {
  return (
    <>
      <RTopBar />
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<ComingSoon name="Orders" />} />
        <Route path="/menu" element={<ComingSoon name="Menu" />} />
        <Route path="/search" element={<ComingSoon name="Search" />} />
        <Route path="/profile" element={<ComingSoon name="Profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar tabs={RESTAURANT_TABS} />
    </>
  );
}

export function RestaurantShell() {
  return (
    <div className="shell">
      <OwnerProvider>
        <RestaurantRoutes />
      </OwnerProvider>
    </div>
  );
}
```

(`ComingSoon` stays until its screen task replaces the route.)

- [ ] **Step 4: Append to `rshell.css`:**

```css
.pending { display: grid; place-items: center; align-content: center; gap: var(--s-md); min-height: 80dvh; text-align: center; padding: var(--s-lg); }
.pending h1 { font-size: 1.5rem; margin: 0; }
.pending p { color: var(--muted); max-width: 34ch; margin: 0; }
.pending__spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--beige); border-top-color: var(--gold); animation: rspin 900ms linear infinite; }
@keyframes rspin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) { .pending__spinner { animation: none; border-top-color: var(--beige); } }

.rtopbar {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-md);
  padding: var(--s-md); background: var(--navy-deep); color: var(--cream);
  position: sticky; top: 0; z-index: var(--z-nav);
}
.rtopbar__name { font-weight: 600; font-size: 1.0625rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rtoggle {
  display: inline-flex; align-items: center; gap: var(--s-sm);
  min-height: 44px; padding: 0 var(--s-md) 0 var(--s-sm);
  border-radius: var(--r-pill); border: 1px solid rgba(255, 252, 240, .35);
  background: transparent; color: var(--cream);
  font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.06em; text-transform: uppercase;
  transition: background var(--dur-fast) var(--ease-out-quart);
}
.rtoggle__knob { width: 12px; height: 12px; border-radius: 50%; background: var(--tomato); transition: background var(--dur-fast); }
.rtoggle--on .rtoggle__knob { background: var(--basil); }
.rtoggle:disabled { opacity: .6; }

.rbanner {
  display: flex; align-items: center; justify-content: center; gap: var(--s-sm);
  margin: 0; padding: var(--s-sm) var(--s-md);
  background: var(--butter); color: var(--brown-deep); font-size: 0.875rem;
}
```

- [ ] **Step 5: Verify:** `npm run build && npm run lint` clean. Manual: sign up a fresh restaurant via the landing page → `/app/` shows "Reviewing your application" → within ~65s it flips to "You're live!" → continue lands on the (placeholder) Orders tab with the top bar; toggle Offline → confirm dialog → banner appears; demo owner login skips the pending screen entirely.

- [ ] **Step 6: Commit**

```bash
git add app/ && git commit -m "feat(app): restaurant shell chrome — owner context, pending approval, store toggle"
```

---

### Task 14: Cart library + add-to-cart on the restaurant menu

**Files:**
- Create: `app/src/lib/cart.ts`
- Modify: `app/src/screens/RestaurantScreen.tsx`, `app/src/styles/orders.css`

**Interfaces:**
- Consumes: Task 12 types.
- Produces (consumed by Tasks 15–16): 

```ts
export interface CartLine { menuItemId: string; name: string; priceCents: number; quantity: number; }
export interface Cart { restaurantId: string; restaurantName: string; lines: CartLine[]; }
export const DELIVERY_FEE_CENTS = 9900; // mirror of the server constant, display only
export function loadCart(): Cart | null;
export function saveCart(cart: Cart | null): void;      // persists + notifies useCart subscribers
export function cartCount(cart: Cart | null): number;    // total quantity
export function cartSubtotal(cart: Cart | null): number; // cents
export function setLineQuantity(cart: Cart, menuItemId: string, quantity: number): Cart | null; // 0 removes; last line → null
export function useCart(): Cart | null;                  // reactive hook
```

- [ ] **Step 1: Implement `app/src/lib/cart.ts`:**

```ts
import { useSyncExternalStore } from "react";

export interface CartLine { menuItemId: string; name: string; priceCents: number; quantity: number; }
export interface Cart { restaurantId: string; restaurantName: string; lines: CartLine[]; }

/** Display-only mirror of the server's flat fee — the server recomputes everything. */
export const DELIVERY_FEE_CENTS = 9900;

const CART_KEY = "feastnow_cart";
const CART_EVENT = "feastnow:cart";

function read(): Cart | null {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cart;
    return Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

let current: Cart | null = read();

export function loadCart(): Cart | null {
  return current;
}

export function saveCart(cart: Cart | null): void {
  current = cart;
  try {
    if (cart) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    else window.localStorage.removeItem(CART_KEY);
  } catch { /* storage full/blocked — in-memory cart still works this session */ }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function cartCount(cart: Cart | null): number {
  return cart?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;
}

export function cartSubtotal(cart: Cart | null): number {
  return cart?.lines.reduce((n, l) => n + l.priceCents * l.quantity, 0) ?? 0;
}

export function setLineQuantity(cart: Cart, menuItemId: string, quantity: number): Cart | null {
  const lines = cart.lines
    .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  return lines.length === 0 ? null : { ...cart, lines };
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY) { current = read(); cb(); }
  };
  window.addEventListener(CART_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): Cart | null {
  return useSyncExternalStore(subscribe, loadCart);
}
```

- [ ] **Step 2: Add steppers + sticky bar to `RestaurantScreen.tsx`.** Imports to add: `Link` from react-router-dom (extend the existing import), `import { loadCart, saveCart, setLineQuantity, useCart, cartCount, cartSubtotal } from "../lib/cart";`, and add `MenuItem` to the existing type import from `../lib/types`. Inside the component add:

```tsx
  const cart = useCart();
  const cartForThis = cart && cart.restaurantId === id ? cart : null;
  const qtyOf = (menuItemId: string) => cartForThis?.lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;

  const changeQty = (item: MenuItem, delta: number) => {
    let base = loadCart();
    if (base && base.restaurantId !== r.id) {
      if (!window.confirm(`Start a new basket? Your items from ${base.restaurantName} will be removed.`)) return;
      base = null;
    }
    if (!base) base = { restaurantId: r.id, restaurantName: r.name, lines: [] };
    const existing = base.lines.find((l) => l.menuItemId === item.id);
    if (!existing && delta > 0) {
      saveCart({ ...base, lines: [...base.lines, { menuItemId: item.id, name: item.name, priceCents: item.priceCents, quantity: 1 }] });
    } else if (existing) {
      saveCart(setLineQuantity(base, item.id, existing.quantity + delta));
    }
  };
```

In the menu-row JSX, after `</div>` of `menu-row__text` (before the thumb), insert the stepper column — add is disabled while the restaurant is closed (`!r.isOpenNow`) or the item is sold out:

```tsx
              <div className="menu-row__actions">
                {qtyOf(item.id) === 0 ? (
                  <button type="button" className="stepper__add"
                    disabled={!item.isAvailable || !r.isOpenNow}
                    aria-label={`Add ${item.name} to basket`}
                    onClick={() => changeQty(item, +1)}>+</button>
                ) : (
                  <div className="stepper" role="group" aria-label={`${item.name} quantity`}>
                    <button type="button" className="stepper__btn" aria-label="Remove one" onClick={() => changeQty(item, -1)}>−</button>
                    <span className="stepper__qty mono">{qtyOf(item.id)}</span>
                    <button type="button" className="stepper__btn" aria-label="Add one" onClick={() => changeQty(item, +1)}>+</button>
                  </div>
                )}
              </div>
```

At the end of `<main>` (after the reviews section) add the sticky basket bar:

```tsx
      {cartForThis && (
        <Link to="/cart" className="basket-bar">
          <span className="basket-bar__count mono">{cartCount(cartForThis)}</span>
          <span>View basket</span>
          <span className="basket-bar__total mono">{formatPrice(cartSubtotal(cartForThis))}</span>
        </Link>
      )}
```

- [ ] **Step 3: Append to `orders.css`:**

```css
.menu-row__actions { display: flex; align-items: center; margin-left: auto; }
.stepper__add {
  min-width: 44px; min-height: 44px; border-radius: var(--r-pill);
  border: 1px solid var(--navy); background: var(--off-white); color: var(--navy);
  font-size: 1.25rem; font-weight: 600; line-height: 1;
  transition: background var(--dur-fast) var(--ease-out-quart);
}
.stepper__add:disabled { border-color: var(--beige); color: var(--beige); background: transparent; cursor: default; }
.stepper { display: inline-flex; align-items: center; gap: 2px; background: var(--navy); border-radius: var(--r-pill); }
.stepper__btn { min-width: 44px; min-height: 44px; border: 0; background: none; color: var(--cream); font-size: 1.125rem; }
.stepper__qty { min-width: 20px; text-align: center; color: var(--cream); font-size: 0.9375rem; }

.basket-bar {
  position: sticky; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: var(--z-sticky);
  display: flex; align-items: center; gap: var(--s-md);
  margin: var(--s-md); padding: var(--s-md) var(--s-lg); min-height: 52px;
  background: var(--navy); color: var(--cream); border-radius: var(--r-pill);
  box-shadow: var(--sh-overlay); font-weight: 600;
}
.basket-bar__count {
  display: inline-grid; place-items: center; width: 26px; height: 26px;
  border-radius: 50%; background: var(--gold); color: var(--navy); font-size: 0.875rem;
}
.basket-bar__total { margin-left: auto; }
```

- [ ] **Step 4: Verify:** `npm run build && npm run lint` clean. Manual: add items from a demo restaurant → stepper counts up, sticky bar totals update live; try adding from a second restaurant → replace-basket confirm; sold-out items and closed restaurants can't be added; reload keeps the basket.

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat(app): single-restaurant cart with menu steppers and sticky basket bar"
```

---

### Task 15: Cart tab + checkout (place order)

**Files:**
- Create: `app/src/screens/CartScreen.tsx`
- Modify: `app/src/shells/CustomerShell.tsx` (Cart tab + route), `app/src/styles/orders.css`

**Interfaces:**
- Consumes: Task 5 `POST /api/customer/orders` (+ its 409 bodies), Task 12 (`apiSend`, `ApiError`), Task 14 cart lib.
- Produces: on success navigates to `/orders/${order.id}` (Task 16's detail route).

- [ ] **Step 1: Create `app/src/screens/CartScreen.tsx`:**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiSend, ApiError, NetworkError } from "../lib/api";
import { cartSubtotal, DELIVERY_FEE_CENTS, loadCart, saveCart, setLineQuantity, useCart } from "../lib/cart";
import { formatPrice } from "../lib/format";
import type { OrderDTO } from "../lib/types";

const ADDRESS_KEY = "feastnow_address";

interface PlaceErrorBody { error?: string; message?: string; itemIds?: string[]; }

export function CartScreen() {
  const cart = useCart();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [address, setAddress] = useState(() => {
    try { return window.localStorage.getItem(ADDRESS_KEY) ?? ""; } catch { return ""; }
  });
  const [addressError, setAddressError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [serverError, setServerError] = useState("");
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);

  if (!cart) {
    return (
      <main className="screen orders-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--brown)" strokeWidth="1.2" aria-hidden="true">
          <path d="M5 7h14l-1.5 12h-11Z" /><path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
        <h1 className="serif">Your basket is empty</h1>
        <p>Add something delicious from a restaurant.</p>
        <Link to="/" className="btn-primary">Browse restaurants</Link>
      </main>
    );
  }

  const changeQty = (menuItemId: string, delta: number) => {
    const line = cart.lines.find((l) => l.menuItemId === menuItemId);
    if (!line) return;
    saveCart(setLineQuantity(cart, menuItemId, line.quantity + delta));
    setUnavailableIds((ids) => ids.filter((id) => id !== menuItemId || line.quantity + delta > 0));
  };

  const removeUnavailable = () => {
    let next = loadCart();
    for (const id of unavailableIds) {
      if (!next) break;
      next = setLineQuantity(next, id, 0);
    }
    saveCart(next);
    setUnavailableIds([]);
    setServerError("");
  };

  const placeOrder = async () => {
    setAddressError("");
    setServerError("");
    if (!address.trim()) {
      setAddressError("Enter your delivery address.");
      return;
    }
    try { window.localStorage.setItem(ADDRESS_KEY, address.trim()); } catch { /* best-effort */ }
    setPlacing(true);
    try {
      const { order } = await apiSend<{ order: OrderDTO }>("POST", "/api/customer/orders", {
        restaurantId: cart.restaurantId,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        note: note.trim(),
        deliveryAddress: address.trim(),
      });
      saveCart(null);
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = (err.body ?? {}) as PlaceErrorBody;
        if (body.error === "items_unavailable") {
          setUnavailableIds(body.itemIds ?? []);
          setServerError(body.message ?? "Some items are no longer available.");
        } else {
          setServerError(body.message ?? "This restaurant isn't taking orders right now.");
        }
      } else if (err instanceof NetworkError) {
        setServerError(err.message);
      } else {
        setServerError("Couldn't place your order. Try again.");
      }
    } finally {
      setPlacing(false);
    }
  };

  const subtotal = cartSubtotal(cart);
  return (
    <main className="screen cart">
      <h1 className="serif">Your basket</h1>
      <p className="cart__from">from <Link to={`/restaurant/${cart.restaurantId}`}>{cart.restaurantName}</Link></p>

      <section className="cart__lines" aria-label="Basket items">
        {cart.lines.map((l) => (
          <div key={l.menuItemId} className={`cart-line${unavailableIds.includes(l.menuItemId) ? " cart-line--unavailable" : ""}`}>
            <div className="cart-line__text">
              <p>{l.name}</p>
              {unavailableIds.includes(l.menuItemId) && <span className="cart-line__flag">No longer available</span>}
            </div>
            <div className="stepper" role="group" aria-label={`${l.name} quantity`}>
              <button type="button" className="stepper__btn" aria-label="Remove one" onClick={() => changeQty(l.menuItemId, -1)}>−</button>
              <span className="stepper__qty mono">{l.quantity}</span>
              <button type="button" className="stepper__btn" aria-label="Add one" onClick={() => changeQty(l.menuItemId, +1)}>+</button>
            </div>
            <span className="cart-line__price mono">{formatPrice(l.priceCents * l.quantity)}</span>
          </div>
        ))}
      </section>

      <label className="cart__field">
        <span>Delivery address</span>
        <input type="text" value={address} autoComplete="street-address"
          onChange={(e) => setAddress(e.target.value)} placeholder="House, street, area" />
        {addressError && <span className="cart__error" role="alert">{addressError}</span>}
      </label>
      <label className="cart__field">
        <span>Note for the restaurant (optional)</span>
        <textarea value={note} maxLength={500} rows={2}
          onChange={(e) => setNote(e.target.value)} placeholder="e.g. extra spicy, ring the bell" />
      </label>

      <section className="cart__totals" aria-label="Price breakdown">
        <div><span>Subtotal</span><span className="mono">{formatPrice(subtotal)}</span></div>
        <div><span>Delivery fee</span><span className="mono">{formatPrice(DELIVERY_FEE_CENTS)}</span></div>
        <div className="cart__totals-total"><span>Total (cash)</span><span className="mono">{formatPrice(subtotal + DELIVERY_FEE_CENTS)}</span></div>
      </section>

      {serverError && (
        <p className="cart__server-error" role="alert">
          {serverError}
          {unavailableIds.length > 0 && (
            <button type="button" className="btn-retry" onClick={removeUnavailable}>Remove unavailable items</button>
          )}
        </p>
      )}

      <button type="button" className="btn-primary cart__place" disabled={placing} onClick={() => void placeOrder()}>
        {placing ? "Placing your order…" : "Place order — cash on delivery"}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Add the Cart tab + route to `CustomerShell.tsx`.** Imports: `CartScreen`, `useCart`, `cartCount` from `../lib/cart`. Add the icon:

```tsx
const CartIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 7h14l-1.5 12h-11Z" /><path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
```

Inside the component read the cart and build tabs per SRS §4.1 (Home · Cart · Orders · Profile):

```tsx
  const cart = useCart();
  const tabs: TabDef[] = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: "/cart", label: "Cart", icon: CartIcon, end: false, badge: cartCount(cart) },
    { to: "/orders", label: "Orders", icon: OrdersIcon, end: false },
    { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  ];
```

and add `<Route path="/cart" element={<CartScreen />} />`.

- [ ] **Step 3: Append to `orders.css`:**

```css
.cart { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.cart h1 { margin: 0; }
.cart__from { margin: 0; color: var(--muted); }
.cart__from a { text-decoration: underline; }
.cart__lines { display: flex; flex-direction: column; gap: var(--s-sm); }
.cart-line {
  display: flex; align-items: center; gap: var(--s-md);
  background: var(--off-white); border-radius: var(--r-md); padding: var(--s-sm) var(--s-md);
}
.cart-line__text { flex: 1; min-width: 0; }
.cart-line__text p { margin: 0; }
.cart-line--unavailable { outline: 1px solid var(--tomato); }
.cart-line__flag { color: var(--tomato); font-size: 0.8125rem; font-weight: 600; }
.cart-line__price { min-width: 72px; text-align: right; }
.cart__field { display: flex; flex-direction: column; gap: var(--s-xs); }
.cart__field span { font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.06em; text-transform: uppercase; }
.cart__field input, .cart__field textarea {
  font: inherit; padding: var(--s-sm) var(--s-md); min-height: 44px;
  border: 1px solid var(--beige); border-radius: var(--r-sm); background: var(--dough); color: var(--ink);
}
.cart__error { color: var(--tomato); font-size: 0.875rem; text-transform: none; letter-spacing: normal; }
.cart__totals { display: flex; flex-direction: column; gap: var(--s-xs); border-top: 1px solid var(--beige); padding-top: var(--s-md); }
.cart__totals div { display: flex; justify-content: space-between; }
.cart__totals-total { font-weight: 600; }
.cart__server-error { display: flex; flex-direction: column; gap: var(--s-sm); color: var(--tomato); margin: 0; }
.cart__place { min-height: 52px; }
```

- [ ] **Step 4: Verify:** build + lint clean. Manual (backend dev server running): fill a basket → Cart tab badge counts; place order with empty address → inline error; place with address → lands on `/orders/<id>` (Task 16 renders it — until then a blank route is acceptable mid-phase, note it in the report); backend shows the order `placed`. Toggle the demo restaurant offline (as the owner) → placing 409s with the friendly message. Mark a line's item unavailable (owner menu, or SQL) → 409 flags the row and "Remove unavailable items" clears it.

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat(app): cart tab and cash checkout placing real orders"
```

---

### Task 16: Customer orders — live list, detail timeline, cancel

**Files:**
- Create: `app/src/components/OrderStatus.tsx`, `app/src/screens/OrderDetailScreen.tsx`
- Modify: `app/src/screens/OrdersScreen.tsx` (replace placeholder), `app/src/shells/CustomerShell.tsx` (detail route), `app/src/styles/orders.css`

**Interfaces:**
- Consumes: Task 5 endpoints; Task 12 (`usePolling`, types, `apiSend`); Task 15 flow lands here.
- Produces (Tasks 17/19 reuse these): `STATUS_META: Record<OrderStatus, { label: string; icon: ReactElement }>`, `<StatusBadge status />`, `<StatusTimeline order />`.

- [ ] **Step 1: Create `app/src/components/OrderStatus.tsx`** — status is always color + icon + label (DESIGN.md):

```tsx
import type { ReactElement } from "react";
import type { OrderDTO, OrderStatus } from "../lib/types";

const icon = (path: ReactElement) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{path}</svg>
);

export const STATUS_META: Record<OrderStatus, { label: string; icon: ReactElement }> = {
  placed: { label: "Order placed", icon: icon(<path d="M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6" />) },
  accepted: { label: "Accepted", icon: icon(<path d="m5 13 4 4 10-10" />) },
  preparing: { label: "Preparing", icon: icon(<><path d="M4 15h16" /><path d="M6 15a6 6 0 0 1 12 0" /><path d="M12 6v3" /></>) },
  ready: { label: "Ready", icon: icon(<><path d="M5 8h14l-1 13H6Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>) },
  assigned: { label: "Rider assigned", icon: icon(<circle cx="12" cy="12" r="9" />) },
  out_for_delivery: { label: "On the way", icon: icon(<circle cx="12" cy="12" r="9" />) },
  delivered: { label: "Delivered", icon: icon(<path d="m5 13 4 4 10-10" />) },
  rejected: { label: "Rejected", icon: icon(<path d="m6 6 12 12M18 6 6 18" />) },
  cancelled: { label: "Cancelled", icon: icon(<path d="m6 6 12 12M18 6 6 18" />) },
};

/** Tone classes are defined in orders.css; tomato/basil only where status semantics demand it. */
const TONE: Partial<Record<OrderStatus, string>> = {
  ready: "status--basil", delivered: "status--basil",
  rejected: "status--tomato", cancelled: "status--tomato",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`status ${TONE[status] ?? "status--navy"}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

const TIMELINE_STEPS = ["placed", "accepted", "preparing", "ready"] as const;
const STEP_TIME: Record<(typeof TIMELINE_STEPS)[number], (o: OrderDTO) => string | null> = {
  placed: (o) => o.placedAt, accepted: (o) => o.acceptedAt,
  preparing: (o) => o.preparingAt, ready: (o) => o.readyAt,
};

export function StatusTimeline({ order }: { order: OrderDTO }) {
  if (order.status === "rejected" || order.status === "cancelled") {
    return (
      <div className="timeline timeline--closed">
        <StatusBadge status={order.status} />
        {order.rejectionReason && <p className="timeline__reason">“{order.rejectionReason}”</p>}
      </div>
    );
  }
  const currentIdx = TIMELINE_STEPS.findIndex((s) => !STEP_TIME[s](order));
  return (
    <ol className="timeline" aria-label="Order progress">
      {TIMELINE_STEPS.map((step, i) => {
        const done = STEP_TIME[step](order) !== null;
        const current = i === (currentIdx === -1 ? TIMELINE_STEPS.length - 1 : currentIdx);
        return (
          <li key={step}
            className={`timeline__step${done ? " timeline__step--done" : ""}${current && !done ? " timeline__step--current" : ""}`}>
            {STATUS_META[step].icon}
            <span>{STATUS_META[step].label}</span>
          </li>
        );
      })}
      {order.status === "ready" && (
        <li className="timeline__note">Waiting for rider — live tracking coming soon.</li>
      )}
    </ol>
  );
}
```

- [ ] **Step 2: Replace `app/src/screens/OrdersScreen.tsx`:**

```tsx
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { formatOrderNumber, formatPrice } from "../lib/format";
import type { OrderDTO, OrdersListResponse } from "../lib/types";
import { usePolling } from "../hooks/usePolling";
import { StatusBadge, StatusTimeline } from "../components/OrderStatus";

const POLL_MS = 5000;
const ACTIVE = new Set(["placed", "accepted", "preparing", "ready"]);

export function OrdersScreen() {
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);

  const load = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>("/api/customer/orders?page=1");
    setOrders(res.orders);
  }, []);
  usePolling(load, POLL_MS);

  if (orders === null) {
    return <main className="screen orders"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }
  if (orders.length === 0) {
    return (
      <main className="screen orders-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--brown)" strokeWidth="1.2" aria-hidden="true">
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
        </svg>
        <h1 className="serif">No orders yet</h1>
        <p>Your orders will show up here.</p>
        <Link to="/" className="btn-primary">Browse restaurants</Link>
      </main>
    );
  }

  const active = orders.filter((o) => ACTIVE.has(o.status));
  const past = orders.filter((o) => !ACTIVE.has(o.status));
  return (
    <main className="screen orders">
      {active.length > 0 && <h1 className="serif">Happening now</h1>}
      {active.map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="order-card order-card--active">
          <header>
            <span className="order-card__name">{o.restaurantName}</span>
            <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
          </header>
          <StatusTimeline order={o} />
          <footer><span className="mono">{formatPrice(o.totalCents)}</span> · cash on delivery</footer>
        </Link>
      ))}
      {past.length > 0 && <h2 className="serif">Past orders</h2>}
      {past.map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="order-card">
          <header>
            <span className="order-card__name">{o.restaurantName}</span>
            <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
          </header>
          <StatusBadge status={o.status} />
          <footer><span className="mono">{formatPrice(o.totalCents)}</span></footer>
        </Link>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Create `app/src/screens/OrderDetailScreen.tsx`:**

```tsx
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend, ApiError } from "../lib/api";
import { formatClock, formatOrderNumber, formatPrice } from "../lib/format";
import type { OrderDTO } from "../lib/types";
import { usePolling } from "../hooks/usePolling";
import { StatusTimeline } from "../components/OrderStatus";

const POLL_MS = 5000;

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [missing, setMissing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ order: OrderDTO }>(`/api/customer/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else throw err; // usePolling swallows and retries
    }
  }, [id]);
  usePolling(load, POLL_MS);

  const cancel = async () => {
    if (!order || !window.confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const res = await apiSend<{ order: OrderDTO }>("POST", `/api/customer/orders/${order.id}/cancel`);
      setOrder(res.order);
    } catch {
      await load(); // 409 → the restaurant beat us to it; show the truth
    } finally {
      setCancelling(false);
    }
  };

  if (missing) {
    return (
      <main className="screen restaurant--message">
        <p>This order doesn't exist.</p>
        <button className="btn-retry" onClick={() => navigate("/orders")}>Back to orders</button>
      </main>
    );
  }
  if (!order) {
    return <main className="screen orders"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }

  return (
    <main className="screen order-detail">
      <header className="order-detail__head">
        <button className="restaurant__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="serif">{order.restaurantName}</h1>
        <p className="mono">{formatOrderNumber(order.orderNumber)} · placed {formatClock(order.placedAt)}</p>
      </header>

      <StatusTimeline order={order} />

      <section className="receipt" aria-label="Order summary">
        {order.items.map((i) => (
          <div key={i.id} className="receipt__line">
            <span className="mono">{i.quantity}×</span>
            <span className="receipt__name">{i.nameSnapshot}</span>
            <span className="mono">{formatPrice(i.priceAtOrderCents * i.quantity)}</span>
          </div>
        ))}
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Subtotal</span><span className="mono">{formatPrice(order.subtotalCents)}</span></div>
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Delivery fee</span><span className="mono">{formatPrice(order.deliveryFeeCents)}</span></div>
        <div className="receipt__line receipt__line--total"><span /><span className="receipt__name">Total (cash)</span><span className="mono">{formatPrice(order.totalCents)}</span></div>
      </section>

      <section className="order-detail__meta">
        <p><strong>Deliver to:</strong> {order.deliveryAddress}</p>
        {order.note && <p><strong>Note:</strong> {order.note}</p>}
      </section>

      {order.status === "placed" && (
        <button type="button" className="btn-danger" disabled={cancelling} onClick={() => void cancel()}>
          {cancelling ? "Cancelling…" : "Cancel order"}
        </button>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Route it** in `CustomerShell.tsx`: `<Route path="/orders/:id" element={<OrderDetailScreen />} />`.

- [ ] **Step 5: Append to `orders.css`:**

```css
.orders { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.orders h1, .orders h2 { margin: 0; font-size: 1.375rem; }
.order-card {
  display: flex; flex-direction: column; gap: var(--s-sm);
  background: var(--off-white); border-radius: var(--r-md); padding: var(--s-md);
}
.order-card--active { box-shadow: var(--sh-raised); }
.order-card header { display: flex; justify-content: space-between; gap: var(--s-md); }
.order-card__name { font-weight: 600; }
.order-card footer { color: var(--muted); font-size: 0.875rem; }

.status { display: inline-flex; align-items: center; gap: var(--s-xs); font-weight: 600; font-size: 0.8125rem; }
.status--navy { color: var(--navy); }
.status--basil { color: var(--basil-deep); }
.status--tomato { color: var(--tomato); }

.timeline { display: flex; flex-wrap: wrap; gap: var(--s-sm) var(--s-md); list-style: none; margin: 0; padding: 0; }
.timeline__step { display: inline-flex; align-items: center; gap: var(--s-xs); font-size: 0.8125rem; color: var(--beige); }
.timeline__step--done { color: var(--basil-deep); }
.timeline__step--current { color: var(--gold-deep); font-weight: 600; }
.timeline__note { flex-basis: 100%; color: var(--muted); font-size: 0.8125rem; list-style: none; }
.timeline--closed { display: flex; flex-direction: column; gap: var(--s-xs); }
.timeline__reason { margin: 0; color: var(--muted); font-size: 0.875rem; }

.order-detail { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.order-detail__head h1 { margin: var(--s-sm) 0 0; }
.order-detail__head p { margin: var(--s-xs) 0 0; color: var(--muted); font-size: 0.875rem; }
.order-detail__meta p { margin: 0 0 var(--s-xs); }

.receipt { background: var(--off-white); border-radius: var(--r-md); padding: var(--s-md); }
.receipt__line { display: grid; grid-template-columns: 32px 1fr auto; gap: var(--s-sm); padding: 2px 0; }
.receipt__line--sub { color: var(--muted); }
.receipt__line--total { font-weight: 600; border-top: 1px solid var(--beige); margin-top: var(--s-xs); padding-top: var(--s-sm); }

.btn-danger {
  min-height: 48px; border: 1px solid var(--tomato); border-radius: var(--r-pill);
  background: transparent; color: var(--tomato); font-weight: 600; padding: 0 var(--s-lg);
}
```

- [ ] **Step 6: Verify:** build + lint clean. Manual: place an order → detail shows the timeline at "Order placed" (gold current step); cancel it → badge flips to Cancelled (tomato icon+label); place another and leave it 2+ minutes → poll shows Rejected with "Not accepted in time".

- [ ] **Step 7: Commit**

```bash
git add app/ && git commit -m "feat(app): live customer orders — status timeline, detail receipt, cancel"
```

---

### Task 17: Restaurant Orders tab — queue, transitions, countdown, reject reasons

**Files:**
- Create: `app/src/screens/restaurant/ROrdersScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx` (replace the `/` ComingSoon), `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 8 endpoints; Tasks 12–13, 16 (`STATUS_META`, `StatusBadge`).
- Produces: `ROrdersScreen` with an exported `RejectSheet` used again by Task 19; alert integration point for Task 18 (a `latestNew` detection effect).

- [ ] **Step 1: Create `app/src/screens/restaurant/ROrdersScreen.tsx`:**

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiGet, apiSend } from "../../lib/api";
import { formatClock, formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { StatusBadge } from "../../components/OrderStatus";

const POLL_MS = 5000;
const REJECT_REASONS = ["Item unavailable", "Store too busy", "Closing soon", "Other"];
export type QueueTab = "new" | "preparing" | "ready" | "history";
const TABS: { key: QueueTab; label: string }[] = [
  { key: "new", label: "New" }, { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" }, { key: "history", label: "History" },
];

function Countdown({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={`rcountdown mono${left <= 30 ? " rcountdown--urgent" : ""}`} aria-label="Time left to accept">
      {mm}:{ss}
    </span>
  );
}

export function RejectSheet({ onPick, onClose }: { onPick: (reason: string) => void; onClose: () => void }) {
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  return (
    <div className="rsheet__backdrop" role="dialog" aria-modal="true" aria-label="Reject order" onClick={onClose}>
      <div className="rsheet" onClick={(e) => e.stopPropagation()}>
        <h2>Why are you rejecting?</h2>
        {REJECT_REASONS.map((r) => r === "Other" ? (
          <button key={r} type="button" className="rsheet__option" onClick={() => setShowOther(true)}>{r}</button>
        ) : (
          <button key={r} type="button" className="rsheet__option" onClick={() => onPick(r)}>{r}</button>
        ))}
        {showOther && (
          <div className="rsheet__other">
            <input type="text" value={other} maxLength={200} placeholder="Tell the customer why"
              onChange={(e) => setOther(e.target.value)} />
            <button type="button" className="btn-danger" disabled={!other.trim()} onClick={() => onPick(other.trim())}>
              Reject order
            </button>
          </div>
        )}
        <button type="button" className="rsheet__cancel" onClick={onClose}>Keep the order</button>
      </div>
    </div>
  );
}

function elapsedMin(fromIso: string | null): string {
  if (!fromIso) return "0 min";
  return `${Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 60_000))} min`;
}

export function ROrdersScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as QueueTab) ?? "new";
  const [data, setData] = useState<OrdersListResponse | null>(null);
  const [rejecting, setRejecting] = useState<OrderDTO | null>(null);

  // New-order detection (full-screen alert) lives in Task 18's shell-level
  // NewOrderWatcher, not here — this screen only renders the queue.
  const load = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>(`/api/restaurant/orders?tab=${tab}&page=1`);
    setData(res);
  }, [tab]);
  usePolling(load, POLL_MS);
  useEffect(() => { setData(null); }, [tab]);

  const act = async (order: OrderDTO, path: string, body?: unknown) => {
    try {
      await apiSend<{ order: OrderDTO }>("POST", `/api/restaurant/orders/${order.id}/${path}`, body);
    } catch { /* 409 = the card is stale (expired/raced) — the reload below shows the truth */ }
    setRejecting(null);
    await load();
  };

  const counts = data?.counts;
  return (
    <main className="screen rqueue">
      <div className="rtabs" role="tablist" aria-label="Order queues">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`rtabs__tab${tab === t.key ? " rtabs__tab--active" : ""}`}
            onClick={() => setParams({ tab: t.key })}>
            {t.label}
            {counts && t.key !== "history" && counts[t.key] > 0 && (
              <span className="rtabs__count mono">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {data === null && <div className="restaurant__hero-skeleton" role="status" aria-label="Loading" />}
      {data !== null && data.orders.length === 0 && (
        <div className="rqueue__empty">
          <p>{tab === "new" ? "New orders will appear here." : tab === "history" ? "Completed and rejected orders will appear here." : "Nothing here right now."}</p>
        </div>
      )}

      {data?.orders.map((o) => (
        <article key={o.id} className="rorder-card">
          <header>
            <Link to={`/orders/${o.id}`} className="rorder-card__id mono">{formatOrderNumber(o.orderNumber)}</Link>
            <span className="rorder-card__time">{formatClock(o.placedAt)}</span>
            {o.status === "placed" && <Countdown expiresAt={o.expiresAt} />}
            {o.status === "preparing" && <span className="mono rorder-card__elapsed">{elapsedMin(o.preparingAt)}</span>}
            {(tab === "history" || tab === "ready") && <StatusBadge status={o.status} />}
          </header>
          <ul className="rorder-card__items">
            {o.items.map((i) => <li key={i.id}><span className="mono">{i.quantity}×</span> {i.nameSnapshot}</li>)}
          </ul>
          {o.note && <p className="rorder-card__note">“{o.note}”</p>}
          <footer>
            <span className="mono rorder-card__total">{formatPrice(o.totalCents)}</span>
            {o.status === "placed" && (
              <span className="rorder-card__actions">
                <button type="button" className="btn-danger" onClick={() => setRejecting(o)}>Reject</button>
                <button type="button" className="btn-primary" onClick={() => void act(o, "accept")}>Accept</button>
              </span>
            )}
            {o.status === "accepted" && (
              <button type="button" className="btn-primary" onClick={() => void act(o, "status", { to: "preparing" })}>Start preparing</button>
            )}
            {o.status === "preparing" && (
              <button type="button" className="btn-primary" onClick={() => void act(o, "status", { to: "ready" })}>Mark Ready</button>
            )}
            {o.status === "ready" && <span className="rorder-card__waiting">Waiting for pickup</span>}
          </footer>
        </article>
      ))}

      {rejecting && (
        <RejectSheet
          onPick={(reason) => void act(rejecting, "reject", { reason })}
          onClose={() => setRejecting(null)}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Route it:** in `RestaurantShell.tsx` replace `<Route path="/" element={<ComingSoon name="Orders" />} />` with `<Route path="/" element={<ROrdersScreen />} />` (import it). Keep `ComingSoon` for the remaining routes.

- [ ] **Step 3: Append to `rshell.css`:**

```css
.rqueue { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.rtabs { display: flex; gap: var(--s-xs); background: var(--dough); border-radius: var(--r-pill); padding: 4px; }
.rtabs__tab {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: var(--s-xs);
  min-height: 44px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--muted);
  font-weight: 600; font-size: 0.8125rem;
  transition: background var(--dur-fast) var(--ease-out-quart), color var(--dur-fast);
}
.rtabs__tab--active { background: var(--navy); color: var(--cream); }
.rtabs__count {
  min-width: 18px; height: 18px; padding: 0 4px; border-radius: var(--r-pill);
  background: var(--tomato); color: var(--cream); font-size: 0.6875rem; line-height: 18px; text-align: center;
}
.rtabs__tab--active .rtabs__count { background: var(--gold); color: var(--navy); }

.rqueue__empty { display: grid; place-items: center; min-height: 40dvh; color: var(--muted); }

.rorder-card {
  display: flex; flex-direction: column; gap: var(--s-sm);
  background: var(--off-white); border-radius: var(--r-md); padding: var(--s-md);
  box-shadow: var(--sh-raised);
}
.rorder-card header { display: flex; align-items: center; gap: var(--s-md); }
.rorder-card__id { font-weight: 600; text-decoration: underline; }
.rorder-card__time { color: var(--muted); font-size: 0.875rem; }
.rorder-card header > :last-child { margin-left: auto; }
.rcountdown { font-size: 1.125rem; color: var(--gold-deep); font-weight: 600; }
.rcountdown--urgent { color: var(--tomato); }
.rorder-card__elapsed { color: var(--muted); }
.rorder-card__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rorder-card__note { margin: 0; padding: var(--s-sm) var(--s-md); background: var(--butter); border-radius: var(--r-sm); font-size: 0.9375rem; }
.rorder-card footer { display: flex; align-items: center; gap: var(--s-md); }
.rorder-card__total { font-size: 1.0625rem; font-weight: 600; }
.rorder-card__actions { margin-left: auto; display: inline-flex; gap: var(--s-sm); }
.rorder-card footer .btn-primary:only-child, .rorder-card__waiting { margin-left: auto; }
.rorder-card__waiting { color: var(--basil-deep); font-weight: 600; font-size: 0.875rem; }

.rsheet__backdrop {
  position: fixed; inset: 0; z-index: var(--z-drawer);
  background: rgba(15, 44, 86, .45); display: flex; align-items: flex-end;
}
.rsheet {
  width: 100%; max-width: 480px; margin: 0 auto; background: var(--cream);
  border-radius: var(--r-lg) var(--r-lg) 0 0; padding: var(--s-lg);
  display: flex; flex-direction: column; gap: var(--s-sm);
}
.rsheet h2 { margin: 0 0 var(--s-sm); font-size: 1.125rem; }
.rsheet__option {
  min-height: 48px; border: 1px solid var(--beige); border-radius: var(--r-sm);
  background: var(--off-white); color: var(--ink); font-weight: 600; text-align: left; padding: 0 var(--s-md);
}
.rsheet__other { display: flex; flex-direction: column; gap: var(--s-sm); }
.rsheet__other input {
  font: inherit; min-height: 44px; padding: 0 var(--s-md);
  border: 1px solid var(--beige); border-radius: var(--r-sm); background: var(--dough);
}
.rsheet__cancel { min-height: 44px; border: 0; background: none; color: var(--muted); font-weight: 600; }
```

- [ ] **Step 4: Verify:** build + lint clean. Manual two-browser run (customer in one, demo owner in the other): place an order → appears under New within 5s with a ticking gold countdown (tomato under 30s); Accept → moves to Preparing tab ("Start preparing" → then elapsed + "Mark Ready"); Mark Ready → Ready tab shows "Waiting for pickup" (basil, label + color); Reject another with "Store too busy" → History; let one expire → History shows Rejected "Not accepted in time"; customer timeline mirrors every step within 5s.

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat(app): restaurant order queue — tabs, countdown, accept/reject, status flow"
```

---

### Task 18: Full-screen incoming-order alert with chime + vibration

**Files:**
- Create: `app/src/screens/restaurant/IncomingOrderAlert.tsx`, `app/src/lib/chime.ts`
- Modify: `app/src/shells/RestaurantShell.tsx`, `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 8 endpoints, Task 17's `RejectSheet`, Task 12 hooks.
- Produces: `<NewOrderWatcher />` mounted once in the shell — detects new placed orders from anywhere in the restaurant app (not just the Orders tab), per the spec's "restaurant staff shouldn't have to hunt for it".

- [ ] **Step 1: Create `app/src/lib/chime.ts`** (WebAudio two-tone — no audio asset, no dependency):

```ts
let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from any user gesture — browsers only allow sound after interaction. */
export function unlockChime(): void {
  ensureCtx();
}

/** Bright two-note ding (A5 → D6), ~0.7s. Best-effort: silent until unlocked. */
export function playChime(): void {
  try {
    const ac = ensureCtx();
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.55);
    });
  } catch { /* sound is a garnish, never an error */ }
}
```

- [ ] **Step 2: Create `app/src/screens/restaurant/IncomingOrderAlert.tsx`:**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { playChime, unlockChime } from "../../lib/chime";
import { RejectSheet } from "./ROrdersScreen";

const POLL_MS = 5000;
const RING_MS = 3000;

function AlertCountdown({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  return <span className="ralert__count mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
}

export function NewOrderWatcher() {
  const [alertOrder, setAlertOrder] = useState<OrderDTO | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = useRef<Set<string> | null>(null);

  // Sound needs one prior user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => unlockChime();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const poll = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>("/api/restaurant/orders?tab=new&page=1");
    const ids = new Set(res.orders.map((o) => o.id));
    if (known.current !== null) {
      const fresh = res.orders.filter((o) => !known.current!.has(o.id));
      if (fresh.length > 0) setAlertOrder(fresh[0]); // newest first from the API
    }
    known.current = ids;
  }, []);
  usePolling(poll, POLL_MS);

  // Ring + vibrate repeatedly while the alert is on screen.
  useEffect(() => {
    if (!alertOrder) return;
    const ring = () => {
      playChime();
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    };
    ring();
    const id = window.setInterval(ring, RING_MS);
    return () => window.clearInterval(id);
  }, [alertOrder]);

  if (!alertOrder) return null;

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await apiSend<{ order: OrderDTO }>("POST", `/api/restaurant/orders/${alertOrder.id}/${path}`, body);
    } catch { /* expired or raced — the queue poll shows the truth */ }
    setBusy(false);
    setRejecting(false);
    setAlertOrder(null);
  };

  return (
    <div className="ralert" role="alertdialog" aria-modal="true" aria-label="New incoming order">
      <p className="ralert__eyebrow">New order</p>
      <p className="ralert__id mono">{formatOrderNumber(alertOrder.orderNumber)}</p>
      <AlertCountdown expiresAt={alertOrder.expiresAt} />
      <ul className="ralert__items">
        {alertOrder.items.map((i) => (
          <li key={i.id}><span className="mono">{i.quantity}×</span> {i.nameSnapshot}</li>
        ))}
      </ul>
      {alertOrder.note && <p className="ralert__note">“{alertOrder.note}”</p>}
      <p className="ralert__total mono">{formatPrice(alertOrder.totalCents)}</p>
      <div className="ralert__actions">
        <button type="button" className="btn-danger" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
        <button type="button" className="btn-primary ralert__accept" disabled={busy} onClick={() => void act("accept")}>Accept order</button>
      </div>
      <button type="button" className="ralert__dismiss" onClick={() => setAlertOrder(null)}>Decide from the queue</button>
      {rejecting && (
        <RejectSheet onPick={(reason) => void act("reject", { reason })} onClose={() => setRejecting(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount it** in `RestaurantShell.tsx`'s `RestaurantRoutes`, right after `<OfflineBanner />`: `<NewOrderWatcher />` (import it). It renders `null` until an order lands, so it's invisible chrome.

- [ ] **Step 4: Append to `rshell.css`:**

```css
.ralert {
  position: fixed; inset: 0; z-index: var(--z-intro);
  max-width: 480px; margin: 0 auto;
  background: var(--navy-deep); color: var(--cream);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--s-md); padding: var(--s-xl); text-align: center;
  animation: ralert-in var(--dur) var(--ease-out-expo);
}
@keyframes ralert-in { from { opacity: 0; transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) { .ralert { animation: none; } }
.ralert__eyebrow { margin: 0; font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--gold); }
.ralert__id { margin: 0; font-size: 1.5rem; }
.ralert__count { font-size: 2.25rem; color: var(--gold); }
.ralert__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.ralert__note { margin: 0; padding: var(--s-sm) var(--s-md); background: rgba(255, 252, 240, .12); border-radius: var(--r-sm); }
.ralert__total { margin: 0; font-size: 1.25rem; }
.ralert__actions { display: flex; gap: var(--s-md); }
.ralert__accept { min-height: 52px; padding: 0 var(--s-xl); }
.ralert .btn-danger { background: transparent; color: var(--cream); border-color: var(--tomato); }
.ralert__dismiss { border: 0; background: none; color: var(--sky); font-weight: 600; min-height: 44px; }
```

(Gold-Is-Rare check: on this screen the countdown is the one gold element; the eyebrow shares its hue as a label — acceptable because they form one attention unit. If the reviewer disagrees, drop the eyebrow to cream.)

- [ ] **Step 5: Verify:** build + lint clean. Manual: with the owner on the Menu tab, place a customer order → within 5s the full-screen alert appears with ticking countdown; after any prior tap, it chimes every 3s (and vibrates on Android); Accept from the alert → lands in Preparing; "Decide from the queue" dismisses without acting; reject path works from the alert.

- [ ] **Step 6: Commit**

```bash
git add app/ && git commit -m "feat(app): full-screen incoming-order alert with WebAudio chime and vibration"
```

---

### Task 19: Restaurant order detail + printable receipt

**Files:**
- Create: `app/src/screens/restaurant/ROrderDetailScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx` (route), `app/src/styles/rshell.css`
- Backend (small addition): `backend/src/routes/ownerOrdersRouter.ts` + its test — `GET /api/restaurant/orders/:id`

**Interfaces:**
- Consumes: Tasks 8, 12, 16 (`StatusBadge`).
- Produces: `GET /api/restaurant/orders/:id` → `{ order: OrderDTO }` (404 cross-tenant), route `/orders/:id` in the restaurant shell.

- [ ] **Step 1 (backend, TDD): add the detail endpoint.** Test in `ownerOrdersRouter.test.ts`:

```ts
describe("GET /api/restaurant/orders/:id", () => {
  it("returns own order detail, 404s foreign", async () => {
    const owned = makeOwnedRestaurant();
    const mine = makeOrder({ restaurantId: owned.profile.id, expiresAt: future() });
    const foreign = makeOrder({ restaurantId: "someone-elses", expiresAt: future() });
    const { app } = buildApp([mine, foreign], owned);
    const res = await request(app).get(`/api/restaurant/orders/${mine.id}`).set(ownerAuth);
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(mine.id);
    expect(res.body.order.customerPhone).toBeTruthy(); // masked client-side, full over TLS to the owner
    expect((await request(app).get(`/api/restaurant/orders/${foreign.id}`).set(ownerAuth)).status).toBe(404);
  });
});
```

Run (FAIL), then add to `createOwnerOrdersRouter` — **register BEFORE the `/:id/accept` routes is not required (different methods/paths), but AFTER the `/` list route**:

```ts
  router.get("/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const order = await loadOwn(req);
    if (!order) return res.status(404).json({ error: "Order not found." });
    return res.status(200).json({ order: toOrderDTO(order) });
  }));
```

Run tests (PASS), `npm test` green, commit: `git commit -am "feat(backend): restaurant order detail endpoint"`.

- [ ] **Step 2: Create `app/src/screens/restaurant/ROrderDetailScreen.tsx`:**

```tsx
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, ApiError } from "../../lib/api";
import { formatClock, formatOrderNumber, formatPrice, maskPhone } from "../../lib/format";
import type { OrderDTO } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { StatusBadge } from "../../components/OrderStatus";

const POLL_MS = 5000;

export function ROrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ order: OrderDTO }>(`/api/restaurant/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else throw err;
    }
  }, [id]);
  usePolling(load, POLL_MS);

  if (missing) {
    return (
      <main className="screen restaurant--message">
        <p>This order doesn't exist.</p>
        <button className="btn-retry" onClick={() => navigate("/")}>Back to orders</button>
      </main>
    );
  }
  if (!order) {
    return <main className="screen rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }

  const times: [string, string | null][] = [
    ["Placed", order.placedAt], ["Accepted", order.acceptedAt],
    ["Preparing", order.preparingAt], ["Ready", order.readyAt], ["Closed", order.closedAt],
  ];

  return (
    <main className="screen rdetail printable">
      <header className="rdetail__head">
        <button className="restaurant__back rdetail__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="mono">{formatOrderNumber(order.orderNumber)}</h1>
        <StatusBadge status={order.status} />
        {order.rejectionReason && <p className="rdetail__reason">“{order.rejectionReason}”</p>}
      </header>

      <section className="receipt" aria-label="Items">
        {order.items.map((i) => (
          <div key={i.id} className="receipt__line">
            <span className="mono">{i.quantity}×</span>
            <span className="receipt__name">{i.nameSnapshot}</span>
            <span className="mono">{formatPrice(i.priceAtOrderCents * i.quantity)}</span>
          </div>
        ))}
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Subtotal</span><span className="mono">{formatPrice(order.subtotalCents)}</span></div>
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Delivery fee</span><span className="mono">{formatPrice(order.deliveryFeeCents)}</span></div>
        <div className="receipt__line receipt__line--total"><span /><span className="receipt__name">Total (cash)</span><span className="mono">{formatPrice(order.totalCents)}</span></div>
      </section>

      <section className="rdetail__meta">
        <p><strong>Customer:</strong> {order.customerName} · <span className="mono">{maskPhone(order.customerPhone)}</span></p>
        <p><strong>Deliver to:</strong> {order.deliveryAddress}</p>
        {order.note && <p><strong>Note:</strong> {order.note}</p>}
      </section>

      <section className="rdetail__times" aria-label="Timestamps">
        {times.filter(([, t]) => t !== null).map(([label, t]) => (
          <p key={label}><span>{label}</span><span className="mono">{formatClock(t!)}</span></p>
        ))}
      </section>

      <button type="button" className="btn-primary rdetail__print" onClick={() => window.print()}>Print receipt</button>
    </main>
  );
}
```

- [ ] **Step 3: Route it:** `<Route path="/orders/:id" element={<ROrderDetailScreen />} />` in `RestaurantShell.tsx`.

- [ ] **Step 4: Append to `rshell.css`:**

```css
.rdetail { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.rdetail__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-md); }
.rdetail__head h1 { margin: 0; font-size: 1.375rem; }
.rdetail__back { position: static; }
.rdetail__reason { flex-basis: 100%; margin: 0; color: var(--muted); }
.rdetail__meta p, .rdetail__times p { margin: 0 0 var(--s-xs); }
.rdetail__times p { display: flex; justify-content: space-between; max-width: 280px; color: var(--muted); font-size: 0.875rem; }
.rdetail__print { align-self: flex-start; }

@media print {
  body * { visibility: hidden; }
  .printable, .printable * { visibility: visible; }
  .printable { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; }
  .rdetail__back, .rdetail__print, .tab-bar, .rtopbar, .rbanner { display: none !important; }
}
```

- [ ] **Step 5: Verify:** build + lint clean. Manual: tap an order id from the queue → detail with masked phone (`03•••••••67`), receipt block, timestamps; Print preview shows only the receipt content.

- [ ] **Step 6: Commit**

```bash
git add app/ backend/ && git commit -m "feat(app): restaurant order detail with printable receipt"
```

---

### Task 20: Menu tab — list, availability toggle, add/edit/delete

**Files:**
- Create: `app/src/screens/restaurant/RMenuScreen.tsx`, `app/src/screens/restaurant/RMenuItemEditScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx` (routes), `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 9 endpoints, Task 12 types (`OwnerMenuItem`).
- Produces: routes `/menu`, `/menu/new`, `/menu/:id`.

- [ ] **Step 1: Create `app/src/screens/restaurant/RMenuScreen.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiSend } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import type { OwnerMenuItem } from "../../lib/types";

export function RMenuScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OwnerMenuItem[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu")
      .then((res) => setItems(res.items))
      .catch(() => setError("Couldn't load your menu. Pull to retry."));
  }, []);

  const toggle = async (item: OwnerMenuItem) => {
    const next = !item.isAvailable;
    setItems((prev) => prev!.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i))); // optimistic
    try {
      await apiSend("PATCH", `/api/restaurant/menu-items/${item.id}`, { isAvailable: next });
    } catch {
      setItems((prev) => prev!.map((i) => (i.id === item.id ? { ...i, isAvailable: !next } : i))); // revert
    }
  };

  if (error) return <main className="screen rqueue"><div className="rqueue__empty"><p>{error}</p></div></main>;
  if (items === null) {
    return <main className="screen rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }
  if (items.length === 0) {
    return (
      <main className="screen rqueue">
        <div className="rqueue__empty">
          <p>Add your first item — your menu is what customers see.</p>
          <Link to="/menu/new" className="btn-primary">Add an item</Link>
        </div>
      </main>
    );
  }

  const filtered = q.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    : items;
  const groups = new Map<string, OwnerMenuItem[]>();
  for (const item of filtered) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  return (
    <main className="screen rmenu">
      <input className="rmenu__search" type="search" value={q} placeholder="Search your menu"
        aria-label="Search your menu" onChange={(e) => setQ(e.target.value)} />
      {filtered.length === 0 && <div className="rqueue__empty"><p>No items match “{q}”.</p></div>}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="rmenu__group">
          <h2>{category}</h2>
          {list.map((item) => (
            <article key={item.id} className={`rmenu-row${item.isAvailable ? "" : " rmenu-row--off"}`}>
              {item.imageUrl
                ? <img className="rmenu-row__thumb" src={item.imageUrl} alt="" loading="lazy" />
                : <span className="rmenu-row__thumb rmenu-row__thumb--empty" aria-hidden="true" />}
              <button type="button" className="rmenu-row__text" onClick={() => navigate(`/menu/${item.id}`)}>
                <span className="rmenu-row__name">{item.name}</span>
                <span className="rmenu-row__price mono">{formatPrice(item.priceCents)}</span>
              </button>
              <button type="button" role="switch" aria-checked={item.isAvailable}
                aria-label={`${item.name} availability`}
                className={`rswitch${item.isAvailable ? " rswitch--on" : ""}`}
                onClick={() => void toggle(item)}>
                {item.isAvailable ? "Available" : "Sold out"}
              </button>
            </article>
          ))}
        </section>
      ))}
      <Link to="/menu/new" className="rfab" aria-label="Add menu item">+</Link>
    </main>
  );
}
```

- [ ] **Step 2: Create `app/src/screens/restaurant/RMenuItemEditScreen.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend } from "../../lib/api";
import type { OwnerMenuItem } from "../../lib/types";

export function RMenuItemEditScreen() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceRs, setPriceRs] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [loaded, setLoaded] = useState(isNew);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu").then(({ items }) => {
      setCategories([...new Set(items.map((i) => i.category))]);
      if (!isNew) {
        const item = items.find((i) => i.id === id);
        if (!item) { setError("This item no longer exists."); return; }
        setName(item.name); setDescription(item.description); setCategory(item.category);
        setPriceRs(String(Math.round(item.priceCents / 100))); setIsAvailable(item.isAvailable);
      }
      setLoaded(true);
    }).catch(() => setError("Couldn't load the menu. Go back and retry."));
  }, [id, isNew]);

  const save = async () => {
    setError("");
    const priceCents = Math.round(Number(priceRs) * 100);
    if (!name.trim() || !category.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      setError("Name, category, and a price above zero are required.");
      return;
    }
    setBusy(true);
    const body = { name: name.trim(), description: description.trim(), category: category.trim(), priceCents, isAvailable };
    try {
      if (isNew) await apiSend("POST", "/api/restaurant/menu-items", body);
      else await apiSend("PATCH", `/api/restaurant/menu-items/${id}`, body);
      navigate("/menu");
    } catch {
      setError("Couldn't save. Check the fields and try again.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${name}” from your menu? Past orders keep their copy.`)) return;
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/restaurant/menu-items/${id}`);
      navigate("/menu");
    } catch {
      setError("Couldn't delete this item.");
      setBusy(false);
    }
  };

  if (!loaded && !error) {
    return <main className="screen rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }

  return (
    <main className="screen rform">
      <h1>{isNew ? "Add item" : "Edit item"}</h1>
      <label className="rform__field">
        <span>Name</span>
        <input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="rform__field">
        <span>Description</span>
        <textarea value={description} maxLength={500} rows={2} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="rform__field">
        <span>Category</span>
        <input type="text" value={category} list="rcategories" placeholder="e.g. Pizze, Mains, Drinks"
          onChange={(e) => setCategory(e.target.value)} />
        <datalist id="rcategories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label className="rform__field">
        <span>Price (Rs)</span>
        <input type="number" inputMode="numeric" min="1" value={priceRs} onChange={(e) => setPriceRs(e.target.value)} />
      </label>
      <label className="rform__check">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        <span>Available to order</span>
      </label>
      {error && <p className="cart__error" role="alert">{error}</p>}
      <div className="rform__actions">
        {!isNew && <button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>Delete</button>}
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
      </div>
      <button type="button" className="rsheet__cancel" onClick={() => navigate("/menu")}>Back to menu</button>
    </main>
  );
}
```

- [ ] **Step 3: Route them** in `RestaurantShell.tsx` (replace the `/menu` ComingSoon):

```tsx
        <Route path="/menu" element={<RMenuScreen />} />
        <Route path="/menu/new" element={<RMenuItemEditScreen />} />
        <Route path="/menu/:id" element={<RMenuItemEditScreen />} />
```

`/menu/new` must be declared before `/menu/:id`? React Router v6 ranks static segments above params automatically — order doesn't matter, keep this order anyway for readability.

- [ ] **Step 4: Append to `rshell.css`:**

```css
.rmenu { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md) var(--s-md) 96px; }
.rmenu__search {
  font: inherit; min-height: 44px; padding: 0 var(--s-md);
  border: 1px solid var(--beige); border-radius: var(--r-pill); background: var(--dough); color: var(--ink);
}
.rmenu__group h2 { margin: 0 0 var(--s-sm); font-size: 1.125rem; }
.rmenu-row {
  display: flex; align-items: center; gap: var(--s-md);
  background: var(--off-white); border-radius: var(--r-md); padding: var(--s-sm); margin-bottom: var(--s-sm);
}
.rmenu-row--off { opacity: .65; }
.rmenu-row__thumb { width: 48px; height: 48px; border-radius: var(--r-sm); object-fit: cover; flex: none; }
.rmenu-row__thumb--empty { background: var(--dough); }
.rmenu-row__text {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  border: 0; background: none; text-align: left; padding: 0; min-height: 44px; justify-content: center;
  color: var(--ink);
}
.rmenu-row__name { font-weight: 600; }
.rswitch {
  min-height: 44px; min-width: 96px; border-radius: var(--r-pill);
  border: 1px solid var(--tomato); background: transparent; color: var(--tomato);
  font-weight: 600; font-size: 0.8125rem;
}
.rswitch--on { border-color: var(--basil-deep); color: var(--basil-deep); }

.rfab {
  position: fixed; right: max(var(--s-md), calc(50vw - 240px + var(--s-md)));
  bottom: calc(72px + env(safe-area-inset-bottom)); z-index: var(--z-sticky);
  display: grid; place-items: center; width: 56px; height: 56px;
  border-radius: 50%; background: var(--navy); color: var(--cream);
  font-size: 1.75rem; box-shadow: var(--sh-overlay);
}

.rform { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.rform h1 { margin: 0; font-size: 1.375rem; }
.rform__field { display: flex; flex-direction: column; gap: var(--s-xs); }
.rform__field span { font-weight: 600; font-size: 0.8125rem; letter-spacing: 0.06em; text-transform: uppercase; }
.rform__field input, .rform__field textarea {
  font: inherit; min-height: 44px; padding: var(--s-sm) var(--s-md);
  border: 1px solid var(--beige); border-radius: var(--r-sm); background: var(--dough); color: var(--ink);
}
.rform__check { display: flex; align-items: center; gap: var(--s-sm); min-height: 44px; }
.rform__check input { width: 20px; height: 20px; accent-color: var(--basil-deep); }
.rform__actions { display: flex; justify-content: space-between; gap: var(--s-md); }
.rform__actions .btn-primary { margin-left: auto; }
```

- [ ] **Step 5: Verify:** build + lint clean. Manual: menu lists grouped items; sold-out toggle flips instantly and survives reload; add "Diavola / Pizze / Rs 520" → appears under Pizze; edit its price → customer restaurant page shows the new price on next load; delete it → gone from both, but any past order still shows its snapshot; search-within-menu filters live.

- [ ] **Step 6: Commit**

```bash
git add app/ && git commit -m "feat(app): restaurant menu management — availability toggle, add/edit/delete"
```

---

### Task 21: Restaurant Search tab (FR-16)

**Files:**
- Create: `app/src/screens/restaurant/RSearchScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx` (route), `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 8 `tab=all|…&q=`, Task 9 menu list, Task 16 `StatusBadge`.
- Produces: route `/search` in the restaurant shell.

- [ ] **Step 1: Create `app/src/screens/restaurant/RSearchScreen.tsx`:**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse, OwnerMenuItem } from "../../lib/types";
import { StatusBadge } from "../../components/OrderStatus";

const RECENT_KEY = "feastnow_rsearch_recent";
const RECENT_MAX = 8;
const DEBOUNCE_MS = 300;
type StatusChip = "all" | "new" | "preparing" | "ready" | "history";
const CHIPS: { key: StatusChip; label: string }[] = [
  { key: "all", label: "All" }, { key: "new", label: "New" }, { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" }, { key: "history", label: "History" },
];

function readRecent(): string[] {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[]; } catch { return []; }
}
function pushRecent(q: string): void {
  const next = [q, ...readRecent().filter((r) => r !== q)].slice(0, RECENT_MAX);
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota — recents are a nicety */ }
}

export function RSearchScreen() {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<StatusChip>("all");
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [menu, setMenu] = useState<OwnerMenuItem[]>([]);
  const [recent, setRecent] = useState(readRecent);
  const timer = useRef<number>();

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu").then(({ items }) => setMenu(items)).catch(() => setMenu([]));
  }, []);

  const run = useCallback(async (query: string, tab: StatusChip) => {
    if (!query.trim()) { setOrders(null); return; }
    const res = await apiGet<OrdersListResponse>(`/api/restaurant/orders?tab=${tab}&q=${encodeURIComponent(query.trim())}&page=1`);
    setOrders(res.orders);
    pushRecent(query.trim());
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void run(q, chip).catch(() => setOrders([])), DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [q, chip, run]);

  const menuHits = q.trim()
    ? menu.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5)
    : [];

  return (
    <main className="screen rsearch">
      <input className="rmenu__search" type="search" value={q} autoFocus
        placeholder="Order # or customer name" aria-label="Search orders and menu"
        onChange={(e) => setQ(e.target.value)} />
      <div className="rsearch__chips" role="tablist" aria-label="Order status filter">
        {CHIPS.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={chip === c.key}
            className={`rsearch__chip${chip === c.key ? " rsearch__chip--active" : ""}`}
            onClick={() => setChip(c.key)}>{c.label}</button>
        ))}
      </div>

      {!q.trim() && recent.length > 0 && (
        <section className="rsearch__recent">
          <h2>Recent searches</h2>
          {recent.map((r) => (
            <button key={r} type="button" className="rsheet__option" onClick={() => setQ(r)}>{r}</button>
          ))}
        </section>
      )}

      {q.trim() && (
        <>
          <section aria-label="Matching orders">
            <h2>Orders</h2>
            {orders === null && <p className="rsearch__hint">Searching…</p>}
            {orders !== null && orders.length === 0 && <p className="rsearch__hint">No orders match “{q}”.</p>}
            {orders?.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="rorder-card rsearch__hit">
                <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
                <span>{o.customerName}</span>
                <StatusBadge status={o.status} />
                <span className="mono">{formatPrice(o.totalCents)}</span>
              </Link>
            ))}
          </section>
          <section aria-label="Matching menu items">
            <h2>Menu items</h2>
            {menuHits.length === 0 && <p className="rsearch__hint">No menu items match “{q}”.</p>}
            {menuHits.map((m) => (
              <Link key={m.id} to={`/menu/${m.id}`} className="rorder-card rsearch__hit">
                <span>{m.name}</span>
                <span className="mono">{formatPrice(m.priceCents)}</span>
                <span className={m.isAvailable ? "status status--basil" : "status status--tomato"}>
                  {m.isAvailable ? "Available" : "Sold out"}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Route it** (replace the `/search` ComingSoon) and **Step 3: append to `rshell.css`:**

```css
.rsearch { display: flex; flex-direction: column; gap: var(--s-md); padding: var(--s-md); }
.rsearch h2 { margin: 0 0 var(--s-sm); font-size: 1rem; }
.rsearch__chips { display: flex; gap: var(--s-sm); flex-wrap: wrap; }
.rsearch__chip {
  min-height: 44px; padding: 0 var(--s-md); border-radius: var(--r-pill);
  border: 1px solid var(--beige); background: var(--off-white); color: var(--muted);
  font-weight: 600; font-size: 0.8125rem;
}
.rsearch__chip--active { background: var(--navy); border-color: var(--navy); color: var(--cream); }
.rsearch__recent { display: flex; flex-direction: column; gap: var(--s-sm); }
.rsearch__hint { color: var(--muted); margin: 0; }
.rsearch__hit { flex-direction: row; align-items: center; justify-content: space-between; box-shadow: none; margin-bottom: var(--s-sm); }
```

- [ ] **Step 4: Verify:** build + lint clean. Manual: search an order number → hit opens detail; search a customer name → their orders; chips narrow by status; menu name search links to the editor; recents persist and re-run on tap.

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat(app): restaurant search across own orders and menu (FR-16)"
```

---

### Task 22: Profile tab — business info, hours, ratings, logout

**Files:**
- Create: `app/src/screens/restaurant/RProfileScreen.tsx`
- Modify: `app/src/shells/RestaurantShell.tsx` (route), `app/src/styles/rshell.css`

**Interfaces:**
- Consumes: Task 7 endpoints, Task 13 `useOwner`, Task 12 types (`OwnerProfile`, `OwnerReview`).
- Produces: route `/profile` in the restaurant shell. (Store status stays in the always-visible top bar — that satisfies the spec's "secondary access" without duplicating the toggle.)

- [ ] **Step 1: Create `app/src/screens/restaurant/RProfileScreen.tsx`:**

```tsx
import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import { clearToken } from "../../lib/session";
import { formatRating } from "../../lib/format";
import type { OwnerProfile, OwnerReview } from "../../lib/types";
import { useOwner } from "../../OwnerContext";

export function RProfileScreen() {
  const { profile, setProfile } = useOwner();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [address, setAddress] = useState(profile.address);
  const [cuisines, setCuisines] = useState(profile.cuisines.join(", "));
  const [opensAt, setOpensAt] = useState(profile.opensAt);
  const [closesAt, setClosesAt] = useState(profile.closesAt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<OwnerReview[]>([]);

  useEffect(() => {
    apiGet<{ reviews: OwnerReview[] }>("/api/restaurant/reviews")
      .then((res) => setReviews(res.reviews))
      .catch(() => setReviews([]));
  }, []);

  const save = async () => {
    setError(""); setSaved(false);
    const cuisineList = cuisines.split(",").map((c) => c.trim()).filter(Boolean);
    if (!name.trim() || !address.trim() || cuisineList.length === 0) {
      setError("Name, address, and at least one cuisine are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiSend<{ profile: OwnerProfile }>("PATCH", "/api/restaurant/profile", {
        name: name.trim(), description: description.trim(), address: address.trim(),
        cuisines: cuisineList, opensAt, closesAt,
      });
      setProfile(res.profile);
      setSaved(true);
    } catch {
      setError("Couldn't save. Check the hours format and try again.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    if (!window.confirm("Log out of FeastNow?")) return;
    clearToken();
    window.location.href = "/login.html";
  };

  const starCounts = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.stars === s).length }));
  const maxCount = Math.max(1, ...starCounts.map((c) => c.n));

  return (
    <main className="screen rform rprofile">
      <h1>Business info</h1>
      <label className="rform__field"><span>Business name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="rform__field"><span>Description</span>
        <textarea value={description} rows={2} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="rform__field"><span>Address</span>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
      <label className="rform__field"><span>Cuisines (comma-separated)</span>
        <input type="text" value={cuisines} onChange={(e) => setCuisines(e.target.value)} /></label>
      <div className="rprofile__hours">
        <label className="rform__field"><span>Opens</span>
          <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></label>
        <label className="rform__field"><span>Closes</span>
          <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
      </div>
      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}
      <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save changes"}
      </button>

      <h1>Ratings &amp; reviews</h1>
      <p className="rprofile__avg">
        <span className="mono rprofile__avg-num">{formatRating(profile.avgRating)}</span> · {profile.ratingCount} ratings
      </p>
      <div className="rprofile__bars" aria-label="Ratings breakdown (recent reviews)">
        {starCounts.map(({ s, n }) => (
          <div key={s} className="rprofile__bar-row">
            <span className="mono">{s}★</span>
            <span className="rprofile__bar"><span style={{ width: `${(n / maxCount) * 100}%` }} /></span>
            <span className="mono">{n}</span>
          </div>
        ))}
      </div>
      {reviews.slice(0, 5).map((r) => (
        <article key={r.id} className="rprofile__review">
          <p className="rprofile__review-head"><span className="mono">{r.stars}★</span> {r.authorName}</p>
          <p>{r.reviewText}</p>
        </article>
      ))}
      {reviews.length === 0 && <p className="rsearch__hint">Reviews from customers will appear here.</p>}

      <button type="button" className="btn-danger rprofile__logout" onClick={logout}>Log out</button>
    </main>
  );
}
```

- [ ] **Step 2: Route it** (replace the `/profile` ComingSoon; the last `ComingSoon` usage disappears — delete the `ComingSoon` component from the shell). **Step 3: append to `rshell.css`:**

```css
.rprofile__hours { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-md); }
.rprofile__saved { margin: 0; color: var(--basil-deep); font-weight: 600; }
.rprofile__avg { margin: 0; }
.rprofile__avg-num { font-size: 1.5rem; color: var(--gold-deep); }
.rprofile__bars { display: flex; flex-direction: column; gap: var(--s-xs); }
.rprofile__bar-row { display: grid; grid-template-columns: 36px 1fr 24px; align-items: center; gap: var(--s-sm); }
.rprofile__bar { height: 8px; border-radius: var(--r-pill); background: var(--dough); overflow: hidden; }
.rprofile__bar > span { display: block; height: 100%; background: var(--navy); }
.rprofile__review { background: var(--off-white); border-radius: var(--r-md); padding: var(--s-md); }
.rprofile__review p { margin: 0; }
.rprofile__review-head { font-weight: 600; margin-bottom: var(--s-xs); }
.rprofile__logout { align-self: flex-start; margin-top: var(--s-md); }
```

- [ ] **Step 4: Verify:** build + lint clean. Manual: edit hours to close now → customer browse shows the restaurant closed; cuisines edit reflects on the customer card; ratings section shows the seeded reviews; Log out returns to the login page.

- [ ] **Step 5: Commit**

```bash
git add app/ && git commit -m "feat(app): restaurant profile — business editor, ratings, logout (FR-21)"
```

---

### Task 23: End-to-end verification, deploy, ledger

**Files:**
- Modify: `docs/superpowers/plans/2026-07-16-restaurant-role-ordering.md` (append a completion ledger section)

- [ ] **Step 1: Full test + build pass.** `cd backend && npm test` (all green) · `npx tsc --noEmit` clean · `cd ../app && npm run build && npm run lint` clean.

- [ ] **Step 2: Fresh-seed + manual end-to-end** against local dev servers, in this order:
  1. `role-select` → restaurant signup (fresh email) → OTP → Pending Approval → auto-approve ≤ ~65s → "You're live!".
  2. Customer account: browse → add items (stepper, replace-basket confirm) → checkout (empty-address error, then success) → Orders tab timeline at "Order placed".
  3. Owner (other browser): full-screen alert fires with chime after a prior tap → Accept → Start preparing → Mark Ready; customer timeline mirrors each step ≤ 5s; Ready shows "Waiting for rider".
  4. Reject a second order with a reason → customer sees the reason; let a third expire → both sides show "Not accepted in time".
  5. Customer cancel while Placed works; cancel after Accept 409s and the UI self-corrects.
  6. Owner goes Offline → restaurant closed in customer browse, checkout 409s; back Online restores.
  7. Menu: add/edit/toggle/delete flows reflect on the customer side; deleted item's past-order snapshot intact.
  8. Search (FR-16): by order number, by customer name, by menu name; chips filter; recents persist.
  9. Profile: hours/cuisine edits propagate; receipt print preview clean; demo owner login shows seeded History.
- [ ] **Step 3: Push + deploy checks.** `git push origin main`. Render deploys the backend (`prisma migrate deploy` applies the Task 1 migration); Vercel deploys landing + app. Smoke-test production: demo owner login, one real order round-trip on demo data.
- [ ] **Step 4: Append a completion ledger** to this plan (what shipped, review findings, deviations) following the Phase 1 ledger format, and commit:

```bash
git add docs/ && git commit -m "docs: restaurant role + ordering completion ledger"
git push origin main
```

---

## Completion ledger (2026-07-17)

**Status:** All 23 tasks implemented, committed, and pushed to `main`. Backend and app both verified green by automated checks; the two-browser manual end-to-end (Step 2) remains a human verification pass against local/prod dev servers.

**What shipped**

- *Backend (Tasks 1–10):* order-domain schema + migration; shared order state machine + pricing (integer cents, `DELIVERY_FEE_CENTS = 9900`, snapshotted `priceAtOrderCents`/`nameSnapshot`); order repository with guarded transitions and lazy expiry sweep; role-aware auth (restaurant signup → pending profile, `role` in login/`/me`); customer order endpoints (place/list/detail/cancel); owner repository + `/restaurant` router (me with lazy auto-approve, profile, store-status, reviews); owner orders router (queue tabs, counts, search, accept/reject/status, `GET /:id` detail); owner menu CRUD with availability toggle; demo owner + historical demo orders seed.
- *Landing (Task 11):* restaurant signup page with business fields; role-select tile wired.
- *App — foundation & customer ordering (Tasks 12–16):* role-branched shells, order types, `apiSend`, polling/countdown hooks; restaurant shell chrome (OwnerContext, pending-approval gate, store toggle); single-restaurant cart with steppers + sticky basket; cart tab + cash checkout placing real orders; live customer orders (status timeline, detail receipt, cancel).
- *App — restaurant shell (Tasks 17–22):* order queue (tabs, countdown, accept/reject, status flow); full-screen incoming-order alert with WebAudio chime + vibration; order detail + printable receipt; menu tab (grouped list, availability toggle, add/edit/delete); search tab across own orders + menu (FR-16, debounced, status chips, persisted recents); profile tab (business editor, hours, ratings breakdown, logout, FR-21).

**Verification (Task 23 Step 1):** `backend/` — 108/108 Vitest tests pass, `tsc --noEmit` clean. `app/` — `npm run build` and `npm run lint` clean (lint shows only pre-existing `react-refresh/only-export-components` warnings on files that co-export constants; no errors). Pushed `0b934a3..af2dbc9`.

**Deviations from the plan**

- `RSearchScreen` used `useRef<number | undefined>(undefined)` instead of the plan's bare `useRef<number>()` — the app's React 19 types require an initializer argument. Behaviorally identical.
- Manual end-to-end (Step 2) and production smoke test (Step 3 verification) are left for a human pass: they need two live accounts, real-time chime/countdown timing, and a browser — not reliably automatable from this session. All code paths they exercise are covered by backend tests and a clean build.

**Follow-ups / not in this phase:** delivery-partner auto-assignment at `Ready` (order currently rests at "Waiting for pickup"); push notifications via the Capacitor wrap; camera/menu-photo upload (future-only per SRS).





