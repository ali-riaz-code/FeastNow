# Customer Role — Phase 1 "Browse" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-13-customer-browse-phase1-design.md`

**Goal:** Ship the customer Browse experience — marketplace schema + seeded demo data + four JWT-protected browse endpoints on the existing Express backend, and a new React+Vite mobile-first SPA at `/app/` with home feed, restaurant detail, and search.

**Architecture:** Backend follows the existing factory-function DI pattern (`createXRouter(deps)` + repository interfaces + fake repos in tests). Three new Prisma models (`RestaurantProfile`, `MenuItem`, `Rating`) power one `restaurantRepository`; four thin routers assemble DTOs. The SPA lives in a new `app/` dir, boots off the same `feastnow_token` localStorage session as the landing pages, and deploys to the same Vercel site via a root build script that assembles `landing/*` + `app/dist` into one output dir.

**Tech Stack:** Node/TS + Express 4 + Prisma 5 + Supabase Postgres (existing) · Vitest + supertest (existing) · React 18 + Vite 5 + TypeScript + react-router-dom 6 (new) · Playwright (new, smoke) · Vercel + Render (existing).

## Global Constraints

- **Money is integer cents (`priceCents`), never floats.** Display via `formatPrice` only.
- **All four new endpoints are JWT-protected** with the existing `createRequireAuth(jwtSecret)` middleware — same 401 behavior as `/api/me`.
- **Seed writes touch only `isDemo: true` rows** — the seed/purge scripts must never be able to delete real data.
- TypeScript strict mode everywhere (both `backend/` and `app/` tsconfigs).
- Backend code style: factory functions with explicit deps objects, `asyncHandler` around async routes, repositories own all Prisma access (routers never import Prisma).
- Design tokens: `app/src/styles/tokens.css` is a value-for-value copy of `landing/assets/css/tokens.css`. **Gold-Is-Rare:** gold only on card rating stars and menu prices. **Tricolore-Means-Status:** basil/tomato only for open/closed, always icon + label + color.
- Typography: Fraunces (serif) for restaurant names only, Space Grotesk for body, **Azeret Mono for all numerics** (ratings, prices, minutes).
- Motion 150–250ms (`--dur-fast`/`--dur`) with `prefers-reduced-motion` fallbacks.
- Fixed API values: home sections limit **10** rows each, "new" window **30 days**, list page size **12**, search/dish limits **10** each, search min query length **2**, detail returns **5** most recent reviews.
- Marketplace timezone for `isOpenNow`: **`Asia/Karachi`** (server runs UTC on Render; hours are local restaurant hours).
- Git: after each verified task, commit with a conventional message and push to `main` (CLAUDE.md rule). Backend pushes auto-deploy Render; pushes touching the site auto-deploy Vercel.
- The repo path contains a space (`...\Feast Now`) — always quote paths in shell commands.

## File Structure

**Backend (create):**
- `backend/src/lib/openHours.ts` — pure `isOpenNow` logic
- `backend/src/lib/restaurantCard.ts` — `RestaurantCardDTO` + mapper
- `backend/src/repositories/restaurantRepository.ts` — interface + Prisma impl
- `backend/src/routes/customerRouter.ts` — `GET /api/customer/home`
- `backend/src/routes/restaurantsRouter.ts` — `GET /api/restaurants`, `GET /api/restaurants/:id`
- `backend/src/routes/searchRouter.ts` — `GET /api/search`
- `backend/prisma/seedData.ts` — deterministic demo data builder (pure, DB-free)
- `backend/prisma/seed.ts`, `backend/prisma/purgeDemo.ts` — apply / hard-purge demo data
- `backend/scripts/measureLatency.ts` — NFR-1 measurement
- `backend/tests/...` — mirrors of each (see tasks)

**Backend (modify):** `backend/prisma/schema.prisma`, `backend/src/app.ts`, `backend/package.json`, `backend/tests/app.test.ts`

**Frontend (create):** `app/` — Vite React TS SPA (structure detailed in Task 12), `scripts/build-site.mjs`, root `vercel.json` + `package.json`

**Frontend (modify):** `landing/assets/js/login.js`, `landing/assets/js/signup.js` (redirect to `/app/`); delete `landing/vercel.json` (config moves to root)

---

### Task 1: Prisma marketplace models

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/purgeDemo.ts`
- Modify: `backend/package.json` (scripts)

**Interfaces:**
- Consumes: existing `User`/`OtpChallenge` schema (untouched).
- Produces: Prisma models `RestaurantProfile`, `MenuItem`, `Rating` with exactly the field names below — every later backend task types against `@prisma/client`'s generated types for these.

**Note on migrations:** this project has **no `prisma/migrations/` directory** — the existing schema was applied with `prisma db push` (Render's `migrate deploy` on start is a no-op). Stay consistent: use `db push` here too. The backend `.env` `DATABASE_URL` points at the shared Supabase database, so pushing locally applies the schema for production as well.

- [ ] **Step 1: Append the three models to `backend/prisma/schema.prisma`**

```prisma
model RestaurantProfile {
  id             String     @id @default(uuid())
  userId         String?    // owner account arrives with the Restaurant role; seeded rows have none
  name           String
  description    String
  address        String
  cuisines       String[]
  opensAt        String     // "HH:mm" 24h local (Asia/Karachi)
  closesAt       String     // "HH:mm"; earlier than opensAt = overnight window
  avgRating      Float      @default(0)
  ratingCount    Int        @default(0)
  estDeliveryMin Int
  orderCount     Int        @default(0)
  approvedAt     DateTime
  heroImageUrl   String
  isActive       Boolean    @default(true)
  isDemo         Boolean    @default(false)
  menuItems      MenuItem[]
  ratings        Rating[]

  @@index([isActive, orderCount])
  @@index([isActive, avgRating])
  @@index([isActive, approvedAt])
  @@index([isActive, estDeliveryMin])
  @@index([cuisines], type: Gin)
}

model MenuItem {
  id           String            @id @default(uuid())
  restaurantId String
  restaurant   RestaurantProfile @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  category     String
  name         String
  description  String
  priceCents   Int               // money is integer cents — Phase 2's price_at_order snapshots from this
  imageUrl     String?
  isAvailable  Boolean           @default(true)
  position     Int               @default(0) // menu display order; category order = first occurrence

  @@index([restaurantId])
  @@index([name])
}

model Rating {
  id           String            @id @default(uuid())
  restaurantId String
  restaurant   RestaurantProfile @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  orderId      String?           // linked to real orders in Phase 3
  stars        Int
  reviewText   String
  authorName   String
  createdAt    DateTime          @default(now())

  @@index([restaurantId, createdAt])
}
```

- [ ] **Step 2: Validate and push the schema**

Run (from `backend/`): `npx prisma validate` → expect `The schema ... is valid`.
Then: `npx prisma db push` → expect `Your database is now in sync with your Prisma schema.` (also regenerates the client).
If `db push` times out against the Supabase pooler, use the direct (non-pooler, IPv4) connection string for this one command — same gotcha as the original setup.

- [ ] **Step 3: Create the hard-purge script `backend/prisma/purgeDemo.ts`**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Pre-launch cleanup (spec §3): hard-deletes isDemo restaurants; MenuItem and
// Rating rows cascade. Only run once no orders reference demo rows.
async function main() {
  const prisma = new PrismaClient();
  const { count } = await prisma.restaurantProfile.deleteMany({ where: { isDemo: true } });
  console.log(`Purged ${count} demo restaurants (menu items and ratings cascaded).`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Add npm scripts to `backend/package.json`**

In `"scripts"`, add:

```json
"seed": "tsx prisma/seed.ts",
"purge:demo": "tsx prisma/purgeDemo.ts"
```

(`seed.ts` arrives in Task 11 — the script entry is inert until then.)

- [ ] **Step 5: Run the full backend suite to confirm nothing broke**

Run (from `backend/`): `npm test`
Expected: all existing tests PASS.

- [ ] **Step 6: Commit and push**

```powershell
git add backend/prisma/schema.prisma backend/prisma/purgeDemo.ts backend/package.json
git commit -m "feat(backend): marketplace schema - RestaurantProfile, MenuItem, Rating"
git push
```

---

### Task 2: `isOpenNow` open-hours logic

**Files:**
- Create: `backend/src/lib/openHours.ts`
- Test: `backend/tests/lib/openHours.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isOpenNow(opensAt: string, closesAt: string, now?: Date, timeZone?: string): boolean` — used by `toRestaurantCard` (Task 3) and the detail route (Task 7). `opensAt === closesAt` means open 24h; `closesAt < opensAt` means an overnight window (e.g. 17:00–02:00). Time-of-day is evaluated in `timeZone` (default `"Asia/Karachi"`) regardless of server timezone.

- [ ] **Step 1: Write the failing test `backend/tests/lib/openHours.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { isOpenNow } from "../../src/lib/openHours";

// Karachi is UTC+5 year-round: 07:00Z = 12:00 PKT, 20:00Z = 01:00 PKT (+1 day).
const at = (utc: string) => new Date(utc);

describe("isOpenNow", () => {
  it("is open strictly inside a same-day window", () => {
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T07:00:00Z"))).toBe(true); // 12:00 PKT
  });

  it("is closed before opening and at/after closing (boundary times)", () => {
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T05:59:00Z"))).toBe(false); // 10:59 PKT
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T06:00:00Z"))).toBe(true);  // 11:00 PKT — opens
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T18:00:00Z"))).toBe(false); // 23:00 PKT — closes
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T17:59:00Z"))).toBe(true);  // 22:59 PKT
  });

  it("handles an overnight window (17:00–02:00)", () => {
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T19:00:00Z"))).toBe(true);  // 00:00 PKT
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T21:00:00Z"))).toBe(false); // 02:00 PKT — closed
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T13:00:00Z"))).toBe(true);  // 18:00 PKT
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T07:00:00Z"))).toBe(false); // 12:00 PKT
  });

  it("treats identical open/close as open 24h", () => {
    expect(isOpenNow("00:00", "00:00", at("2026-07-14T07:00:00Z"))).toBe(true);
    expect(isOpenNow("09:30", "09:30", at("2026-07-14T20:00:00Z"))).toBe(true);
  });

  it("respects an explicit timezone argument", () => {
    // 07:00Z is 07:00 in UTC — before an 11:00 open in UTC, but 12:00 in Karachi.
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T07:00:00Z"), "UTC")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run (from `backend/`): `npx vitest run tests/lib/openHours.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/openHours`.

- [ ] **Step 3: Implement `backend/src/lib/openHours.ts`**

```ts
const MARKETPLACE_TIME_ZONE = "Asia/Karachi";

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDayIn(timeZone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
  const [h, m] = parts.split(":").map(Number);
  return (h % 24) * 60 + m; // en-GB can render midnight as "24:00"
}

/**
 * "HH:mm" local open/close window. Equal open/close = open 24h; close earlier
 * than open = overnight window. Evaluated in the marketplace timezone so the
 * answer doesn't depend on where the server runs.
 */
export function isOpenNow(
  opensAt: string,
  closesAt: string,
  now: Date = new Date(),
  timeZone: string = MARKETPLACE_TIME_ZONE
): boolean {
  const open = parseHHMM(opensAt);
  const close = parseHHMM(closesAt);
  if (open === close) return true;
  const minutes = minutesOfDayIn(timeZone, now);
  if (open < close) return minutes >= open && minutes < close;
  return minutes >= open || minutes < close;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/openHours.test.ts` → Expected: 5 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/lib/openHours.ts backend/tests/lib/openHours.test.ts
git commit -m "feat(backend): isOpenNow open-hours logic with overnight windows"
git push
```

---

### Task 3: `RestaurantCardDTO` mapper

**Files:**
- Create: `backend/src/lib/restaurantCard.ts`
- Test: `backend/tests/lib/restaurantCard.test.ts`

**Interfaces:**
- Consumes: `isOpenNow` from Task 2; `RestaurantProfile` from `@prisma/client` (Task 1).
- Produces:
  ```ts
  export interface RestaurantCardDTO {
    id: string; name: string; cuisines: string[]; avgRating: number;
    ratingCount: number; estDeliveryMin: number; heroImageUrl: string; isOpenNow: boolean;
  }
  export function toRestaurantCard(r: RestaurantProfile, now?: Date): RestaurantCardDTO;
  ```
  Used by all three routers (Tasks 5, 6, 8).

- [ ] **Step 1: Write the failing test `backend/tests/lib/restaurantCard.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import type { RestaurantProfile } from "@prisma/client";
import { toRestaurantCard } from "../../src/lib/restaurantCard";

const profile: RestaurantProfile = {
  id: "r1", userId: null, name: "Karahi Khaas", description: "Wood-fired karahi.",
  address: "12 Mall Road, Lahore", cuisines: ["Pakistani", "BBQ"],
  opensAt: "00:00", closesAt: "00:00", avgRating: 4.7, ratingCount: 8,
  estDeliveryMin: 25, orderCount: 900, approvedAt: new Date("2026-06-01T00:00:00Z"),
  heroImageUrl: "https://example.com/hero.jpg", isActive: true, isDemo: true,
};

describe("toRestaurantCard", () => {
  it("maps exactly the card fields and computes isOpenNow", () => {
    const card = toRestaurantCard(profile, new Date("2026-07-14T07:00:00Z"));
    expect(card).toEqual({
      id: "r1", name: "Karahi Khaas", cuisines: ["Pakistani", "BBQ"],
      avgRating: 4.7, ratingCount: 8, estDeliveryMin: 25,
      heroImageUrl: "https://example.com/hero.jpg", isOpenNow: true,
    });
  });

  it("reports closed restaurants via isOpenNow", () => {
    const closed = { ...profile, opensAt: "11:00", closesAt: "23:00" };
    // 05:00Z = 10:00 PKT — before opening
    expect(toRestaurantCard(closed, new Date("2026-07-14T05:00:00Z")).isOpenNow).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run tests/lib/restaurantCard.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/src/lib/restaurantCard.ts`**

```ts
import type { RestaurantProfile } from "@prisma/client";
import { isOpenNow } from "./openHours";

export interface RestaurantCardDTO {
  id: string;
  name: string;
  cuisines: string[];
  avgRating: number;
  ratingCount: number;
  estDeliveryMin: number;
  heroImageUrl: string;
  isOpenNow: boolean;
}

export function toRestaurantCard(r: RestaurantProfile, now: Date = new Date()): RestaurantCardDTO {
  return {
    id: r.id,
    name: r.name,
    cuisines: r.cuisines,
    avgRating: r.avgRating,
    ratingCount: r.ratingCount,
    estDeliveryMin: r.estDeliveryMin,
    heroImageUrl: r.heroImageUrl,
    isOpenNow: isOpenNow(r.opensAt, r.closesAt, now),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/restaurantCard.test.ts` → Expected: 2 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/lib/restaurantCard.ts backend/tests/lib/restaurantCard.test.ts
git commit -m "feat(backend): RestaurantCardDTO mapper"
git push
```

---

### Task 4: Restaurant repository + fake test helper

**Files:**
- Create: `backend/src/repositories/restaurantRepository.ts`
- Create: `backend/tests/test-helpers/fakeRestaurantRepository.ts`

**Interfaces:**
- Consumes: Prisma models from Task 1.
- Produces (both files export/implement this — the fake mirrors the Prisma semantics exactly):
  ```ts
  export type RestaurantSort = "popular" | "rating" | "delivery_time";
  export interface RestaurantListParams {
    search?: string; cuisine?: string; sort: RestaurantSort; page: number; pageSize: number;
  }
  export type RestaurantDetail = RestaurantProfile & { menuItems: MenuItem[]; recentRatings: Rating[] };
  export type DishHit = MenuItem & { restaurant: { id: string; name: string } };
  export interface RestaurantRepository {
    findMostPopular(limit: number): Promise<RestaurantProfile[]>;
    findTopRated(limit: number): Promise<RestaurantProfile[]>;
    findNewSince(since: Date, limit: number): Promise<RestaurantProfile[]>;
    findUnder30(limit: number): Promise<RestaurantProfile[]>;
    listCuisines(): Promise<string[]>;
    list(params: RestaurantListParams): Promise<{ restaurants: RestaurantProfile[]; total: number }>;
    findDetailById(id: string): Promise<RestaurantDetail | null>;
    searchRestaurants(q: string, limit: number): Promise<RestaurantProfile[]>;
    searchDishes(q: string, limit: number): Promise<DishHit[]>;
  }
  export function createRestaurantRepository(prisma: PrismaClient): RestaurantRepository;
  ```
- The fake also exports builders used by every router test:
  ```ts
  export function makeRestaurant(overrides?: Partial<RestaurantProfile>): RestaurantProfile;
  export function makeMenuItem(restaurantId: string, overrides?: Partial<MenuItem>): MenuItem;
  export function makeRating(restaurantId: string, overrides?: Partial<Rating>): Rating;
  export interface FakeRestaurantData { profile: RestaurantProfile; menuItems?: MenuItem[]; ratings?: Rating[]; }
  export function createFakeRestaurantRepository(data?: FakeRestaurantData[]): RestaurantRepository;
  ```

Like `userRepository`, the Prisma implementation is a thin query layer with no unit test of its own — behavior is exercised through router tests (against the fake) and end-to-end against the seeded DB (Tasks 20–21). There is no test DB in this project's test environment.

- [ ] **Step 1: Implement `backend/src/repositories/restaurantRepository.ts`**

```ts
import type { PrismaClient, Prisma, RestaurantProfile, MenuItem, Rating } from "@prisma/client";

export type RestaurantSort = "popular" | "rating" | "delivery_time";

export interface RestaurantListParams {
  search?: string;
  cuisine?: string;
  sort: RestaurantSort;
  page: number;
  pageSize: number;
}

export type RestaurantDetail = RestaurantProfile & { menuItems: MenuItem[]; recentRatings: Rating[] };
export type DishHit = MenuItem & { restaurant: { id: string; name: string } };

export interface RestaurantRepository {
  findMostPopular(limit: number): Promise<RestaurantProfile[]>;
  findTopRated(limit: number): Promise<RestaurantProfile[]>;
  findNewSince(since: Date, limit: number): Promise<RestaurantProfile[]>;
  findUnder30(limit: number): Promise<RestaurantProfile[]>;
  listCuisines(): Promise<string[]>;
  list(params: RestaurantListParams): Promise<{ restaurants: RestaurantProfile[]; total: number }>;
  findDetailById(id: string): Promise<RestaurantDetail | null>;
  searchRestaurants(q: string, limit: number): Promise<RestaurantProfile[]>;
  searchDishes(q: string, limit: number): Promise<DishHit[]>;
}

const ACTIVE = { isActive: true } as const;

const LIST_ORDER: Record<RestaurantSort, Prisma.RestaurantProfileOrderByWithRelationInput[]> = {
  popular: [{ orderCount: "desc" }, { name: "asc" }],
  rating: [{ avgRating: "desc" }, { ratingCount: "desc" }, { name: "asc" }],
  delivery_time: [{ estDeliveryMin: "asc" }, { orderCount: "desc" }, { name: "asc" }],
};

export function createRestaurantRepository(prisma: PrismaClient): RestaurantRepository {
  return {
    findMostPopular(limit) {
      return prisma.restaurantProfile.findMany({
        where: ACTIVE, orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    findTopRated(limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, ratingCount: { gt: 0 } },
        orderBy: [{ avgRating: "desc" }, { ratingCount: "desc" }, { name: "asc" }],
        take: limit,
      });
    },
    findNewSince(since, limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, approvedAt: { gte: since } },
        orderBy: { approvedAt: "desc" }, take: limit,
      });
    },
    findUnder30(limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, estDeliveryMin: { lte: 30 } },
        orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    async listCuisines() {
      const rows = await prisma.restaurantProfile.findMany({
        where: ACTIVE, select: { cuisines: true },
      });
      return [...new Set(rows.flatMap((r) => r.cuisines))].sort();
    },
    async list(params) {
      const where: Prisma.RestaurantProfileWhereInput = { ...ACTIVE };
      if (params.search) where.name = { contains: params.search, mode: "insensitive" };
      if (params.cuisine) where.cuisines = { has: params.cuisine };
      const [restaurants, total] = await Promise.all([
        prisma.restaurantProfile.findMany({
          where, orderBy: LIST_ORDER[params.sort],
          skip: (params.page - 1) * params.pageSize, take: params.pageSize,
        }),
        prisma.restaurantProfile.count({ where }),
      ]);
      return { restaurants, total };
    },
    async findDetailById(id) {
      const row = await prisma.restaurantProfile.findFirst({
        where: { id, ...ACTIVE },
        include: {
          menuItems: { orderBy: { position: "asc" } },
          ratings: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      if (!row) return null;
      const { ratings, ...rest } = row;
      return { ...rest, recentRatings: ratings };
    },
    searchRestaurants(q, limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, name: { contains: q, mode: "insensitive" } },
        orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    searchDishes(q, limit) {
      return prisma.menuItem.findMany({
        where: { name: { contains: q, mode: "insensitive" }, restaurant: ACTIVE },
        include: { restaurant: { select: { id: true, name: true } } },
        orderBy: { name: "asc" }, take: limit,
      });
    },
  };
}
```

Known limitation (matches spec): restaurant search matches **name only**; cuisine discovery happens via the chip filter, and cuisine-flavored queries ("pizza") still hit via dish names.

- [ ] **Step 2: Implement `backend/tests/test-helpers/fakeRestaurantRepository.ts`**

```ts
import type { MenuItem, Rating, RestaurantProfile } from "@prisma/client";
import type {
  DishHit, RestaurantDetail, RestaurantListParams, RestaurantRepository,
} from "../../src/repositories/restaurantRepository";

let seq = 0;

export function makeRestaurant(overrides: Partial<RestaurantProfile> = {}): RestaurantProfile {
  seq += 1;
  return {
    id: `rest-${seq}`, userId: null, name: `Restaurant ${seq}`,
    description: "A demo restaurant.", address: "1 Demo Street, Karachi",
    cuisines: ["Pakistani"], opensAt: "00:00", closesAt: "00:00", // 24h → isOpenNow true in tests
    avgRating: 4.2, ratingCount: 10, estDeliveryMin: 25, orderCount: 100,
    approvedAt: new Date("2026-01-01T00:00:00Z"),
    heroImageUrl: "https://example.com/hero.jpg", isActive: true, isDemo: true,
    ...overrides,
  };
}

export function makeMenuItem(restaurantId: string, overrides: Partial<MenuItem> = {}): MenuItem {
  seq += 1;
  return {
    id: `item-${seq}`, restaurantId, category: "Mains", name: `Dish ${seq}`,
    description: "Tasty.", priceCents: 45000, imageUrl: null, isAvailable: true,
    position: seq, ...overrides,
  };
}

export function makeRating(restaurantId: string, overrides: Partial<Rating> = {}): Rating {
  seq += 1;
  return {
    id: `rating-${seq}`, restaurantId, orderId: null, stars: 4,
    reviewText: "Great food.", authorName: "Demo Reviewer",
    createdAt: new Date("2026-06-01T00:00:00Z"), ...overrides,
  };
}

export interface FakeRestaurantData {
  profile: RestaurantProfile;
  menuItems?: MenuItem[];
  ratings?: Rating[];
}

export function createFakeRestaurantRepository(data: FakeRestaurantData[] = []): RestaurantRepository {
  const active = () => data.map((d) => d.profile).filter((p) => p.isActive);
  const byName = (a: RestaurantProfile, b: RestaurantProfile) => a.name.localeCompare(b.name);

  return {
    async findMostPopular(limit) {
      return [...active()].sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async findTopRated(limit) {
      return active().filter((p) => p.ratingCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount || byName(a, b))
        .slice(0, limit);
    },
    async findNewSince(since, limit) {
      return active().filter((p) => p.approvedAt >= since)
        .sort((a, b) => +b.approvedAt - +a.approvedAt).slice(0, limit);
    },
    async findUnder30(limit) {
      return active().filter((p) => p.estDeliveryMin <= 30)
        .sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async listCuisines() {
      return [...new Set(active().flatMap((p) => p.cuisines))].sort();
    },
    async list(params: RestaurantListParams) {
      let rows = active();
      if (params.search) {
        const s = params.search.toLowerCase();
        rows = rows.filter((p) => p.name.toLowerCase().includes(s));
      }
      if (params.cuisine) rows = rows.filter((p) => p.cuisines.includes(params.cuisine!));
      rows = [...rows].sort((a, b) => {
        if (params.sort === "rating") return b.avgRating - a.avgRating || b.ratingCount - a.ratingCount || byName(a, b);
        if (params.sort === "delivery_time") return a.estDeliveryMin - b.estDeliveryMin || b.orderCount - a.orderCount || byName(a, b);
        return b.orderCount - a.orderCount || byName(a, b);
      });
      const start = (params.page - 1) * params.pageSize;
      return { restaurants: rows.slice(start, start + params.pageSize), total: rows.length };
    },
    async findDetailById(id): Promise<RestaurantDetail | null> {
      const d = data.find((x) => x.profile.id === id && x.profile.isActive);
      if (!d) return null;
      const menuItems = [...(d.menuItems ?? [])].sort((a, b) => a.position - b.position);
      const recentRatings = [...(d.ratings ?? [])]
        .sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5);
      return { ...d.profile, menuItems, recentRatings };
    },
    async searchRestaurants(q, limit) {
      const s = q.toLowerCase();
      return active().filter((p) => p.name.toLowerCase().includes(s))
        .sort((a, b) => b.orderCount - a.orderCount || byName(a, b)).slice(0, limit);
    },
    async searchDishes(q, limit) {
      const s = q.toLowerCase();
      const hits: DishHit[] = [];
      for (const d of data) {
        if (!d.profile.isActive) continue;
        for (const m of d.menuItems ?? []) {
          if (m.name.toLowerCase().includes(s)) {
            hits.push({ ...m, restaurant: { id: d.profile.id, name: d.profile.name } });
          }
        }
      }
      return hits.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no errors. (If `Prisma.RestaurantProfileOrderByWithRelationInput` is unresolved, re-run `npx prisma generate`.)

- [ ] **Step 4: Commit and push**

```powershell
git add backend/src/repositories/restaurantRepository.ts backend/tests/test-helpers/fakeRestaurantRepository.ts
git commit -m "feat(backend): restaurant repository with fake test double"
git push
```

---

### Task 5: `GET /api/customer/home` — feed sections

**Files:**
- Create: `backend/src/routes/customerRouter.ts`
- Test: `backend/tests/routes/customerRouter.test.ts`

**Interfaces:**
- Consumes: `RestaurantRepository` (Task 4), `toRestaurantCard` (Task 3), `createRequireAuth`, `asyncHandler`, `signToken` (existing).
- Produces: `createCustomerRouter(deps: { restaurantRepo: RestaurantRepository; jwtSecret: string }): Router` mounted at `/api/customer` (Task 9). Response shape (consumed by the SPA in Task 15):
  ```json
  { "cuisines": ["BBQ", "Pakistani"],
    "sections": [{ "key": "most_popular", "title": "Most Popular Near You", "restaurants": [/* RestaurantCardDTO */] }] }
  ```
  Section order: `most_popular`, `top_rated`, `new_on_feastnow`, `under_30`. Empty sections are omitted. 10 restaurants max per section; "new" = approved within the last 30 days.

- [ ] **Step 1: Write the failing test `backend/tests/routes/customerRouter.test.ts`**

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createCustomerRouter } from "../../src/routes/customerRouter";
import { createFakeRestaurantRepository, makeRestaurant } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/customer", createCustomerRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

describe("GET /api/customer/home", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).get("/api/customer/home");
    expect(res.status).toBe(401);
  });

  it("returns ordered sections of RestaurantCardDTOs plus the cuisine list", async () => {
    const popular = makeRestaurant({ name: "Popular Place", orderCount: 999, avgRating: 4.9, estDeliveryMin: 20, approvedAt: daysAgo(5), cuisines: ["BBQ"] });
    const old = makeRestaurant({ name: "Old Slow Place", orderCount: 10, avgRating: 3.1, estDeliveryMin: 55, approvedAt: daysAgo(200), cuisines: ["Pakistani"] });
    const res = await request(buildApp([{ profile: popular }, { profile: old }]))
      .get("/api/customer/home").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.cuisines).toEqual(["BBQ", "Pakistani"]);
    expect(res.body.sections.map((s: { key: string }) => s.key))
      .toEqual(["most_popular", "top_rated", "new_on_feastnow", "under_30"]);
    const mostPopular = res.body.sections[0];
    expect(mostPopular.title).toBe("Most Popular Near You");
    expect(mostPopular.restaurants[0]).toEqual({
      id: popular.id, name: "Popular Place", cuisines: ["BBQ"], avgRating: 4.9,
      ratingCount: popular.ratingCount, estDeliveryMin: 20,
      heroImageUrl: popular.heroImageUrl, isOpenNow: true,
    });
    // new_on_feastnow contains only the recently approved restaurant
    const fresh = res.body.sections.find((s: { key: string }) => s.key === "new_on_feastnow");
    expect(fresh.restaurants.map((r: { id: string }) => r.id)).toEqual([popular.id]);
    // under_30 excludes the 55-minute restaurant
    const under30 = res.body.sections.find((s: { key: string }) => s.key === "under_30");
    expect(under30.restaurants.map((r: { id: string }) => r.id)).toEqual([popular.id]);
  });

  it("omits sections with no data instead of sending empty rows", async () => {
    // Unrated, slow, old restaurant → only most_popular qualifies
    const lone = makeRestaurant({ ratingCount: 0, estDeliveryMin: 45, approvedAt: daysAgo(300) });
    const res = await request(buildApp([{ profile: lone }])).get("/api/customer/home").set(auth);
    expect(res.body.sections.map((s: { key: string }) => s.key)).toEqual(["most_popular"]);
  });

  it("hides inactive (retired demo) restaurants everywhere", async () => {
    const retired = makeRestaurant({ isActive: false });
    const res = await request(buildApp([{ profile: retired }])).get("/api/customer/home").set(auth);
    expect(res.body.sections).toEqual([]);
    expect(res.body.cuisines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run tests/routes/customerRouter.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/src/routes/customerRouter.ts`**

```ts
import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface CustomerRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const SECTION_LIMIT = 10;
const NEW_WINDOW_DAYS = 30;

export function createCustomerRouter(deps: CustomerRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/home", requireAuth, asyncHandler(async (_req, res) => {
    const now = new Date();
    const since = new Date(now.getTime() - NEW_WINDOW_DAYS * 86_400_000);
    const [mostPopular, topRated, freshlyApproved, under30, cuisines] = await Promise.all([
      repo.findMostPopular(SECTION_LIMIT),
      repo.findTopRated(SECTION_LIMIT),
      repo.findNewSince(since, SECTION_LIMIT),
      repo.findUnder30(SECTION_LIMIT),
      repo.listCuisines(),
    ]);

    const sections = [
      { key: "most_popular", title: "Most Popular Near You", rows: mostPopular },
      { key: "top_rated", title: "Top Rated", rows: topRated },
      { key: "new_on_feastnow", title: "New on FeastNow", rows: freshlyApproved },
      { key: "under_30", title: "Under 30 Minutes", rows: under30 },
    ]
      .filter((s) => s.rows.length > 0)
      .map((s) => ({ key: s.key, title: s.title, restaurants: s.rows.map((r) => toRestaurantCard(r, now)) }));

    return res.status(200).json({ cuisines, sections });
  }));

  return router;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/routes/customerRouter.test.ts` → Expected: 4 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/routes/customerRouter.ts backend/tests/routes/customerRouter.test.ts
git commit -m "feat(backend): GET /api/customer/home feed sections endpoint"
git push
```

---

### Task 6: `GET /api/restaurants` — paginated list

**Files:**
- Create: `backend/src/routes/restaurantsRouter.ts`
- Test: `backend/tests/routes/restaurantsRouter.test.ts`

**Interfaces:**
- Consumes: `RestaurantRepository.list` (Task 4), `toRestaurantCard` (Task 3).
- Produces: `createRestaurantsRouter(deps: { restaurantRepo: RestaurantRepository; jwtSecret: string }): Router` mounted at `/api/restaurants` (Task 9). Query params: `search`, `cuisine`, `sort` (`popular` default | `rating` | `delivery_time`), `page` (default 1). Response:
  ```json
  { "restaurants": [/* RestaurantCardDTO */], "page": 1, "pageSize": 12, "total": 20 }
  ```
  The `/:id` detail route is added to **this same file** in Task 7.

- [ ] **Step 1: Write the failing test `backend/tests/routes/restaurantsRouter.test.ts`**

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createRestaurantsRouter } from "../../src/routes/restaurantsRouter";
import { createFakeRestaurantRepository, makeRestaurant } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/restaurants", createRestaurantsRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

describe("GET /api/restaurants", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).get("/api/restaurants");
    expect(res.status).toBe(401);
  });

  it("defaults to popular sort, page 1, pageSize 12 and returns card DTOs", async () => {
    const data = Array.from({ length: 15 }, (_, i) =>
      ({ profile: makeRestaurant({ orderCount: 1000 - i }) }));
    const res = await request(buildApp(data)).get("/api/restaurants").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(12);
    expect(res.body.total).toBe(15);
    expect(res.body.restaurants).toHaveLength(12);
    expect(res.body.restaurants[0].id).toBe(data[0].profile.id); // highest orderCount first
    expect(res.body.restaurants[0]).toHaveProperty("isOpenNow", true);
  });

  it("paginates", async () => {
    const data = Array.from({ length: 15 }, (_, i) =>
      ({ profile: makeRestaurant({ orderCount: 1000 - i }) }));
    const res = await request(buildApp(data)).get("/api/restaurants?page=2").set(auth);
    expect(res.body.page).toBe(2);
    expect(res.body.restaurants).toHaveLength(3);
  });

  it("filters by search and cuisine together", async () => {
    const bbqPit = makeRestaurant({ name: "Smoky BBQ Pit", cuisines: ["BBQ"] });
    const bbqShack = makeRestaurant({ name: "Grill Shack", cuisines: ["BBQ"] });
    const pizza = makeRestaurant({ name: "Smoky Pizza", cuisines: ["Pizza"] });
    const res = await request(buildApp([{ profile: bbqPit }, { profile: bbqShack }, { profile: pizza }]))
      .get("/api/restaurants?search=smoky&cuisine=BBQ").set(auth);
    expect(res.body.restaurants.map((r: { id: string }) => r.id)).toEqual([bbqPit.id]);
  });

  it("sorts by rating and delivery_time", async () => {
    const best = makeRestaurant({ avgRating: 4.9, estDeliveryMin: 50 });
    const fastest = makeRestaurant({ avgRating: 3.5, estDeliveryMin: 15 });
    const data = [{ profile: best }, { profile: fastest }];
    const byRating = await request(buildApp(data)).get("/api/restaurants?sort=rating").set(auth);
    expect(byRating.body.restaurants[0].id).toBe(best.id);
    const bySpeed = await request(buildApp(data)).get("/api/restaurants?sort=delivery_time").set(auth);
    expect(bySpeed.body.restaurants[0].id).toBe(fastest.id);
  });

  it("rejects bad sort/page values with 400", async () => {
    expect((await request(buildApp()).get("/api/restaurants?sort=cheapest").set(auth)).status).toBe(400);
    expect((await request(buildApp()).get("/api/restaurants?page=0").set(auth)).status).toBe(400);
    expect((await request(buildApp()).get("/api/restaurants?page=abc").set(auth)).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run tests/routes/restaurantsRouter.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/src/routes/restaurantsRouter.ts`**

```ts
import { Router } from "express";
import type { RestaurantRepository, RestaurantSort } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface RestaurantsRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const PAGE_SIZE = 12;
const SORTS: RestaurantSort[] = ["popular", "rating", "delivery_time"];

export function createRestaurantsRouter(deps: RestaurantsRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/", requireAuth, asyncHandler(async (req, res) => {
    const sort = (req.query.sort ?? "popular") as string;
    if (!SORTS.includes(sort as RestaurantSort)) {
      return res.status(400).json({ error: "sort must be one of: popular, rating, delivery_time." });
    }
    const rawPage = req.query.page ?? "1";
    const page = Number(rawPage);
    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: "page must be a positive integer." });
    }
    const search = typeof req.query.search === "string" && req.query.search.trim() !== ""
      ? req.query.search.trim() : undefined;
    const cuisine = typeof req.query.cuisine === "string" && req.query.cuisine.trim() !== ""
      ? req.query.cuisine.trim() : undefined;

    const now = new Date();
    const { restaurants, total } = await repo.list({
      search, cuisine, sort: sort as RestaurantSort, page, pageSize: PAGE_SIZE,
    });
    return res.status(200).json({
      restaurants: restaurants.map((r) => toRestaurantCard(r, now)),
      page, pageSize: PAGE_SIZE, total,
    });
  }));

  return router;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/routes/restaurantsRouter.test.ts` → Expected: 6 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/routes/restaurantsRouter.ts backend/tests/routes/restaurantsRouter.test.ts
git commit -m "feat(backend): GET /api/restaurants paginated list endpoint"
git push
```

---

### Task 7: `GET /api/restaurants/:id` — detail with grouped menu + reviews

**Files:**
- Modify: `backend/src/routes/restaurantsRouter.ts` (add the `/:id` route)
- Test: `backend/tests/routes/restaurantsRouter.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `RestaurantRepository.findDetailById` (Task 4), `isOpenNow` (Task 2).
- Produces: `GET /api/restaurants/:id` response (consumed by the SPA in Task 16):
  ```json
  { "id": "...", "name": "...", "description": "...", "address": "...", "cuisines": ["..."],
    "avgRating": 4.5, "ratingCount": 8, "estDeliveryMin": 25, "heroImageUrl": "...",
    "opensAt": "11:00", "closesAt": "23:00", "isOpenNow": true,
    "menu": [{ "category": "Starters", "items": [{ "id": "...", "name": "...", "description": "...", "priceCents": 45000, "imageUrl": null, "isAvailable": true }] }],
    "reviews": [{ "id": "...", "stars": 5, "reviewText": "...", "authorName": "...", "createdAt": "..." }] }
  ```
  Menu categories appear in **first-occurrence order of `position`-sorted items** (not alphabetical). `reviews` = 5 most recent; the client uses `ratingCount` as the total for "See all". Unknown or `isActive: false` ids → 404.

- [ ] **Step 1: Append the failing tests to `backend/tests/routes/restaurantsRouter.test.ts`**

Add imports `makeMenuItem, makeRating` to the existing test-helper import, then append:

```ts
describe("GET /api/restaurants/:id", () => {
  it("returns profile, menu grouped by category in position order, and recent reviews", async () => {
    const r = makeRestaurant({ name: "Karahi Khaas", opensAt: "00:00", closesAt: "00:00" });
    const menuItems = [
      makeMenuItem(r.id, { category: "Starters", name: "Samosa", position: 1 }),
      makeMenuItem(r.id, { category: "Mains", name: "Karahi", position: 2 }),
      makeMenuItem(r.id, { category: "Starters", name: "Kebab", position: 3 }),
    ];
    const ratings = Array.from({ length: 6 }, (_, i) =>
      makeRating(r.id, { stars: 5, createdAt: new Date(2026, 0, i + 1) }));
    const res = await request(buildApp([{ profile: r, menuItems, ratings }]))
      .get(`/api/restaurants/${r.id}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Karahi Khaas");
    expect(res.body.isOpenNow).toBe(true);
    expect(res.body.menu.map((g: { category: string }) => g.category)).toEqual(["Starters", "Mains"]);
    expect(res.body.menu[0].items.map((i: { name: string }) => i.name)).toEqual(["Samosa", "Kebab"]);
    expect(res.body.menu[0].items[0]).toEqual({
      id: menuItems[0].id, name: "Samosa", description: "Tasty.",
      priceCents: 45000, imageUrl: null, isAvailable: true,
    });
    expect(res.body.reviews).toHaveLength(5); // capped at 5 most recent
    expect(new Date(res.body.reviews[0].createdAt).getTime())
      .toBeGreaterThan(new Date(res.body.reviews[4].createdAt).getTime());
  });

  it("404s for unknown and inactive restaurants", async () => {
    const retired = makeRestaurant({ isActive: false });
    const app = buildApp([{ profile: retired }]);
    expect((await request(app).get("/api/restaurants/nope").set(auth)).status).toBe(404);
    expect((await request(app).get(`/api/restaurants/${retired.id}`).set(auth)).status).toBe(404);
  });

  it("requires auth", async () => {
    expect((await request(buildApp()).get("/api/restaurants/x")).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/routes/restaurantsRouter.test.ts` → Expected: the 3 new tests FAIL (404 route missing / 200 shape mismatch), the 6 existing ones still pass.

- [ ] **Step 3: Add the route to `backend/src/routes/restaurantsRouter.ts`**

Add `MenuItem` to imports: `import type { MenuItem } from "@prisma/client";` and `import { isOpenNow } from "../lib/openHours";`. Then, inside `createRestaurantsRouter` **after** the `"/"` route:

```ts
router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const detail = await repo.findDetailById(req.params.id);
  if (!detail) {
    return res.status(404).json({ error: "Restaurant not found." });
  }
  return res.status(200).json({
    id: detail.id, name: detail.name, description: detail.description,
    address: detail.address, cuisines: detail.cuisines,
    avgRating: detail.avgRating, ratingCount: detail.ratingCount,
    estDeliveryMin: detail.estDeliveryMin, heroImageUrl: detail.heroImageUrl,
    opensAt: detail.opensAt, closesAt: detail.closesAt,
    isOpenNow: isOpenNow(detail.opensAt, detail.closesAt),
    menu: groupMenu(detail.menuItems),
    reviews: detail.recentRatings.map((rt) => ({
      id: rt.id, stars: rt.stars, reviewText: rt.reviewText,
      authorName: rt.authorName, createdAt: rt.createdAt,
    })),
  });
}));
```

And at module level (below the router factory):

```ts
interface MenuItemDTO {
  id: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean;
}

// Items arrive position-sorted; categories keep first-occurrence order.
function groupMenu(items: MenuItem[]): { category: string; items: MenuItemDTO[] }[] {
  const groups: { category: string; items: MenuItemDTO[] }[] = [];
  const byCategory = new Map<string, MenuItemDTO[]>();
  for (const item of items) {
    let bucket = byCategory.get(item.category);
    if (!bucket) {
      bucket = [];
      byCategory.set(item.category, bucket);
      groups.push({ category: item.category, items: bucket });
    }
    bucket.push({
      id: item.id, name: item.name, description: item.description,
      priceCents: item.priceCents, imageUrl: item.imageUrl, isAvailable: item.isAvailable,
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run the file's tests to verify all pass**

Run: `npx vitest run tests/routes/restaurantsRouter.test.ts` → Expected: 9 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/routes/restaurantsRouter.ts backend/tests/routes/restaurantsRouter.test.ts
git commit -m "feat(backend): GET /api/restaurants/:id detail with grouped menu and reviews"
git push
```

---

### Task 8: `GET /api/search` — grouped live search

**Files:**
- Create: `backend/src/routes/searchRouter.ts`
- Test: `backend/tests/routes/searchRouter.test.ts`

**Interfaces:**
- Consumes: `RestaurantRepository.searchRestaurants` / `.searchDishes` (Task 4), `toRestaurantCard` (Task 3).
- Produces: `createSearchRouter(deps: { restaurantRepo: RestaurantRepository; jwtSecret: string }): Router` mounted at `/api/search` (Task 9). `GET /api/search?q=`:
  ```json
  { "restaurants": [/* RestaurantCardDTO */],
    "dishes": [{ "id": "...", "name": "...", "priceCents": 42000, "imageUrl": null,
                 "isAvailable": true, "restaurantId": "...", "restaurantName": "..." }] }
  ```
  `q` trimmed; fewer than 2 chars → both arrays empty (200). Limits: 10 restaurants, 10 dishes.

- [ ] **Step 1: Write the failing test `backend/tests/routes/searchRouter.test.ts`**

```ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createSearchRouter } from "../../src/routes/searchRouter";
import { createFakeRestaurantRepository, makeRestaurant, makeMenuItem } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/search", createSearchRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

describe("GET /api/search", () => {
  it("requires auth", async () => {
    expect((await request(buildApp()).get("/api/search?q=biryani")).status).toBe(401);
  });

  it("groups matches into restaurants and dishes; dish hits carry their restaurant", async () => {
    const adda = makeRestaurant({ name: "Biryani Adda" });
    const karahi = makeRestaurant({ name: "Karahi Khaas" });
    const dish = makeMenuItem(karahi.id, { name: "Chicken Biryani", priceCents: 42000 });
    const res = await request(buildApp([
      { profile: adda }, { profile: karahi, menuItems: [dish] },
    ])).get("/api/search?q=biryani").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.restaurants.map((r: { id: string }) => r.id)).toEqual([adda.id]);
    expect(res.body.restaurants[0]).toHaveProperty("isOpenNow");
    expect(res.body.dishes).toEqual([{
      id: dish.id, name: "Chicken Biryani", priceCents: 42000, imageUrl: null,
      isAvailable: true, restaurantId: karahi.id, restaurantName: "Karahi Khaas",
    }]);
  });

  it("returns empty groups for queries shorter than 2 chars", async () => {
    const res = await request(buildApp([{ profile: makeRestaurant() }]))
      .get("/api/search?q=%20b%20").set(auth); // " b " trims to 1 char
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurants: [], dishes: [] });
  });

  it("returns empty groups when nothing matches", async () => {
    const res = await request(buildApp([{ profile: makeRestaurant({ name: "Karahi Khaas" }) }]))
      .get("/api/search?q=sushi").set(auth);
    expect(res.body).toEqual({ restaurants: [], dishes: [] });
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run tests/routes/searchRouter.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/src/routes/searchRouter.ts`**

```ts
import { Router } from "express";
import type { RestaurantRepository } from "../repositories/restaurantRepository";
import { toRestaurantCard } from "../lib/restaurantCard";
import { createRequireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../middleware/asyncHandler";

export interface SearchRouterDeps {
  restaurantRepo: RestaurantRepository;
  jwtSecret: string;
}

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 10;

export function createSearchRouter(deps: SearchRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);
  const repo = deps.restaurantRepo;

  router.get("/", requireAuth, asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < MIN_QUERY_LENGTH) {
      return res.status(200).json({ restaurants: [], dishes: [] });
    }
    const now = new Date();
    const [restaurants, dishes] = await Promise.all([
      repo.searchRestaurants(q, RESULT_LIMIT),
      repo.searchDishes(q, RESULT_LIMIT),
    ]);
    return res.status(200).json({
      restaurants: restaurants.map((r) => toRestaurantCard(r, now)),
      dishes: dishes.map((d) => ({
        id: d.id, name: d.name, priceCents: d.priceCents, imageUrl: d.imageUrl,
        isAvailable: d.isAvailable, restaurantId: d.restaurant.id, restaurantName: d.restaurant.name,
      })),
    });
  }));

  return router;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/routes/searchRouter.test.ts` → Expected: 4 passed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/routes/searchRouter.ts backend/tests/routes/searchRouter.test.ts
git commit -m "feat(backend): GET /api/search grouped restaurant and dish search"
git push
```

---

### Task 9: Wire the browse routers into the app

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/tests/app.test.ts` (append cases)

**Interfaces:**
- Consumes: `createRestaurantRepository` (Task 4), the three router factories (Tasks 5–8). `AppConfig` is unchanged.
- Produces: live paths `/api/customer/home`, `/api/restaurants`, `/api/restaurants/:id`, `/api/search` on the deployed app.

- [ ] **Step 1: Append failing tests to `backend/tests/app.test.ts`**

Inside the existing `describe("createApp", ...)`:

```ts
it("mounts the browse endpoints and requires auth on each", async () => {
  for (const path of ["/api/customer/home", "/api/restaurants", "/api/restaurants/some-id", "/api/search?q=pizza"]) {
    const res = await request(app).get(path);
    expect(res.status, path).toBe(401);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/app.test.ts` → Expected: new test FAILS (404s instead of 401s).

- [ ] **Step 3: Wire the routers in `backend/src/app.ts`**

Add imports:

```ts
import { createRestaurantRepository } from "./repositories/restaurantRepository";
import { createCustomerRouter } from "./routes/customerRouter";
import { createRestaurantsRouter } from "./routes/restaurantsRouter";
import { createSearchRouter } from "./routes/searchRouter";
```

After the existing `otpRepo` line add `const restaurantRepo = createRestaurantRepository(config.prisma);`, and after the `/api/me` mount:

```ts
app.use("/api/customer", createCustomerRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
app.use("/api/restaurants", createRestaurantsRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
app.use("/api/search", createSearchRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
```

(Keep `errorHandler` registered last.)

- [ ] **Step 4: Run the whole backend suite**

Run: `npm test` → Expected: all tests pass (existing + all new files from Tasks 2–9).

- [ ] **Step 5: Commit and push**

```powershell
git add backend/src/app.ts backend/tests/app.test.ts
git commit -m "feat(backend): mount customer browse routers"
git push
```

Render auto-deploys `main`; the new endpoints go live (they 401 without a token, and return empty data until Task 11 seeds).

---

### Task 10: Deterministic seed-data module + integrity tests

**Files:**
- Create: `backend/prisma/seedData.ts`
- Test: `backend/tests/seed/seedData.test.ts`

**Interfaces:**
- Consumes: nothing (pure module — no DB, no Prisma import).
- Produces: `buildSeedData(now?: Date): SeedRestaurant[]` — consumed by `prisma/seed.ts` (Task 11). Deterministic for a fixed `now` (seeded PRNG), so the integrity test needs no DB. Types:
  ```ts
  export interface SeedMenuItem { category: string; name: string; description: string; priceCents: number; imageUrl: string | null; isAvailable: boolean; position: number; }
  export interface SeedReview { stars: number; reviewText: string; authorName: string; createdAt: Date; }
  export interface SeedRestaurant {
    name: string; description: string; address: string; cuisines: string[];
    opensAt: string; closesAt: string; estDeliveryMin: number; orderCount: number;
    approvedAt: Date; heroImageUrl: string; avgRating: number; ratingCount: number;
    menuItems: SeedMenuItem[]; reviews: SeedReview[];
  }
  ```
  Invariants the test locks in (spec §3): 20 restaurants, 8 cuisines, 8–15 items each in 3–4 categories, 3–8 reviews each with `avgRating`/`ratingCount` derived from those reviews, staggered `approvedAt` (≥3 within 30 days, ≥5 older than 60), varied `estDeliveryMin` (some ≤30, some >30), varied hours including ≥1 overnight window.

- [ ] **Step 1: Write the failing test `backend/tests/seed/seedData.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildSeedData } from "../../prisma/seedData";

const NOW = new Date("2026-07-14T12:00:00Z");
const DAY = 86_400_000;

describe("buildSeedData", () => {
  const data = buildSeedData(NOW);

  it("is deterministic for a fixed now", () => {
    expect(buildSeedData(NOW)).toEqual(data);
  });

  it("builds 20 restaurants across at least 6 cuisines", () => {
    expect(data).toHaveLength(20);
    const cuisines = new Set(data.flatMap((r) => r.cuisines));
    expect(cuisines.size).toBeGreaterThanOrEqual(6);
  });

  it("gives every restaurant 8-15 menu items in 3-4 categories with integer prices and increasing positions", () => {
    for (const r of data) {
      expect(r.menuItems.length).toBeGreaterThanOrEqual(8);
      expect(r.menuItems.length).toBeLessThanOrEqual(15);
      const categories = new Set(r.menuItems.map((m) => m.category));
      expect(categories.size).toBeGreaterThanOrEqual(3);
      expect(categories.size).toBeLessThanOrEqual(4);
      for (const m of r.menuItems) {
        expect(Number.isInteger(m.priceCents)).toBe(true);
        expect(m.priceCents).toBeGreaterThan(0);
      }
      const positions = r.menuItems.map((m) => m.position);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it("keeps ratings consistent: 3-8 reviews, avgRating = mean of stars (1dp), ratingCount = review count", () => {
    for (const r of data) {
      expect(r.reviews.length).toBeGreaterThanOrEqual(3);
      expect(r.reviews.length).toBeLessThanOrEqual(8);
      expect(r.ratingCount).toBe(r.reviews.length);
      const mean = r.reviews.reduce((sum, rv) => sum + rv.stars, 0) / r.reviews.length;
      expect(r.avgRating).toBe(Math.round(mean * 10) / 10);
      for (const rv of r.reviews) {
        expect(rv.stars).toBeGreaterThanOrEqual(1);
        expect(rv.stars).toBeLessThanOrEqual(5);
      }
    }
  });

  it("staggers approvedAt and varies delivery estimates and hours", () => {
    const within30 = data.filter((r) => +NOW - +r.approvedAt <= 30 * DAY);
    const older60 = data.filter((r) => +NOW - +r.approvedAt > 60 * DAY);
    expect(within30.length).toBeGreaterThanOrEqual(3);
    expect(older60.length).toBeGreaterThanOrEqual(5);
    expect(data.some((r) => r.estDeliveryMin <= 30)).toBe(true);
    expect(data.some((r) => r.estDeliveryMin > 30)).toBe(true);
    // at least one overnight window (closes "earlier" than it opens)
    expect(data.some((r) => r.closesAt < r.opensAt)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npx vitest run tests/seed/seedData.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 3: Implement `backend/prisma/seedData.ts`**

```ts
// Deterministic demo marketplace data (spec §3). Pure module: no DB access,
// so tests can verify invariants without a database. All rows created from
// this file are flagged isDemo by seed.ts.

export interface SeedMenuItem {
  category: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean; position: number;
}
export interface SeedReview { stars: number; reviewText: string; authorName: string; createdAt: Date; }
export interface SeedRestaurant {
  name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; estDeliveryMin: number; orderCount: number;
  approvedAt: Date; heroImageUrl: string; avgRating: number; ratingCount: number;
  menuItems: SeedMenuItem[]; reviews: SeedReview[];
}

const DAY = 86_400_000;

// Deterministic PRNG so re-running the seed produces identical data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=60`;

type ItemTuple = [name: string, description: string, priceCents: number];

// 8 cuisine menu templates; every template has 4 categories and 10-12 items
// (satisfies the 8-15 items / 3-4 categories invariant).
const MENUS: Record<string, { category: string; items: ItemTuple[] }[]> = {
  Pakistani: [
    { category: "Starters", items: [
      ["Chicken Samosa (2 pc)", "Crisp pastry, spiced chicken filling", 15000],
      ["Dahi Bhalla", "Lentil dumplings, whipped yogurt, tamarind", 22000],
      ["Seekh Kebab (4 pc)", "Charcoal-grilled minced beef skewers", 45000]] },
    { category: "Mains", items: [
      ["Chicken Biryani", "Sella rice, marinated chicken, raita on the side", 42000],
      ["Beef Nihari", "Slow-cooked shank, ginger, green chili", 55000],
      ["Chicken Karahi (Half)", "Tomato-chili wok curry, wood-fired", 65000],
      ["Daal Makhani", "Black lentils finished with butter and cream", 32000]] },
    { category: "Breads & Rice", items: [
      ["Garlic Naan", "Tandoor-baked, garlic butter brush", 8000],
      ["Roghni Naan", "Sesame topped, milk wash", 7000],
      ["Steamed Basmati", "Fragrant long-grain rice", 15000]] },
    { category: "Drinks & Desserts", items: [
      ["Sweet Lassi", "Churned yogurt, cardamom", 18000],
      ["Gulab Jamun (2 pc)", "Served warm in rose syrup", 16000]] },
  ],
  BBQ: [
    { category: "Skewers", items: [
      ["Malai Boti (6 pc)", "Cream-marinated chicken, charcoal grill", 48000],
      ["Beef Bihari Kebab", "Paper-thin strips, smoky masala", 52000],
      ["Chicken Tikka (Leg)", "Bone-in, tandoor-charred", 38000]] },
    { category: "Platters", items: [
      ["Mixed Grill Platter", "Boti, kebab, tikka, fries and naan", 145000],
      ["Family BBQ Deal", "12 skewers, 4 naan, 2 raita", 260000],
      ["Mutton Chops (4 pc)", "Marinated overnight, flame-finished", 98000]] },
    { category: "Sides", items: [
      ["Grilled Vegetables", "Seasonal, charred, olive oil", 25000],
      ["Masala Fries", "Hand-cut, chaat masala dust", 20000],
      ["Mint Raita", "Cooling yogurt dip", 8000]] },
    { category: "Drinks", items: [
      ["Kashmiri Chai", "Pink tea, crushed pistachio", 15000],
      ["Fresh Lime Soda", "Sweet or salted", 12000]] },
  ],
  Pizza: [
    { category: "Classics", items: [
      ["Margherita", "San Marzano tomato, fior di latte, basil", 85000],
      ["Pepperoni", "Beef pepperoni, mozzarella, oregano", 105000],
      ["Quattro Formaggi", "Four-cheese blend, wood-fired crust", 115000]] },
    { category: "Specials", items: [
      ["Chicken Tikka Pizza", "Desi tikka chunks, red onion, coriander", 110000],
      ["Smoked BBQ Ranch", "Grilled chicken, ranch drizzle, smoked cheddar", 120000],
      ["Veggie Ortolana", "Zucchini, bell pepper, olives, mushroom", 95000]] },
    { category: "Sides", items: [
      ["Garlic Bread (6 pc)", "Herb butter, parmesan", 30000],
      ["Chicken Wings (6 pc)", "Peri-peri glaze", 45000],
      ["Caesar Salad", "Romaine, croutons, shaved parmesan", 40000]] },
    { category: "Desserts", items: [
      ["Tiramisu", "Espresso-soaked ladyfingers, mascarpone", 42000],
      ["Molten Lava Cake", "Warm chocolate center", 38000]] },
  ],
  Burgers: [
    { category: "Beef", items: [
      ["Classic Smash", "Double smashed patty, American cheese", 65000],
      ["The Behemoth", "Triple patty, caramelized onion, house sauce", 95000],
      ["Mushroom Swiss", "Sautéed mushrooms, Swiss cheese", 75000]] },
    { category: "Chicken", items: [
      ["Crispy Zinger", "Buttermilk-fried thigh, spicy mayo", 55000],
      ["Grilled Chipotle", "Flame-grilled breast, chipotle aioli", 60000],
      ["Bun Kabab", "Shami patty, egg, chutney — street style", 25000]] },
    { category: "Sides & Shakes", items: [
      ["Loaded Fries", "Cheese sauce, jalapeño, beef bits", 35000],
      ["Onion Rings", "Beer-battered, ranch dip", 28000],
      ["Oreo Shake", "Hand-spun, whipped cream", 32000],
      ["Peanut Butter Shake", "Thick, salted caramel drizzle", 34000]] },
    { category: "Drinks", items: [
      ["Soft Drink (Can)", "Chilled", 8000]] },
  ],
  Chinese: [
    { category: "Soups & Starters", items: [
      ["Hot & Sour Soup", "Classic peppery-tangy broth", 28000],
      ["Chicken Dumplings (6 pc)", "Steamed, soy-vinegar dip", 38000],
      ["Prawn Tempura", "Light crisp batter, sweet chili", 55000]] },
    { category: "Mains", items: [
      ["Chicken Manchurian", "Tangy tomato-garlic sauce", 52000],
      ["Beef Chili Dry", "Wok-tossed, dried chilies, capsicum", 62000],
      ["Kung Pao Chicken", "Peanuts, Sichuan heat", 56000]] },
    { category: "Rice & Noodles", items: [
      ["Chicken Chowmein", "Egg noodles, julienned vegetables", 42000],
      ["Special Fried Rice", "Egg, chicken, prawn", 46000],
      ["Vegetable Hakka Noodles", "Light soy, spring onion", 38000]] },
    { category: "Desserts", items: [
      ["Fried Ice Cream", "Crisp shell, honey drizzle", 30000],
      ["Fortune Cookies (4 pc)", "House-made", 12000]] },
  ],
  Shawarma: [
    { category: "Wraps", items: [
      ["Chicken Shawarma", "Garlic toum, pickles, fries inside", 25000],
      ["Beef Shawarma Special", "Double meat, tahini", 35000],
      ["Falafel Wrap", "Herb chickpea fritters, hummus", 22000]] },
    { category: "Platters", items: [
      ["Shawarma Platter", "Open shawarma, rice, salad, toum", 55000],
      ["Mixed Grill Plate", "Shish tawook, kofta, garlic sauce", 75000],
      ["Hummus Bowl", "Olive oil, warm pita", 30000]] },
    { category: "Sides", items: [
      ["Garlic Fries", "Toum-tossed", 18000],
      ["Tabbouleh", "Parsley, bulgur, lemon", 24000],
      ["Extra Toum", "Whipped garlic dip", 6000]] },
    { category: "Drinks", items: [
      ["Mint Lemonade", "Crushed ice, fresh mint", 15000],
      ["Ayran", "Salted yogurt drink", 12000]] },
  ],
  Seafood: [
    { category: "Starters", items: [
      ["Fish Kebab (4 pc)", "Minced fish, coastal spices", 42000],
      ["Prawn Pakora", "Crisp gram-flour batter", 48000],
      ["Calamari Rings", "Golden fried, lemon aioli", 52000]] },
    { category: "Mains", items: [
      ["Lahori Fried Fish", "Ajwain batter, river fish", 85000],
      ["Grilled Pomfret", "Whole fish, green masala", 110000],
      ["Prawn Karahi", "Tomato-chili wok curry", 95000]] },
    { category: "Rice & Breads", items: [
      ["Prawn Fried Rice", "Wok-charred", 55000],
      ["Khameeri Roti", "Soft leavened tandoor bread", 7000],
      ["Steamed Rice", "Basmati", 15000]] },
    { category: "Drinks", items: [
      ["Sugarcane Juice", "Fresh-pressed, lemon", 12000],
      ["Mineral Water", "1.5L", 8000]] },
  ],
  Desserts: [
    { category: "Traditional", items: [
      ["Gajar ka Halwa", "Slow-cooked carrot, khoya", 28000],
      ["Ras Malai (2 pc)", "Saffron milk, pistachio", 24000],
      ["Kulfi Falooda", "Pistachio kulfi, vermicelli, rose", 32000]] },
    { category: "Cakes & Bakes", items: [
      ["Fudge Brownie", "Dark chocolate, walnut", 25000],
      ["Red Velvet Slice", "Cream cheese frosting", 30000],
      ["Lotus Cheesecake", "Biscoff crumb, baked", 38000]] },
    { category: "Ice Cream", items: [
      ["Scoop Trio", "Any three flavors", 35000],
      ["Waffle Sundae", "Fresh waffle, hot fudge", 42000],
      ["Mango Sorbet", "Seasonal, dairy-free", 28000]] },
    { category: "Hot Drinks", items: [
      ["Hot Chocolate", "Belgian, whipped cream", 26000],
      ["Doodh Patti", "Strong milk tea", 10000]] },
  ],
};

// 2-3 dish thumbnails per cuisine, cycled across menu items.
const DISH_IMAGES: Record<string, string[]> = {
  Pakistani: [unsplash("1601050690597-df0568f70950"), unsplash("1631452180519-c014fe946bc7")],
  BBQ: [unsplash("1544025162-d76694265947"), unsplash("1555939594-58d7cb561ad1")],
  Pizza: [unsplash("1513104890138-7c749659a591"), unsplash("1574071318508-1cdbab80d002")],
  Burgers: [unsplash("1568901346375-23c9450c58cd"), unsplash("1550547660-d9450f859349")],
  Chinese: [unsplash("1585032226651-759b368d7246"), unsplash("1563245372-f21724e3856d")],
  Shawarma: [unsplash("1529006557810-274b9b2fc783"), unsplash("1561651823-34feb02250e4")],
  Seafood: [unsplash("1519708227418-c8fd9a32b7a2"), unsplash("1504674900247-0877df9cc836")],
  Desserts: [unsplash("1551024506-0bccd828d307"), unsplash("1497034825429-c343d7c6a68f")],
};

// [name, description, cuisines, address, opensAt, closesAt, estDeliveryMin,
//  orderCount, approvedDaysAgo, targetRating, heroImageId]
type RestTuple = [string, string, string[], string, string, string, number, number, number, number, string];

const RESTAURANTS: RestTuple[] = [
  ["Karahi Khaas", "Wood-fired karahis and tandoor breads, family recipes since 1982.", ["Pakistani", "BBQ"], "12 Mall Road, Lahore", "11:00", "23:00", 25, 2400, 320, 4.7, "1631452180519-c014fe946bc7"],
  ["Nihari House 1964", "Slow-simmered nihari served with khameeri roti all day.", ["Pakistani"], "9 Burns Road, Karachi", "07:00", "22:00", 35, 1900, 400, 4.5, "1601050690597-df0568f70950"],
  ["Biryani Adda", "Layered sella biryani, degh-cooked, spice you can trust.", ["Pakistani"], "44 Tariq Road, Karachi", "11:30", "23:30", 28, 2100, 150, 4.2, "1563379926898-05f4575a45d8"],
  ["Lahori Chatkhara", "Street-style Lahori plates with serious chatkhara.", ["Pakistani"], "3 Anarkali Bazaar, Lahore", "12:00", "23:00", 40, 800, 90, 3.9, "1615141982883-c7ad0e69fd62"],
  ["Angeethi BBQ", "Charcoal skewers over open angeethi pits.", ["BBQ", "Pakistani"], "17 MM Alam Road, Lahore", "17:00", "01:00", 30, 1700, 200, 4.6, "1544025162-d76694265947"],
  ["Charcoal Tikka Co.", "Tikka, boti and platters made for sharing.", ["BBQ"], "5 Khadda Market, Karachi", "16:00", "00:00", 32, 950, 60, 4.1, "1555939594-58d7cb561ad1"],
  ["Raat ka Dhaba", "Late-night dhaba grills for the after-hours crowd.", ["BBQ"], "88 GT Road, Rawalpindi", "17:00", "02:00", 45, 600, 45, 3.8, "1529193591184-b1d58069ecdd"],
  ["Forno Napoli", "Neapolitan pies from a 450° wood oven, 90-second bake.", ["Pizza"], "21 Zamzama Boulevard, Karachi", "12:00", "23:30", 30, 1500, 25, 4.8, "1513104890138-7c749659a591"],
  ["Slice Street", "Big foldable slices, by the slice or the box.", ["Pizza"], "7 F-7 Markaz, Islamabad", "11:00", "01:00", 22, 1100, 180, 4.0, "1574071318508-1cdbab80d002"],
  ["Pizza Karachiwala", "Desi-topped pizzas with a Karachi attitude.", ["Pizza"], "31 Gulshan Chowrangi, Karachi", "13:00", "23:00", 38, 500, 240, 3.6, "1590947132387-155cc02f3212"],
  ["Bun Kabab Bros", "Street bun kababs elevated, secret chutney included.", ["Burgers", "Pakistani"], "2 Boat Basin, Karachi", "16:00", "01:30", 20, 1600, 130, 4.4, "1568901346375-23c9450c58cd"],
  ["Smash Junction", "Smashed-to-order patties, buttered brioche.", ["Burgers"], "14 DHA Phase 6, Lahore", "12:00", "00:00", 24, 1400, 20, 4.3, "1550547660-d9450f859349"],
  ["Griddle & Co", "Diner-style burgers and hand-spun shakes.", ["Burgers"], "6 Blue Area, Islamabad", "11:00", "23:00", 33, 700, 300, 3.7, "1571091718767-18b5b1457add"],
  ["Dragon Bowl", "Wok-fired Indo-Chinese classics, generous bowls.", ["Chinese"], "55 Clifton Block 5, Karachi", "12:00", "23:00", 27, 1300, 220, 4.5, "1585032226651-759b368d7246"],
  ["Chowk Chowmein", "Chowmein and manchurian from the corner chowk.", ["Chinese"], "19 Liberty Market, Lahore", "13:00", "22:30", 42, 450, 110, 3.9, "1563245372-f21724e3856d"],
  ["Shawarma Stop", "Spit-roasted shawarma, garlic toum with everything.", ["Shawarma"], "8 University Road, Peshawar", "11:00", "23:59", 18, 1250, 170, 4.2, "1529006557810-274b9b2fc783"],
  ["Beirut Bites", "Levantine wraps, platters and fresh tabbouleh.", ["Shawarma"], "40 E-11 Markaz, Islamabad", "12:00", "23:00", 26, 900, 12, 4.6, "1561651823-34feb02250e4"],
  ["Bandargah Fish Point", "Harbour-fresh fish, fried Lahori style.", ["Seafood", "Pakistani"], "1 West Wharf, Karachi", "16:00", "23:30", 48, 650, 260, 4.4, "1519708227418-c8fd9a32b7a2"],
  ["Meetha Mahal", "Traditional mithai and halwas, made every morning.", ["Desserts"], "23 Ichhra Bazaar, Lahore", "09:00", "23:30", 29, 1000, 350, 4.7, "1551024506-0bccd828d307"],
  ["Scoop Society", "Small-batch ice cream and late-night waffles.", ["Desserts"], "11 Bahadurabad, Karachi", "13:00", "01:00", 21, 850, 8, 4.3, "1497034825429-c343d7c6a68f"],
];

const REVIEW_TEXTS = [
  "Absolutely worth it — arrived hot and fresh.",
  "Portion sizes are generous for the price.",
  "Best in the neighbourhood, hands down.",
  "Solid food, delivery was a little slow.",
  "The flavours are authentic. Will reorder.",
  "Packaging was neat, nothing spilled.",
  "A bit too spicy for me but my family loved it.",
  "Consistently good across many orders.",
  "Tasty, though I've had better elsewhere.",
  "Their signature dish alone is worth ordering.",
  "Fresh ingredients, you can tell the difference.",
  "Decent, but the portion could be bigger.",
  "Arrived earlier than the estimate. Impressed.",
  "Great value deal for a family dinner.",
  "The rider was polite and everything was warm.",
  "Order was accurate down to the extra chutney.",
];

const AUTHORS = [
  "Ayesha K.", "Bilal R.", "Sana M.", "Hamza T.", "Zainab F.", "Usman A.",
  "Mariam S.", "Danish I.", "Hira Q.", "Fahad N.", "Noor J.", "Taha W.",
];

export function buildSeedData(now: Date = new Date()): SeedRestaurant[] {
  return RESTAURANTS.map((tuple, index) => {
    const [name, description, cuisines, address, opensAt, closesAt,
      estDeliveryMin, orderCount, approvedDaysAgo, targetRating, heroId] = tuple;
    const rand = mulberry32(index + 1);
    const primaryCuisine = cuisines[0];
    const template = MENUS[primaryCuisine];
    const dishImages = DISH_IMAGES[primaryCuisine];

    let position = 0;
    const menuItems: SeedMenuItem[] = template.flatMap((group) =>
      group.items.map(([itemName, itemDescription, priceCents]) => {
        position += 1;
        return {
          category: group.category, name: itemName, description: itemDescription,
          priceCents,
          imageUrl: dishImages[position % dishImages.length],
          isAvailable: rand() > 0.08, // a few items read "Unavailable"
          position,
        };
      }));

    const reviewCount = 3 + Math.floor(rand() * 6); // 3..8
    const reviews: SeedReview[] = Array.from({ length: reviewCount }, () => ({
      stars: Math.min(5, Math.max(1, Math.round(targetRating + (rand() - 0.5) * 1.6))),
      reviewText: REVIEW_TEXTS[Math.floor(rand() * REVIEW_TEXTS.length)],
      authorName: AUTHORS[Math.floor(rand() * AUTHORS.length)],
      createdAt: new Date(+now - Math.floor(1 + rand() * 90) * DAY),
    }));
    const mean = reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;

    return {
      name, description, cuisines, address, opensAt, closesAt,
      estDeliveryMin, orderCount,
      approvedAt: new Date(+now - approvedDaysAgo * DAY),
      heroImageUrl: unsplash(heroId),
      avgRating: Math.round(mean * 10) / 10,
      ratingCount: reviews.length,
      menuItems, reviews,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/seed/seedData.test.ts` → Expected: 5 passed.
If the approvedAt-stagger assertion fails, adjust `approvedDaysAgo` values (need ≥3 of {25, 20, 12, 8} style recents — the table above has 25, 20, 12, 8 → 4 within 30 days).

- [ ] **Step 5: Commit and push**

```powershell
git add backend/prisma/seedData.ts backend/tests/seed/seedData.test.ts
git commit -m "feat(backend): deterministic demo seed data with integrity tests"
git push
```

---

### Task 11: Seed script — apply demo data to the database

**Files:**
- Create: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `buildSeedData` (Task 10), Prisma models (Task 1), `npm run seed` script (Task 1).
- Produces: 20 `isDemo: true` restaurants with menus and ratings in the shared Supabase DB. Idempotent: re-running resets demo data without touching `User`/`OtpChallenge` or any non-demo row.

- [ ] **Step 1: Implement `backend/prisma/seed.ts`**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildSeedData } from "./seedData";

// Idempotent demo seed (spec §3): deletes ONLY isDemo restaurants (menu items
// and ratings cascade), then recreates them. Never touches User/OtpChallenge
// or non-demo rows.
async function main() {
  const prisma = new PrismaClient();
  const data = buildSeedData(new Date());

  const { count } = await prisma.restaurantProfile.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${count} existing demo restaurants.`);

  for (const r of data) {
    const { menuItems, reviews, ...profile } = r;
    await prisma.restaurantProfile.create({
      data: {
        ...profile,
        isDemo: true,
        isActive: true,
        menuItems: { create: menuItems },
        ratings: { create: reviews },
      },
    });
  }

  const totals = {
    restaurants: await prisma.restaurantProfile.count({ where: { isDemo: true } }),
    menuItems: await prisma.menuItem.count(),
    ratings: await prisma.rating.count(),
  };
  console.log(`Seeded: ${JSON.stringify(totals)}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the seed against the shared Supabase DB**

Run (from `backend/`): `npm run seed`
Expected output: `Removed 0 existing demo restaurants.` then `Seeded: {"restaurants":20,"menuItems":2xx,"ratings":...}`.

- [ ] **Step 3: Verify idempotency**

Run `npm run seed` again.
Expected: `Removed 20 existing demo restaurants.` and the same final counts — no duplicates.

- [ ] **Step 4: Spot-check via the live API**

Start the backend locally (`npm run dev` from `backend/`, uses `.env`). Get a token by logging in with an existing account:

```powershell
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/auth/login" -ContentType "application/json" -Body '{"identifier":"<your-test-email>","password":"<your-password>"}'
Invoke-RestMethod -Uri "http://localhost:3000/api/customer/home" -Headers @{ Authorization = "Bearer $($login.token)" } | ConvertTo-Json -Depth 5
```

Expected: `cuisines` array of 8 entries and 4 sections each with up to 10 restaurant cards; some cards `isOpenNow: false` depending on the hour.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/prisma/seed.ts
git commit -m "feat(backend): idempotent demo seed script"
git push
```

---

### Task 12: Scaffold the `app/` SPA — Vite, tokens, session, API client

**Files:**
- Create: `app/` via Vite scaffold, then:
  - Modify: `app/vite.config.ts`, `app/index.html`
  - Create: `app/.env.development`
  - Create: `app/src/styles/tokens.css`, `app/src/styles/global.css`
  - Create: `app/src/lib/config.ts`, `app/src/lib/session.ts`, `app/src/lib/api.ts`, `app/src/lib/types.ts`, `app/src/lib/format.ts`
  - Copy: `landing/assets/fonts/{fraunces-var,space-grotesk-var,azeret-mono-500}.woff2` → `app/public/fonts/`

**Interfaces:**
- Consumes: the deployed backend API; the `feastnow_token` localStorage key written by the landing login/signup pages (same origin ⇒ shared storage).
- Produces (used by every later frontend task):
  ```ts
  // lib/session.ts
  export function getToken(): string | null;
  export function clearToken(): void;
  export function redirectToLogin(): void;   // → window.location.href = "/login.html"
  // lib/api.ts
  export class NetworkError extends Error {}  // thrown on fetch failure; NEVER clears the token
  export async function apiGet<T>(path: string): Promise<T>; // attaches Bearer; 401 → clearToken()+redirect
  // lib/format.ts
  export function formatPrice(priceCents: number): string;   // 45000 → "Rs 450"
  export function formatRating(avg: number): string;         // 4.7 → "4.7"
  // lib/types.ts — RestaurantCard, HomeResponse, RestaurantListResponse,
  //                RestaurantDetail, MenuGroup, MenuItem, Review, DishHit, SearchResponse, Me
  ```

- [ ] **Step 1: Scaffold**

From the repo root:

```powershell
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install react-router-dom@6
```

Delete the boilerplate: `app/src/App.css`, `app/src/index.css`, `app/src/assets/react.svg`, `app/public/vite.svg`. (`App.tsx`/`main.tsx` get replaced in Task 13; for now strip their dead imports so `npm run build` passes.)

- [ ] **Step 2: Configure base path and env**

`app/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served at /app/ on the existing Vercel site (spec §5).
export default defineConfig({
  plugins: [react()],
  base: "/app/",
});
```

`app/.env.development`:

```
VITE_API_BASE_URL=http://localhost:3000
```

`app/index.html` — replace `<title>` and add fonts/meta inside `<head>`:

```html
<meta name="theme-color" content="#0F2C56" />
<title>FeastNow</title>
```

- [ ] **Step 3: Styles**

`app/src/styles/tokens.css` — copy the **entire contents** of `landing/assets/css/tokens.css` verbatim (same `:root` block; it is the design-token source of truth).

`app/src/styles/global.css`:

```css
@font-face {
  font-family: "Fraunces";
  src: url("/app/fonts/fraunces-var.woff2") format("woff2");
  font-weight: 100 900; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Space Grotesk";
  src: url("/app/fonts/space-grotesk-var.woff2") format("woff2");
  font-weight: 300 700; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Azeret Mono";
  src: url("/app/fonts/azeret-mono-500.woff2") format("woff2");
  font-weight: 500; font-style: normal; font-display: swap;
}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--dough); /* desktop backdrop behind the phone frame */
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; display: block; }
button { font: inherit; cursor: pointer; }
a { color: inherit; text-decoration: none; }

/* The deliberate "app in a frame" (spec §5): centered phone-width canvas. */
#root {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  background: var(--bg);
  box-shadow: var(--sh-overlay);
  display: flex;
  flex-direction: column;
}

.mono { font-family: var(--font-mono); }
.serif { font-family: var(--font-display); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Copy the three font files:

```powershell
New-Item -ItemType Directory -Force "app/public/fonts"
Copy-Item "landing/assets/fonts/fraunces-var.woff2","landing/assets/fonts/space-grotesk-var.woff2","landing/assets/fonts/azeret-mono-500.woff2" "app/public/fonts/"
```

- [ ] **Step 4: Library modules**

`app/src/lib/config.ts`:

```ts
// Same Render backend the landing auth pages use (landing/assets/js/config.js).
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "https://feastnow.onrender.com";
```

`app/src/lib/session.ts`:

```ts
// Same key the landing auth pages write (landing/assets/js/auth.js) —
// same origin, so the session carries straight over into the SPA.
const TOKEN_KEY = "feastnow_token";

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function redirectToLogin(): void {
  window.location.href = "/login.html";
}
```

`app/src/lib/api.ts`:

```ts
import { API_BASE_URL } from "./config";
import { clearToken, getToken, redirectToLogin } from "./session";

/** Fetch-level failure. Deliberately does NOT clear the token — a network
 *  blip must never log the user out (same rule as the welcome page). */
export class NetworkError extends Error {
  constructor() { super("Network error — check your connection and try again."); }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("No session.");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    throw new Error("Session expired.");
  }
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json() as Promise<T>;
}
```

`app/src/lib/types.ts`:

```ts
export interface Me { id: string; name: string; email: string; phone: string; }

export interface RestaurantCard {
  id: string; name: string; cuisines: string[]; avgRating: number;
  ratingCount: number; estDeliveryMin: number; heroImageUrl: string; isOpenNow: boolean;
}

export interface HomeSection { key: string; title: string; restaurants: RestaurantCard[]; }
export interface HomeResponse { cuisines: string[]; sections: HomeSection[]; }

export interface RestaurantListResponse {
  restaurants: RestaurantCard[]; page: number; pageSize: number; total: number;
}

export interface MenuItem {
  id: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean;
}
export interface MenuGroup { category: string; items: MenuItem[]; }
export interface Review {
  id: string; stars: number; reviewText: string; authorName: string; createdAt: string;
}
export interface RestaurantDetail {
  id: string; name: string; description: string; address: string; cuisines: string[];
  avgRating: number; ratingCount: number; estDeliveryMin: number; heroImageUrl: string;
  opensAt: string; closesAt: string; isOpenNow: boolean;
  menu: MenuGroup[]; reviews: Review[];
}

export interface DishHit {
  id: string; name: string; priceCents: number; imageUrl: string | null;
  isAvailable: boolean; restaurantId: string; restaurantName: string;
}
export interface SearchResponse { restaurants: RestaurantCard[]; dishes: DishHit[]; }

export type RestaurantSort = "popular" | "rating" | "delivery_time";
```

`app/src/lib/format.ts`:

```ts
/** Money is integer cents; display whole rupees. 45000 → "Rs 450". */
export function formatPrice(priceCents: number): string {
  return `Rs ${Math.round(priceCents / 100).toLocaleString("en-PK")}`;
}

export function formatRating(avg: number): string {
  return avg.toFixed(1);
}
```

- [ ] **Step 5: Verify it builds**

Run (from `app/`): `npm run build`
Expected: Vite build succeeds (the placeholder App still renders nothing meaningful — fine until Task 13).

- [ ] **Step 6: Commit and push**

```powershell
git add app
git commit -m "feat(app): scaffold React+Vite SPA with tokens, session, and API client"
git push
```

---

### Task 13: App shell — auth boot, router, tab bar, Orders stub, Profile

**Files:**
- Create: `app/src/AuthGate.tsx`, `app/src/components/TabBar.tsx`
- Create: `app/src/screens/OrdersScreen.tsx`, `app/src/screens/ProfileScreen.tsx`
- Create: `app/src/styles/shell.css`
- Modify: `app/src/App.tsx`, `app/src/main.tsx`

**Interfaces:**
- Consumes: `apiGet`, `NetworkError`, session helpers, `Me` type (Task 12).
- Produces:
  - `AuthGate` — renders children only once `/api/me` succeeds; exposes the profile via `useMe(): Me`. **Network failure must NOT clear a valid session** — it shows a retry state instead (spec §5 auth-handoff rule).
  - Routes (basename `/app`): `/` Home, `/restaurant/:id`, `/search`, `/orders`, `/profile`. Home/Restaurant/Search screens are placeholder `<div>`s until Tasks 15–17 replace them.
  - `TabBar` — bottom tabs Home / Orders / Profile (Tasks 15–17 screens render above it).

- [ ] **Step 1: `app/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/shell.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: `app/src/AuthGate.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, NetworkError } from "./lib/api";
import { getToken, redirectToLogin } from "./lib/session";
import type { Me } from "./lib/types";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside AuthGate.");
  return me;
}

type AuthState =
  | { status: "loading" }
  | { status: "offline"; message: string }
  | { status: "ready"; me: Me };

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const boot = useCallback(async () => {
    setState({ status: "loading" });
    if (!getToken()) {
      redirectToLogin();
      return;
    }
    try {
      const me = await apiGet<Me>("/api/me");
      setState({ status: "ready", me });
    } catch (err) {
      if (err instanceof NetworkError) {
        // Valid session, no network — keep the token, offer retry.
        setState({ status: "offline", message: err.message });
      }
      // 401s already redirected inside apiGet.
    }
  }, []);

  useEffect(() => { void boot(); }, [boot]);

  if (state.status === "loading") {
    return <div className="boot-screen" role="status" aria-label="Loading">
      <span className="boot-screen__logo serif">FeastNow</span>
    </div>;
  }
  if (state.status === "offline") {
    return <div className="boot-screen">
      <p className="boot-screen__message">{state.message}</p>
      <button className="btn-retry" onClick={() => void boot()}>Try again</button>
    </div>;
  }
  return <MeContext.Provider value={state.me}>{children}</MeContext.Provider>;
}
```

- [ ] **Step 3: `app/src/components/TabBar.tsx`**

```tsx
import { NavLink } from "react-router-dom";

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

const TABS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/orders", label: "Orders", icon: OrdersIcon, end: false },
  { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
];

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) => `tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}>
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Stub + Profile screens**

`app/src/screens/OrdersScreen.tsx` (designed empty state, spec §6):

```tsx
import { Link } from "react-router-dom";

export function OrdersScreen() {
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
```

`app/src/screens/ProfileScreen.tsx`:

```tsx
import { useMe } from "../AuthGate";
import { clearToken, redirectToLogin } from "../lib/session";

export function ProfileScreen() {
  const me = useMe();
  const initials = me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <main className="screen profile">
      <div className="profile__avatar serif" aria-hidden="true">{initials}</div>
      <h1 className="serif">{me.name}</h1>
      <dl className="profile__details">
        <dt>Email</dt><dd>{me.email}</dd>
        <dt>Phone</dt><dd className="mono">{me.phone}</dd>
      </dl>
      <button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }}>
        Log out
      </button>
    </main>
  );
}
```

- [ ] **Step 5: `app/src/App.tsx`**

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { TabBar } from "./components/TabBar";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";

// Placeholders replaced in Tasks 15-17.
const HomeScreen = () => <main className="screen">Home</main>;
const RestaurantScreen = () => <main className="screen">Restaurant</main>;
const SearchScreen = () => <main className="screen">Search</main>;

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter basename="/app">
        <div className="shell">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/restaurant/:id" element={<RestaurantScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/orders" element={<OrdersScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Routes>
          <TabBar />
        </div>
      </BrowserRouter>
    </AuthGate>
  );
}
```

- [ ] **Step 6: `app/src/styles/shell.css`**

```css
.shell { display: flex; flex-direction: column; min-height: 100dvh; }
.screen { flex: 1; padding: var(--s-md); padding-bottom: calc(64px + var(--s-md)); }

.boot-screen {
  min-height: 100dvh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: var(--s-md);
  padding: var(--s-lg); text-align: center;
}
.boot-screen__logo { font-family: var(--font-display); font-size: 28px; color: var(--navy); }
.boot-screen__message { color: var(--brown); max-width: 32ch; }

.tab-bar {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px; height: 64px;
  display: grid; grid-template-columns: repeat(3, 1fr);
  background: var(--cream); border-top: 1px solid var(--dough);
  z-index: var(--z-nav);
  padding-bottom: env(safe-area-inset-bottom);
}
.tab-bar__tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; font-size: 11px; color: var(--brown);
  transition: color var(--dur-fast) var(--ease-out-quart);
}
.tab-bar__tab--active { color: var(--navy); font-weight: 600; }

.btn-primary {
  display: inline-block; background: var(--navy); color: var(--cream);
  border: none; border-radius: var(--r-pill); padding: 12px 24px; font-weight: 600;
}
.btn-retry, .btn-logout {
  background: none; border: 1px solid var(--navy); color: var(--navy);
  border-radius: var(--r-pill); padding: 10px 22px; font-weight: 600;
}
.btn-logout { margin-top: var(--s-lg); border-color: var(--tomato); color: var(--tomato); }

.orders-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-sm); text-align: center; }
.orders-empty h1 { margin: var(--s-sm) 0 0; color: var(--navy); }
.orders-empty p { margin: 0 0 var(--s-md); color: var(--brown); }

.profile { display: flex; flex-direction: column; align-items: center; padding-top: var(--s-xl); }
.profile__avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: var(--navy); color: var(--cream);
  display: flex; align-items: center; justify-content: center; font-size: 26px;
}
.profile h1 { margin: var(--s-md) 0 var(--s-lg); color: var(--navy); }
.profile__details { width: 100%; max-width: 320px; margin: 0; }
.profile__details dt { font-size: 12px; color: var(--brown); margin-top: var(--s-md); }
.profile__details dd { margin: 2px 0 0; }
```

- [ ] **Step 7: Verify in the browser**

Terminal 1 (from `backend/`): `npm run dev` — the backend must allow the Vite origin; if `.env` `FRONTEND_ORIGIN` doesn't include it, add `,http://localhost:5173` for local work.
Terminal 2 (from `app/`): `npm run dev`, open `http://localhost:5173/app/`.

Expected: with no token in localStorage → immediate redirect to `/login.html` (404 locally — the redirect firing is what's verified). Then in DevTools run `localStorage.setItem("feastnow_token", "<token from Task 11 Step 4>")`, reload → boot screen, then Home placeholder with tab bar; Profile tab shows your name/email/phone; Log out clears the token and redirects.

- [ ] **Step 8: Commit and push**

```powershell
git add app
git commit -m "feat(app): app shell - auth boot, router, tab bar, orders stub, profile"
git push
```

---

### Task 14: Shared browse components

**Files:**
- Create: `app/src/components/RestaurantCard.tsx`, `app/src/components/Chip.tsx`, `app/src/components/SectionRow.tsx`, `app/src/components/SkeletonCard.tsx`, `app/src/components/SearchBar.tsx`
- Create: `app/src/styles/components.css`
- Modify: `app/src/main.tsx` (import `./styles/components.css`)

**Interfaces:**
- Consumes: `RestaurantCard` type, `formatRating` (Task 12).
- Produces (used by Tasks 15–17):
  ```tsx
  export function RestaurantCardView({ restaurant }: { restaurant: RestaurantCard }): JSX.Element; // <Link> to /restaurant/:id
  export function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }): JSX.Element;
  export function SectionRow({ title, children }: { title: string; children: ReactNode }): JSX.Element;
  export function SkeletonCard(): JSX.Element;
  export function SearchBar(props: { readOnly?: boolean; value?: string; onChange?: (v: string) => void; onTap?: () => void; autoFocus?: boolean }): JSX.Element;
  ```
- Design rules enforced here: serif restaurant names; **mono for rating and minutes**; **gold only on the rating star**; closed = grayed card + basil/tomato-rule badge (tomato icon + "Closed now" label); motion ≤250ms.

- [ ] **Step 1: `app/src/components/RestaurantCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { RestaurantCard } from "../lib/types";
import { formatRating } from "../lib/format";

export function RestaurantCardView({ restaurant }: { restaurant: RestaurantCard }) {
  const r = restaurant;
  return (
    <Link to={`/restaurant/${r.id}`} className={`restaurant-card${r.isOpenNow ? "" : " restaurant-card--closed"}`}>
      <div className="restaurant-card__media">
        <img src={r.heroImageUrl} alt="" loading="lazy" />
        {!r.isOpenNow && (
          <span className="closed-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
            </svg>
            Closed now
          </span>
        )}
      </div>
      <div className="restaurant-card__body">
        <h3 className="restaurant-card__name serif">{r.name}</h3>
        <p className="restaurant-card__cuisines">{r.cuisines.join(" · ")}</p>
        <p className="restaurant-card__meta mono">
          <span className="restaurant-card__rating">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
            </svg>
            {formatRating(r.avgRating)}
          </span>
          <span aria-hidden="true">·</span>
          <span>({r.ratingCount})</span>
          <span aria-hidden="true">·</span>
          <span>{r.estDeliveryMin} min</span>
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: `Chip`, `SectionRow`, `SkeletonCard`, `SearchBar`**

`app/src/components/Chip.tsx`:

```tsx
export function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`chip${selected ? " chip--selected" : ""}`}
      aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  );
}
```

`app/src/components/SectionRow.tsx`:

```tsx
import type { ReactNode } from "react";

export function SectionRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section-row">
      <h2 className="section-row__title serif">{title}</h2>
      <div className="section-row__scroller">{children}</div>
    </section>
  );
}
```

`app/src/components/SkeletonCard.tsx`:

```tsx
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card__media" />
      <div className="skeleton-card__line" />
      <div className="skeleton-card__line skeleton-card__line--short" />
    </div>
  );
}
```

`app/src/components/SearchBar.tsx`:

```tsx
interface SearchBarProps {
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onTap?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ readOnly, value, onChange, onTap, autoFocus }: SearchBarProps) {
  return (
    <div className="search-bar" onClick={readOnly ? onTap : undefined}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder="Search restaurants, cuisines, dishes..."
        readOnly={readOnly}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        autoFocus={autoFocus}
        aria-label="Search restaurants, cuisines, dishes"
      />
    </div>
  );
}
```

- [ ] **Step 3: `app/src/styles/components.css`**

```css
/* --- RestaurantCard --- */
.restaurant-card {
  display: block; width: 240px; flex-shrink: 0;
  border-radius: var(--r-md); overflow: hidden;
  background: var(--off-white); box-shadow: var(--sh-raised);
  transition: transform var(--dur-fast) var(--ease-out-quart);
}
.restaurant-card:active { transform: scale(0.98); }
.restaurant-card__media { position: relative; aspect-ratio: 16 / 9; background: var(--dough); }
.restaurant-card__media img { width: 100%; height: 100%; object-fit: cover; }
.restaurant-card--closed .restaurant-card__media img { filter: grayscale(0.9); opacity: 0.75; }
.closed-badge {
  position: absolute; left: 8px; bottom: 8px;
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--tomato); color: var(--cream);
  font-size: 11px; font-weight: 600;
  border-radius: var(--r-pill); padding: 3px 8px;
}
.restaurant-card__body { padding: 10px 12px 12px; }
.restaurant-card__name { margin: 0; font-size: 16px; color: var(--navy); }
.restaurant-card__cuisines {
  margin: 2px 0 6px; font-size: 12px; color: var(--brown);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.restaurant-card__meta {
  margin: 0; display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--brown);
}
/* Gold-Is-Rare: the rating star (and menu prices) only. */
.restaurant-card__rating { display: inline-flex; align-items: center; gap: 3px; color: var(--gold-deep); }

/* Grid variant fills its cell instead of fixed row width */
.grid .restaurant-card { width: auto; }

/* --- Chip --- */
.chip {
  border: 1px solid var(--beige); background: var(--dough); color: var(--ink);
  border-radius: var(--r-pill); padding: 7px 14px; font-size: 13px; white-space: nowrap;
  transition: background var(--dur-fast) var(--ease-out-quart), color var(--dur-fast) var(--ease-out-quart);
}
.chip--selected { background: var(--navy); border-color: var(--navy); color: var(--cream); font-weight: 600; }

/* --- SectionRow --- */
.section-row { margin-top: var(--s-lg); }
.section-row__title { margin: 0 0 var(--s-sm); font-size: 19px; color: var(--navy); }
.section-row__scroller {
  display: flex; gap: var(--s-md); overflow-x: auto;
  padding: 2px 2px 10px; scroll-snap-type: x proximity;
  scrollbar-width: none;
}
.section-row__scroller::-webkit-scrollbar { display: none; }
.section-row__scroller > * { scroll-snap-align: start; }

/* --- SkeletonCard --- */
.skeleton-card { width: 240px; flex-shrink: 0; border-radius: var(--r-md); overflow: hidden; background: var(--off-white); }
.skeleton-card__media { aspect-ratio: 16 / 9; }
.skeleton-card__line { height: 12px; border-radius: 6px; margin: 10px 12px 0; }
.skeleton-card__line--short { width: 50%; margin-bottom: 12px; }
.skeleton-card__media, .skeleton-card__line {
  background: linear-gradient(90deg, var(--dough) 25%, var(--beige) 50%, var(--dough) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}
@keyframes skeleton-shimmer { to { background-position: -200% 0; } }
.grid .skeleton-card { width: auto; }

/* --- SearchBar --- */
.search-bar {
  display: flex; align-items: center; gap: 8px;
  background: var(--off-white); border: 1px solid var(--beige);
  border-radius: var(--r-pill); padding: 10px 14px; color: var(--brown);
}
.search-bar:focus-within { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(227, 175, 4, 0.25); }
.search-bar input {
  flex: 1; border: none; background: none; outline: none;
  font: inherit; color: var(--ink); min-width: 0;
}
.search-bar input::placeholder { color: var(--brown); opacity: 0.7; }
```

- [ ] **Step 4: Import in `app/src/main.tsx`**

Add `import "./styles/components.css";` after the `shell.css` import.

- [ ] **Step 5: Verify build + commit**

Run (from `app/`): `npm run build` → expect success (components are compiled even before any screen uses them, via the tsc project include; if `tsc -b` flags them as unused files, that's fine — Vite build must pass).

```powershell
git add app
git commit -m "feat(app): shared browse components - card, chip, section row, skeleton, search bar"
git push
```

---

### Task 15: Home screen — feed, chips, grid, pull-to-refresh

**Files:**
- Create: `app/src/screens/HomeScreen.tsx`, `app/src/hooks/usePullToRefresh.ts`
- Create: `app/src/styles/home.css`
- Modify: `app/src/App.tsx` (swap the Home placeholder), `app/src/main.tsx` (import `./styles/home.css`)

**Interfaces:**
- Consumes: `apiGet`, types, all Task 14 components.
- Produces: the `/` route. Behavior (spec §6):
  - Sticky header: location pill `Deliver to · Demo Address` (static) + read-only `SearchBar` that navigates to `/search`.
  - Cuisine chip row from `home.cuisines`; **"All" first**. "All" selected → the four `SectionRow`s + All Restaurants grid. A cuisine chip selected → sections hidden, grid filtered live via `/api/restaurants?cuisine=`.
  - Grid: infinite scroll (IntersectionObserver sentinel) + sort select (`popular` / `rating` / `delivery_time`).
  - Skeletons while loading; single friendly retry state on failure; pull-to-refresh re-fetches the feed.

- [ ] **Step 1: `app/src/hooks/usePullToRefresh.ts`**

```ts
import { useEffect, useRef, useState, type RefObject } from "react";

const THRESHOLD_PX = 70;

/** Minimal touch pull-to-refresh: when the window is scrolled to the top and
 *  the user drags down past the threshold, calls onRefresh once. */
export function usePullToRefresh(ref: RefObject<HTMLElement | null>, onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      if (e.touches[0].clientY - startY.current > THRESHOLD_PX) {
        startY.current = null;
        setRefreshing(true);
        void onRefresh().finally(() => setRefreshing(false));
      }
    };
    const onTouchEnd = () => { startY.current = null; };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onRefresh]);

  return refreshing;
}
```

- [ ] **Step 2: `app/src/screens/HomeScreen.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { HomeResponse, RestaurantCard, RestaurantListResponse, RestaurantSort } from "../lib/types";
import { RestaurantCardView } from "../components/RestaurantCard";
import { Chip } from "../components/Chip";
import { SectionRow } from "../components/SectionRow";
import { SkeletonCard } from "../components/SkeletonCard";
import { SearchBar } from "../components/SearchBar";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const SORT_LABELS: Record<RestaurantSort, string> = {
  popular: "Most popular", rating: "Top rated", delivery_time: "Fastest delivery",
};

type FeedState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; home: HomeResponse };

export function HomeScreen() {
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  const [feed, setFeed] = useState<FeedState>({ status: "loading" });
  const [cuisine, setCuisine] = useState<string>("All");
  const [sort, setSort] = useState<RestaurantSort>("popular");

  // All Restaurants grid (also serves as the filtered feed when a chip is active)
  const [gridItems, setGridItems] = useState<RestaurantCard[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [gridTotal, setGridTotal] = useState<number | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async () => {
    setFeed({ status: "loading" });
    try {
      setFeed({ status: "ready", home: await apiGet<HomeResponse>("/api/customer/home") });
    } catch {
      setFeed({ status: "error" });
    }
  }, []);

  useEffect(() => { void loadFeed(); }, [loadFeed]);

  // Reset the grid whenever the filter or sort changes.
  useEffect(() => {
    setGridItems([]);
    setGridPage(1);
    setGridTotal(null);
  }, [cuisine, sort]);

  // Load grid pages.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setGridLoading(true);
      try {
        const params = new URLSearchParams({ page: String(gridPage), sort });
        if (cuisine !== "All") params.set("cuisine", cuisine);
        const res = await apiGet<RestaurantListResponse>(`/api/restaurants?${params}`);
        if (cancelled) return;
        setGridItems((prev) => (gridPage === 1 ? res.restaurants : [...prev, ...res.restaurants]));
        setGridTotal(res.total);
      } catch {
        if (!cancelled && gridPage === 1) setGridTotal(0);
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [cuisine, sort, gridPage]);

  // Infinite scroll sentinel.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      const hasMore = gridTotal !== null && gridItems.length < gridTotal;
      if (entries[0].isIntersecting && hasMore && !gridLoading) {
        setGridPage((p) => p + 1);
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [gridItems.length, gridTotal, gridLoading]);

  const refreshing = usePullToRefresh(mainRef, useCallback(async () => {
    setGridItems([]); setGridPage(1); setGridTotal(null);
    await loadFeed();
  }, [loadFeed]));

  const cuisines = feed.status === "ready" ? feed.home.cuisines : [];

  return (
    <main className="screen home" ref={mainRef}>
      <header className="home__header">
        <button className="location-pill" type="button" aria-label="Delivery address (demo)">
          <span className="location-pill__label">Deliver to</span>
          <span className="location-pill__value">· Demo Address</span>
        </button>
        <SearchBar readOnly onTap={() => navigate("/search")} />
      </header>

      {refreshing && <p className="home__refreshing mono" role="status">Refreshing…</p>}

      {feed.status === "error" ? (
        <div className="home__error">
          <p>Couldn't load the feed — check your connection and try again.</p>
          <button className="btn-retry" onClick={() => void loadFeed()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="chip-row" role="group" aria-label="Filter by cuisine">
            <Chip label="All" selected={cuisine === "All"} onClick={() => setCuisine("All")} />
            {cuisines.map((c) => (
              <Chip key={c} label={c} selected={cuisine === c} onClick={() => setCuisine(c)} />
            ))}
          </div>

          {cuisine === "All" && (
            feed.status === "loading" ? (
              <SectionRow title=" ">
                {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
              </SectionRow>
            ) : (
              feed.home.sections.map((section) => (
                <SectionRow key={section.key} title={section.title}>
                  {section.restaurants.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
                </SectionRow>
              ))
            )
          )}

          <section className="all-restaurants">
            <div className="all-restaurants__head">
              <h2 className="serif">{cuisine === "All" ? "All Restaurants" : cuisine}</h2>
              <select className="sort-select" value={sort} aria-label="Sort restaurants"
                onChange={(e) => setSort(e.target.value as RestaurantSort)}>
                {(Object.keys(SORT_LABELS) as RestaurantSort[]).map((key) => (
                  <option key={key} value={key}>{SORT_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div className="grid">
              {gridItems.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
              {gridLoading && Array.from({ length: 4 }, (_, i) => <SkeletonCard key={`s${i}`} />)}
            </div>
            {gridTotal === 0 && <p className="home__empty">No restaurants match this filter.</p>}
            <div ref={sentinelRef} aria-hidden="true" />
          </section>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: `app/src/styles/home.css`**

```css
.home { padding-top: 0; }
.home__header {
  position: sticky; top: 0; z-index: var(--z-sticky);
  background: var(--bg); padding: var(--s-md) 0 var(--s-sm);
  display: flex; flex-direction: column; gap: var(--s-sm);
}
.location-pill {
  align-self: flex-start; display: inline-flex; gap: 4px; align-items: baseline;
  background: none; border: none; padding: 0; color: var(--brown); font-size: 13px;
}
.location-pill__value { color: var(--navy); font-weight: 600; }

.home__refreshing { color: var(--brown); font-size: 12px; text-align: center; margin: var(--s-sm) 0 0; }

.chip-row {
  display: flex; gap: var(--s-sm); overflow-x: auto;
  padding: var(--s-sm) 2px; scrollbar-width: none;
}
.chip-row::-webkit-scrollbar { display: none; }

.home__error {
  display: flex; flex-direction: column; align-items: center; gap: var(--s-md);
  padding: var(--s-2xl) var(--s-lg); text-align: center; color: var(--brown);
}
.home__empty { color: var(--brown); text-align: center; padding: var(--s-lg) 0; }

.all-restaurants { margin-top: var(--s-lg); }
.all-restaurants__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--s-sm); }
.all-restaurants__head h2 { margin: 0; font-size: 19px; color: var(--navy); }
.sort-select {
  border: 1px solid var(--beige); background: var(--off-white); color: var(--ink);
  border-radius: var(--r-sm); padding: 6px 8px; font-size: 13px;
}
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--s-md); }
```

- [ ] **Step 4: Wire the route + styles**

In `app/src/App.tsx`: delete the `HomeScreen` placeholder const and add `import { HomeScreen } from "./screens/HomeScreen";`.
In `app/src/main.tsx`: add `import "./styles/home.css";`.

- [ ] **Step 5: Verify in the browser**

With backend (`backend/`: `npm run dev`) and app (`app/`: `npm run dev`) running and a valid token in localStorage (Task 13 Step 7), open `http://localhost:5173/app/`:
- Four feed rows render with real seeded restaurants; skeletons flash first.
- Chips show 8 cuisines; tapping "Pizza" hides the rows and shows a filtered grid; "All" restores.
- Grid loads 12, then more as you scroll to the bottom (20 total → one extra page).
- Sort select reorders (check "Fastest delivery" puts a ≤21-min restaurant first).
- DevTools → Network → Offline, then reload: friendly retry state (and the token must survive — check localStorage).

- [ ] **Step 6: Commit and push**

```powershell
git add app
git commit -m "feat(app): home screen - feed sections, cuisine chips, grid, pull-to-refresh"
git push
```

---

### Task 16: Restaurant detail screen

**Files:**
- Create: `app/src/screens/RestaurantScreen.tsx`
- Create: `app/src/styles/restaurant.css`
- Modify: `app/src/App.tsx` (swap placeholder), `app/src/main.tsx` (import `./styles/restaurant.css`)

**Interfaces:**
- Consumes: `apiGet`, `RestaurantDetail` type, `formatPrice`/`formatRating` (Task 12), `SkeletonCard` (Task 14).
- Produces: the `/restaurant/:id` route (spec §6): hero, serif name, cuisine tags, mono rating + count, address, hours, "Closed now" banner; sticky category tabs; menu rows with gold mono price and "Unavailable" dimming; **no Add buttons** (Phase 2); reviews section with "See all".

- [ ] **Step 1: `app/src/screens/RestaurantScreen.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, NetworkError } from "../lib/api";
import type { RestaurantDetail } from "../lib/types";
import { formatPrice, formatRating } from "../lib/format";

const INITIAL_REVIEWS_SHOWN = 3;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; detail: RestaurantDetail };

export function RestaurantScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [allReviews, setAllReviews] = useState(false);
  const categoryRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    apiGet<RestaurantDetail>(`/api/restaurants/${id}`)
      .then((detail) => {
        if (cancelled) return;
        setState({ status: "ready", detail });
        setActiveCategory(detail.menu[0]?.category ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.message.includes("404")) setState({ status: "missing" });
        else setState({ status: "error", message: err instanceof NetworkError ? err.message : "Couldn't load this restaurant." });
      });
    return () => { cancelled = true; };
  }, [id]);

  if (state.status === "loading") {
    return <main className="screen restaurant"><div className="restaurant__hero-skeleton" aria-label="Loading" role="status" /></main>;
  }
  if (state.status === "missing") {
    return (
      <main className="screen restaurant restaurant--message">
        <p>This restaurant is no longer available.</p>
        <button className="btn-retry" onClick={() => navigate("/")}>Back to Home</button>
      </main>
    );
  }
  if (state.status === "error") {
    return (
      <main className="screen restaurant restaurant--message">
        <p>{state.message}</p>
        <button className="btn-retry" onClick={() => navigate(0)}>Try again</button>
      </main>
    );
  }

  const r = state.detail;
  const reviewsShown = allReviews ? r.reviews : r.reviews.slice(0, INITIAL_REVIEWS_SHOWN);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    categoryRefs.current.get(category)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="screen restaurant">
      <div className="restaurant__hero">
        <img src={r.heroImageUrl} alt="" />
        <button className="restaurant__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      <header className="restaurant__head">
        <h1 className="serif">{r.name}</h1>
        <p className="restaurant__cuisines">{r.cuisines.join(" · ")}</p>
        <p className="restaurant__meta mono">
          <span className="restaurant__rating">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
            </svg>
            {formatRating(r.avgRating)}
          </span>
          {" "}({r.ratingCount} reviews) · {r.estDeliveryMin} min
        </p>
        <p className="restaurant__address">{r.address}</p>
        <p className="restaurant__hours mono">Open {r.opensAt} – {r.closesAt}</p>
        {!r.isOpenNow && (
          <p className="restaurant__closed-banner" role="status">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
            </svg>
            Closed now — you can browse the menu
          </p>
        )}
      </header>

      <nav className="category-tabs" aria-label="Menu categories">
        {r.menu.map((group) => (
          <button key={group.category} type="button"
            className={`category-tabs__tab${group.category === activeCategory ? " category-tabs__tab--active" : ""}`}
            onClick={() => scrollToCategory(group.category)}>
            {group.category}
          </button>
        ))}
      </nav>

      {r.menu.map((group) => (
        <section key={group.category} className="menu-category"
          ref={(el) => { if (el) categoryRefs.current.set(group.category, el); }}>
          <h2 className="serif">{group.category}</h2>
          {group.items.map((item) => (
            <article key={item.id} className={`menu-row${item.isAvailable ? "" : " menu-row--unavailable"}`}>
              <div className="menu-row__text">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <p className="menu-row__price mono">{formatPrice(item.priceCents)}</p>
                {!item.isAvailable && <span className="menu-row__unavailable-label">Unavailable</span>}
              </div>
              {item.imageUrl && <img className="menu-row__thumb" src={item.imageUrl} alt="" loading="lazy" />}
            </article>
          ))}
        </section>
      ))}

      <section className="reviews">
        <h2 className="serif">Reviews</h2>
        {reviewsShown.map((review) => (
          <article key={review.id} className="review">
            <div className="review__stars" aria-label={`${review.stars} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <svg key={i} viewBox="0 0 24 24" width="13" height="13"
                  fill={i < review.stars ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
                </svg>
              ))}
            </div>
            <p className="review__text">{review.reviewText}</p>
            <p className="review__author">{review.authorName}</p>
          </article>
        ))}
        {!allReviews && r.reviews.length > INITIAL_REVIEWS_SHOWN && (
          <button className="btn-retry" onClick={() => setAllReviews(true)}>
            See all ({r.ratingCount})
          </button>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: `app/src/styles/restaurant.css`**

```css
.restaurant { padding: 0 0 calc(64px + var(--s-md)); }
.restaurant--message {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--s-md); padding: var(--s-2xl) var(--s-lg); text-align: center; color: var(--brown);
}
.restaurant__hero { position: relative; aspect-ratio: 16 / 9; background: var(--dough); }
.restaurant__hero img { width: 100%; height: 100%; object-fit: cover; }
.restaurant__hero-skeleton {
  aspect-ratio: 16 / 9;
  background: linear-gradient(90deg, var(--dough) 25%, var(--beige) 50%, var(--dough) 75%);
  background-size: 200% 100%; animation: skeleton-shimmer 1.4s ease infinite;
}
.restaurant__back {
  position: absolute; top: var(--s-md); left: var(--s-md);
  width: 36px; height: 36px; border-radius: 50%; border: none;
  background: var(--cream); color: var(--navy); box-shadow: var(--sh-raised);
  display: flex; align-items: center; justify-content: center;
}
.restaurant__head { padding: var(--s-md); }
.restaurant__head h1 { margin: 0; font-size: 24px; color: var(--navy); }
.restaurant__cuisines { margin: 4px 0 8px; color: var(--brown); font-size: 13px; }
.restaurant__meta { margin: 0 0 6px; font-size: 13px; color: var(--brown); }
.restaurant__rating { color: var(--gold-deep); display: inline-flex; align-items: center; gap: 3px; }
.restaurant__address, .restaurant__hours { margin: 0 0 4px; font-size: 13px; color: var(--brown); }
/* Tricolore-Means-Status: tomato + icon + label for closed */
.restaurant__closed-banner {
  display: inline-flex; align-items: center; gap: 6px;
  margin: var(--s-sm) 0 0; padding: 6px 12px;
  background: rgba(199, 37, 49, 0.1); color: var(--tomato);
  border-radius: var(--r-sm); font-size: 13px; font-weight: 600;
}

.category-tabs {
  position: sticky; top: 0; z-index: var(--z-sticky);
  display: flex; gap: var(--s-sm); overflow-x: auto;
  background: var(--bg); padding: var(--s-sm) var(--s-md);
  border-bottom: 1px solid var(--dough); scrollbar-width: none;
}
.category-tabs::-webkit-scrollbar { display: none; }
.category-tabs__tab {
  border: none; background: none; padding: 6px 2px; white-space: nowrap;
  color: var(--brown); font-size: 14px; border-bottom: 2px solid transparent;
  transition: color var(--dur-fast) var(--ease-out-quart);
}
.category-tabs__tab--active { color: var(--navy); font-weight: 600; border-bottom-color: var(--navy); }

.menu-category { padding: var(--s-md); scroll-margin-top: 48px; }
.menu-category h2 { margin: 0 0 var(--s-sm); font-size: 18px; color: var(--navy); }
.menu-row {
  display: flex; gap: var(--s-md); align-items: flex-start;
  padding: var(--s-sm) 0; border-bottom: 1px solid var(--dough);
}
.menu-row__text { flex: 1; min-width: 0; }
.menu-row h3 { margin: 0; font-size: 15px; font-weight: 600; }
.menu-row p { margin: 2px 0; font-size: 13px; color: var(--brown);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
/* Gold-Is-Rare: menu price */
.menu-row__price { color: var(--gold-deep); font-weight: 500; }
.menu-row__thumb { width: 72px; height: 72px; object-fit: cover; border-radius: var(--r-sm); flex-shrink: 0; }
.menu-row--unavailable .menu-row__text h3,
.menu-row--unavailable .menu-row__text p,
.menu-row--unavailable .menu-row__thumb { opacity: 0.45; }
.menu-row__unavailable-label { font-size: 12px; color: var(--brown); font-weight: 600; }

.reviews { padding: var(--s-md); }
.reviews h2 { margin: 0 0 var(--s-sm); font-size: 18px; color: var(--navy); }
.review { padding: var(--s-sm) 0; border-bottom: 1px solid var(--dough); }
.review__stars { color: var(--gold-deep); display: flex; gap: 2px; }
.review__text { margin: 6px 0 2px; font-size: 14px; }
.review__author { margin: 0; font-size: 12px; color: var(--brown); }
```

- [ ] **Step 3: Wire route + styles**

`app/src/App.tsx`: remove the `RestaurantScreen` placeholder const, add `import { RestaurantScreen } from "./screens/RestaurantScreen";`.
`app/src/main.tsx`: add `import "./styles/restaurant.css";`.

- [ ] **Step 4: Verify in the browser**

From Home, tap a card: hero + name + mono rating + address + hours render; category tabs stick under the top while scrolling and jump on tap; prices are gold mono; a few items are dimmed "Unavailable"; reviews show 3 with "See all (N)" expanding to 5. Open a restaurant that is currently closed (e.g. a breakfast/late-night one, depending on time): tomato "Closed now" banner shows. Direct-load a bad id (`/app/restaurant/nope`): "no longer available" state.

- [ ] **Step 5: Commit and push**

```powershell
git add app
git commit -m "feat(app): restaurant detail - grouped menu, sticky category tabs, reviews"
git push
```

---

### Task 17: Search screen

**Files:**
- Create: `app/src/screens/SearchScreen.tsx`
- Create: `app/src/styles/search.css`
- Modify: `app/src/App.tsx` (swap placeholder), `app/src/main.tsx` (import `./styles/search.css`)

**Interfaces:**
- Consumes: `apiGet`, `SearchResponse` type, `SearchBar`/`RestaurantCardView` (Task 14), `formatPrice`.
- Produces: the `/search` route (spec §6): recent searches (localStorage key `feastnow_recent_searches`, max 8, clearable), 300ms-debounced live results grouped **Restaurants** / **Dishes**, dish tap → its restaurant's detail, "No matches" state.

- [ ] **Step 1: `app/src/screens/SearchScreen.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import type { SearchResponse } from "../lib/types";
import { SearchBar } from "../components/SearchBar";
import { RestaurantCardView } from "../components/RestaurantCard";
import { formatPrice } from "../lib/format";

const RECENT_KEY = "feastnow_recent_searches";
const MAX_RECENT = 8;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function readRecent(): string[] {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[]; }
  catch { return []; }
}

function pushRecent(term: string): string[] {
  const next = [term, ...readRecent().filter((t) => t !== term)].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number>();

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await apiGet<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(res);
        setRecent(pushRecent(q));
      } catch {
        setResults({ restaurants: [], dishes: [] });
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  const noMatches = results !== null && !searching
    && results.restaurants.length === 0 && results.dishes.length === 0;

  return (
    <main className="screen search">
      <header className="search__header">
        <button className="search__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <SearchBar value={query} onChange={setQuery} autoFocus />
      </header>

      {results === null && recent.length > 0 && (
        <section className="recent">
          <div className="recent__head">
            <h2 className="serif">Recent searches</h2>
            <button className="recent__clear" onClick={() => {
              window.localStorage.removeItem(RECENT_KEY);
              setRecent([]);
            }}>Clear</button>
          </div>
          {recent.map((term) => (
            <button key={term} className="recent__item" onClick={() => setQuery(term)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
              {term}
            </button>
          ))}
        </section>
      )}

      {searching && <p className="search__status mono" role="status">Searching…</p>}
      {noMatches && <p className="search__status">No matches for “{query.trim()}”.</p>}

      {results && results.restaurants.length > 0 && (
        <section className="search__group">
          <h2 className="serif">Restaurants</h2>
          <div className="grid">
            {results.restaurants.map((r) => <RestaurantCardView key={r.id} restaurant={r} />)}
          </div>
        </section>
      )}

      {results && results.dishes.length > 0 && (
        <section className="search__group">
          <h2 className="serif">Dishes</h2>
          {results.dishes.map((dish) => (
            <Link key={dish.id} to={`/restaurant/${dish.restaurantId}`} className="dish-hit">
              {dish.imageUrl
                ? <img className="dish-hit__thumb" src={dish.imageUrl} alt="" loading="lazy" />
                : <div className="dish-hit__thumb dish-hit__thumb--empty" aria-hidden="true" />}
              <div className="dish-hit__text">
                <h3>{dish.name}</h3>
                <p>{dish.restaurantName}</p>
              </div>
              <span className="dish-hit__price mono">{formatPrice(dish.priceCents)}</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 2: `app/src/styles/search.css`**

```css
.search__header {
  position: sticky; top: 0; z-index: var(--z-sticky);
  display: flex; align-items: center; gap: var(--s-sm);
  background: var(--bg); padding: var(--s-md) 0 var(--s-sm);
}
.search__header .search-bar { flex: 1; }
.search__back {
  border: none; background: none; color: var(--navy);
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
}
.search__status { color: var(--brown); text-align: center; padding: var(--s-lg) 0; }

.recent__head { display: flex; justify-content: space-between; align-items: center; }
.recent__head h2 { font-size: 16px; color: var(--navy); margin: var(--s-md) 0 var(--s-sm); }
.recent__clear { border: none; background: none; color: var(--tomato); font-size: 13px; font-weight: 600; }
.recent__item {
  display: flex; align-items: center; gap: var(--s-sm); width: 100%;
  border: none; background: none; text-align: left;
  padding: 10px 2px; color: var(--ink); font-size: 14px;
  border-bottom: 1px solid var(--dough);
}
.recent__item svg { color: var(--brown); }

.search__group h2 { font-size: 17px; color: var(--navy); margin: var(--s-lg) 0 var(--s-sm); }
.dish-hit {
  display: flex; align-items: center; gap: var(--s-md);
  padding: var(--s-sm) 0; border-bottom: 1px solid var(--dough);
}
.dish-hit__thumb { width: 56px; height: 56px; border-radius: var(--r-sm); object-fit: cover; flex-shrink: 0; }
.dish-hit__thumb--empty { background: var(--dough); }
.dish-hit__text { flex: 1; min-width: 0; }
.dish-hit__text h3 { margin: 0; font-size: 14px; font-weight: 600; }
.dish-hit__text p { margin: 2px 0 0; font-size: 12px; color: var(--brown); }
.dish-hit__price { color: var(--gold-deep); font-size: 13px; }
```

- [ ] **Step 3: Wire route + styles**

`app/src/App.tsx`: remove the `SearchScreen` placeholder const, add `import { SearchScreen } from "./screens/SearchScreen";`.
`app/src/main.tsx`: add `import "./styles/search.css";`.

- [ ] **Step 4: Verify in the browser**

Tap the Home search bar → `/search` with keyboard focus. Type "biryani": after a beat, **Restaurants** (Biryani Adda) and **Dishes** (Chicken Biryani entries with restaurant names) groups appear; tapping a dish opens its restaurant. Type "zzzz": "No matches". Clear the field: recent searches list shows "biryani"; Clear empties it (check localStorage).

- [ ] **Step 5: Commit and push**

```powershell
git add app
git commit -m "feat(app): search screen - recents, debounced grouped results"
git push
```

---

### Task 18: PWA installability — manifest, icons, minimal service worker

**Files:**
- Create: `app/public/manifest.webmanifest`, `app/public/sw.js`, `app/scripts/makeIcons.mjs`
- Create (generated): `app/public/icons/icon-192.png`, `app/public/icons/icon-512.png`
- Modify: `app/index.html`, `app/src/main.tsx`

**Interfaces:**
- Consumes: `landing/favicon.svg` (source artwork).
- Produces: installable PWA at `/app/` (spec §5 — interim install story until the Capacitor wrap; full offline support explicitly out of scope).

- [ ] **Step 1: Generate icons**

`app/scripts/makeIcons.mjs`:

```js
// One-off: rasterize the landing favicon into PWA icons.
// Run from app/: npm i -D sharp && node scripts/makeIcons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp("../landing/favicon.svg", { density: 300 })
    .resize(size, size, { fit: "contain", background: "#0F2C56" })
    .flatten({ background: "#0F2C56" })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png written`);
}
```

Run (from `app/`): `npm install -D sharp` then `node scripts/makeIcons.mjs`. Open both PNGs and confirm the mark is visible on the navy background.

- [ ] **Step 2: `app/public/manifest.webmanifest`**

```json
{
  "name": "FeastNow",
  "short_name": "FeastNow",
  "description": "Order from the best local restaurants.",
  "start_url": "/app/",
  "scope": "/app/",
  "display": "standalone",
  "background_color": "#FFFCF0",
  "theme_color": "#0F2C56",
  "icons": [
    { "src": "/app/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/app/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: `app/public/sw.js` — minimal, network-first, no offline promise**

```js
// Minimal service worker: qualifies the app as installable. Full offline
// support is out of scope for Phase 1 (spec §5).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 4: Wire into `app/index.html` and `app/src/main.tsx`**

`app/index.html` `<head>` additions:

```html
<link rel="manifest" href="/app/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/app/icons/icon-192.png" />
<link rel="icon" href="/app/icons/icon-192.png" type="image/png" />
```

`app/src/main.tsx`, after the render call:

```ts
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
  });
}
```

- [ ] **Step 5: Verify**

Run (from `app/`): `npm run build && npm run preview`, open `http://localhost:4173/app/` in Chrome → DevTools → Application: Manifest parses with both icons, no errors; Service Workers shows `sw.js` activated. (Install prompt criteria are fully checkable only on HTTPS — re-verified on production in Task 21.)

- [ ] **Step 6: Commit and push**

```powershell
git add app
git commit -m "feat(app): PWA installability - manifest, icons, minimal service worker"
git push
```

---

### Task 19: Auth handoff + Vercel single-site assembly

**Files:**
- Modify: `landing/assets/js/login.js:37`, `landing/assets/js/signup.js:137`
- Create: `scripts/build-site.mjs`, `vercel.json` (repo root), `package.json` (repo root), `.gitignore` entry
- Delete: `landing/vercel.json` (its settings move to the root file)

**Interfaces:**
- Consumes: `app/` build (Tasks 12–18), `landing/*` static files.
- Produces: one Vercel deployment — `landing/*` at `/`, SPA at `/app/` with an SPA rewrite. Login/signup land on `/app/` (spec §5; `welcome.html` stays in the repo but is no longer the destination).
- ⚠️ **Manual dashboard step (user):** the Vercel project currently builds with Root Directory = `landing`. Before pushing this task, in Vercel → Project → Settings → Build & Development: set **Root Directory to the repo root**, Framework Preset **Other**. The root `vercel.json` then supplies build command and output directory. Coordinate: push this task's commit immediately after the setting change.

- [ ] **Step 1: Redirect logins into the app**

`landing/assets/js/login.js` line 37: `window.location.href = "welcome.html";` → `window.location.href = "/app/";`
`landing/assets/js/signup.js` line 137: `setTimeout(() => { window.location.href = "welcome.html"; }, 500);` → `setTimeout(() => { window.location.href = "/app/"; }, 500);`

- [ ] **Step 2: Root `package.json` and build script**

`package.json` (repo root):

```json
{
  "name": "feastnow-site",
  "private": true,
  "scripts": {
    "build": "node scripts/build-site.mjs"
  }
}
```

`scripts/build-site.mjs`:

```js
// Assembles the deployed site: landing/* at the root + the SPA under /app/.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";

execSync("npm ci", { cwd: "app", stdio: "inherit" });
execSync("npm run build", { cwd: "app", stdio: "inherit" });

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync("landing", "dist", { recursive: true });
cpSync("app/dist", "dist/app", { recursive: true });
console.log("Site assembled in dist/");
```

Append to the root `.gitignore`:

```
dist/
```

- [ ] **Step 3: Move Vercel config to the root**

Create `vercel.json` (repo root) — carries over the landing settings and adds build + SPA rewrite:

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/app/:path*", "destination": "/app/index.html" }
  ]
}
```

Delete `landing/vercel.json`. (Vercel rewrites apply only when no file matches, so `/app/assets/*.js` still serves the real files; deep links like `/app/restaurant/123` fall through to the SPA.)

- [ ] **Step 4: Verify the assembly locally**

From the repo root: `npm run build`
Expected: `dist/index.html`, `dist/login.html`, `dist/welcome.html`, `dist/app/index.html`, `dist/app/assets/*`, `dist/app/manifest.webmanifest` all exist and `dist/vercel.json` does **not** (it was deleted from `landing/` before the copy).

Quick serve check: `npx serve dist -l 4173` → `http://localhost:4173/` shows the landing page; `http://localhost:4173/app/` boots the SPA (login redirect fires without a token).

- [ ] **Step 5: Confirm the dashboard change, then commit and push**

Ask the user to flip the Root Directory setting (see ⚠️ above). Then:

```powershell
git add landing/assets/js/login.js landing/assets/js/signup.js scripts/build-site.mjs vercel.json package.json .gitignore
git rm landing/vercel.json
git commit -m "feat(site): serve SPA at /app/ alongside landing; login lands in the app"
git push
```

Watch the Vercel deploy complete, then check `https://<production-domain>/` (landing intact) and `/app/` (redirects to `/login` without a session).

---

### Task 20: Playwright smoke test + screenshots

**Files:**
- Create: `app/playwright.config.ts`, `app/tests/smoke.spec.ts`
- Create: `backend/scripts/createTestUser.ts`
- Modify: `app/package.json` (scripts)

**Interfaces:**
- Consumes: local backend (`backend/`: `npm run dev`) against the seeded Supabase DB; the full SPA.
- Produces: spec §8 smoke — authenticated boot → feed sections render → restaurant detail (menu + reviews) → search grouped results; screenshots in `app/tests/screenshots/` for design-system eyeballing. Login is performed via the API (the landing login UI was already verified in the auth phase; production handoff is re-verified in Task 21).

- [ ] **Step 1: Test-user script `backend/scripts/createTestUser.ts`**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

// Upserts a known customer account for automated smoke tests.
// Usage (from backend/): TEST_USER_PASSWORD=<pw> npx tsx scripts/createTestUser.ts
async function main() {
  const password = process.env.TEST_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Set TEST_USER_PASSWORD (min 8 chars).");
  }
  const prisma = new PrismaClient();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: "smoke.customer@feastnow.demo" },
    update: { passwordHash },
    create: {
      name: "Smoke Customer", email: "smoke.customer@feastnow.demo",
      phone: "+920000000001", passwordHash, role: "customer",
    },
  });
  console.log(`Test user ready: ${user.email}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
```

(Check `backend/src/lib/password.ts` for the exact exported hash function name — if it differs from `hashPassword`, use the actual export.)

Run (from `backend/`, PowerShell): `$env:TEST_USER_PASSWORD = "<pick-one>"; npx tsx scripts/createTestUser.ts`

- [ ] **Step 2: Install Playwright and configure**

From `app/`: `npm install -D @playwright/test` then `npx playwright install chromium`.

`app/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 }, // phone frame
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/app/",
    reuseExistingServer: true,
  },
});
```

Add to `app/package.json` scripts: `"test:e2e": "playwright test"`.

- [ ] **Step 3: `app/tests/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const API = process.env.API_BASE_URL ?? "http://localhost:3000";
const EMAIL = "smoke.customer@feastnow.demo";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

test("browse smoke: feed → detail → search", async ({ page, request }) => {
  expect(PASSWORD, "Set TEST_USER_PASSWORD").not.toBe("");

  // Login via API (UI login flow was verified in the auth phase).
  const login = await request.post(`${API}/api/auth/login`, {
    data: { identifier: EMAIL, password: PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { token } = await login.json() as { token: string };
  await page.addInitScript((t: string) => localStorage.setItem("feastnow_token", t), token);

  // Home feed renders sections with cards.
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "Most Popular Near You" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Top Rated" })).toBeVisible();
  await expect(page.locator(".restaurant-card").first()).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/home.png", fullPage: true });

  // Restaurant detail: menu categories + reviews.
  await page.locator(".restaurant-card").first().click();
  await expect(page.locator(".menu-category").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".menu-row__price").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/restaurant.png", fullPage: true });

  // Search: grouped results, dish carries restaurant.
  await page.goto("/app/search");
  await page.getByLabel("Search restaurants, cuisines, dishes").fill("biryani");
  await expect(page.getByRole("heading", { name: "Dishes" })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "tests/screenshots/search.png", fullPage: true });
  await page.locator(".dish-hit").first().click();
  await expect(page.locator(".menu-category").first()).toBeVisible();
});
```

- [ ] **Step 4: Run it**

Terminal 1 (from `backend/`): `npm run dev` (ensure `.env` `FRONTEND_ORIGIN` includes `http://localhost:5173`).
Terminal 2 (from `app/`, PowerShell): `$env:TEST_USER_PASSWORD = "<same-as-step-1>"; npm run test:e2e`
Expected: 1 passed. Open the three screenshots and eyeball against DESIGN.md: cream canvas, navy ink, serif names, mono numerics, gold only on stars/prices, closed cards grayed with tomato badge. Fix any divergence before committing (Reference-fidelity rule).

- [ ] **Step 5: Commit and push**

```powershell
git add app/playwright.config.ts app/tests app/package.json app/package-lock.json backend/scripts/createTestUser.ts
git commit -m "test(app): browse smoke test with screenshot verification"
git push
```

---

### Task 21: NFR-1 latency measurement + production verification

**Files:**
- Create: `backend/scripts/measureLatency.ts`
- Create: `docs/superpowers/verification/2026-07-phase1-latency.md`

**Interfaces:**
- Consumes: deployed Render backend + seeded DB; a valid JWT.
- Produces: recorded latency numbers for `/home`, `/restaurants`, `/search` (spec §8 — the ~2s NFR-1 budget is **verified, not assumed**), and a production end-to-end check.

- [ ] **Step 1: `backend/scripts/measureLatency.ts`**

```ts
import "dotenv/config";

// Usage (from backend/):
//   $env:TOKEN = "<jwt>"; $env:BASE = "https://feastnow.onrender.com"; npx tsx scripts/measureLatency.ts
const BASE = process.env.BASE ?? "http://localhost:3000";
const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error("Set TOKEN to a valid JWT (login via /api/auth/login).");

const TARGETS = [
  "/api/customer/home",
  "/api/restaurants?page=1",
  "/api/restaurants?search=karahi",
  "/api/search?q=biryani",
];
const RUNS = 5;

async function timeOnce(path: string): Promise<number> {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return performance.now() - start;
}

for (const path of TARGETS) {
  await timeOnce(path); // warm-up (Render cold start / connection setup)
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) times.push(await timeOnce(path));
  times.sort((a, b) => a - b);
  const median = times[Math.floor(RUNS / 2)].toFixed(0);
  const max = times[RUNS - 1].toFixed(0);
  console.log(`${path}  median ${median}ms  max ${max}ms  (${RUNS} runs after warm-up)`);
}
```

- [ ] **Step 2: Measure — local and production**

Get a token (login as the smoke user against each BASE). Run once with `BASE=http://localhost:3000` (local server, Supabase DB) and once with `BASE=https://feastnow.onrender.com`.
Expected: every median comfortably under 2000ms. If any median exceeds it, investigate (missing index, N+1) before recording.

- [ ] **Step 3: Record the numbers**

Create `docs/superpowers/verification/2026-07-phase1-latency.md`:

```markdown
# Phase 1 latency verification (NFR-1)

**Date:** <run date> · **Data:** 20 seeded demo restaurants (~220 menu items, ~110 ratings)
**Method:** backend/scripts/measureLatency.ts — 5 timed runs per endpoint after 1 warm-up, median/max recorded.

| Endpoint | Local median | Local max | Render median | Render max |
|---|---|---|---|---|
| GET /api/customer/home | _ms_ | _ms_ | _ms_ | _ms_ |
| GET /api/restaurants?page=1 | _ms_ | _ms_ | _ms_ | _ms_ |
| GET /api/restaurants?search=karahi | _ms_ | _ms_ | _ms_ | _ms_ |
| GET /api/search?q=biryani | _ms_ | _ms_ | _ms_ | _ms_ |

**Verdict:** NFR-1 (~2s search budget) PASS/FAIL at seed scale.
**Caveat (spec §9):** verified only at seed scale — re-benchmark as data grows.
```

Fill in the real numbers from Step 2.

- [ ] **Step 4: Production end-to-end check**

On the deployed site (phone or narrow browser window):
1. Log in via `/login` with a real account → lands on `/app/` with the feed.
2. Open a restaurant, run a search, check the Orders empty state and Profile.
3. Hard-load a deep link `https://<domain>/app/restaurant/<id>` → SPA boots (rewrite works).
4. DevTools → Application on the production URL: manifest OK, service worker active, "Install app" available in Chrome.
5. Confirm hero/dish images render (Unsplash URLs live) — swap any dead IDs in `seedData.ts` and re-seed if needed.

- [ ] **Step 5: Commit and push**

```powershell
git add backend/scripts/measureLatency.ts docs/superpowers/verification/2026-07-phase1-latency.md
git commit -m "docs: record Phase 1 NFR-1 latency verification"
git push
```

---

## Plan completion checklist (spec coverage)

- §3 schema + seed lifecycle → Tasks 1, 10, 11 (isDemo-only writes; purge script Task 1)
- §4 endpoints (`/home`, `/restaurants`, `/restaurants/:id`, `/search`, DTO, indexes) → Tasks 4–9
- §5 SPA, `/app/` deploy, auth handoff, shell, PWA, design system → Tasks 12–14, 18, 19
- §6 screens (Home, detail, search, Orders stub, Profile) → Tasks 13, 15–17
- §7 errors/loading/empty states → built into Tasks 13, 15–17 (retry states, skeletons, omitted sections server-side in Task 5)
- §8 testing + latency verification → per-task Vitest, Task 20 (Playwright + screenshots), Task 21 (NFR-1 numbers)
- Out of scope (§10) honored: no Add buttons, no cart, no real addresses, no order rows.







