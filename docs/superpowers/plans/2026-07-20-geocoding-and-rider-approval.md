# Restaurant Geocoding + Rider Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a newly-listed restaurant's orders reachable by riders (via address geocoding) and require admin approval for new riders.

**Architecture:** Two independent features, no DB migration (both target columns already exist and are nullable). Feature A adds a best-effort Nominatim geocode at restaurant signup, persisting `RestaurantProfile.lat/lng`, with an admin-side correction endpoint. Feature B flips new riders to `approvedAt: null` (pending), grandfathers existing riders, blocks pending riders from going online, and adds admin rider-approval endpoints + UI tab.

**Tech Stack:** Node + TypeScript + Express + Prisma (backend), Vitest + supertest (tests), React + Vite + TypeScript (frontend).

## Global Constraints

- TypeScript strict mode everywhere; all existing tests must stay green.
- Backend tests use Vitest + supertest with fake repositories; never hit the network or a real DB in unit tests (inject fakes).
- The delivery assignment engine skips orders where `restaurantLat == null || restaurantLng == null` (`backend/src/lib/deliveryAssignment.ts:21`) — restaurant coords are the whole point of Feature A.
- Admin routes are guarded by an array middleware spread as `...requireAdmin`.
- Money/enums/naming: follow existing patterns (camelCase TS, DTO transformers return ISO strings for dates).
- No Prisma schema or migration changes.
- Commit after each task with a conventional message.

**Run all backend tests:** `cd backend && npm test`
**Typecheck backend:** `cd backend && npx tsc --noEmit`
**Build frontend:** `cd app && npm run build`

---

## Feature A — Restaurant geocoding

### Task 1: Geocode module

**Files:**
- Create: `backend/src/lib/geocode.ts`
- Test: `backend/tests/lib/geocode.test.ts`

**Interfaces:**
- Produces: `type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>` and `geocodeAddress: GeocodeFn`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/lib/geocode.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress } from "../../src/lib/geocode";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("geocodeAddress", () => {
  it("returns lat/lng from the first Nominatim result", async () => {
    stubFetch(async () => new Response(JSON.stringify([{ lat: "24.8607", lon: "67.0011" }]), { status: 200 }));
    expect(await geocodeAddress("Karachi")).toEqual({ lat: 24.8607, lng: 67.0011 });
  });

  it("returns null when there are no results", async () => {
    stubFetch(async () => new Response(JSON.stringify([]), { status: 200 }));
    expect(await geocodeAddress("nowhere")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    stubFetch(async () => new Response("nope", { status: 500 }));
    expect(await geocodeAddress("x")).toBeNull();
  });

  it("returns null (never throws) when fetch rejects", async () => {
    stubFetch(async () => { throw new Error("network down"); });
    expect(await geocodeAddress("x")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/lib/geocode.test.ts`
Expected: FAIL — cannot find module `../../src/lib/geocode`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/lib/geocode.ts
export type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>;

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 5000;

// Best-effort geocode via OpenStreetMap Nominatim (free, no API key).
// Never throws: a geocode failure must not block restaurant signup.
export const geocodeAddress: GeocodeFn = async (address) => {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FeastNow/1.0 (support@feastnow.pk)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
```

Note: relies on global `fetch` (Node 18+). Confirm Render runs Node ≥18 (`node -v`); it does per the current backend. No polyfill needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/lib/geocode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/geocode.ts backend/tests/lib/geocode.test.ts
git commit -m "feat(geocode): add best-effort Nominatim address geocoder"
```

---

### Task 2: Persist coords at restaurant signup

**Files:**
- Modify: `backend/src/repositories/userRepository.ts` (`RestaurantOwnerSignup`, `createRestaurantOwner`)
- Modify: `backend/src/routes/authRouter.ts` (`AuthRouterDeps`, verify-otp handler)
- Modify: `backend/src/app.ts` (inject `geocode`)
- Modify: `backend/tests/routes/authRouter.test.ts` (`buildApp` signature + new tests)

**Interfaces:**
- Consumes: `GeocodeFn` from Task 1.
- Produces: `AuthRouterDeps.geocode: GeocodeFn`; `RestaurantOwnerSignup` gains `lat?: number | null; lng?: number | null`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/routes/authRouter.test.ts`. First update `buildApp` to accept and default a geocode fn:

```ts
// in buildApp's overrides type add:
//   geocode?: (address: string) => Promise<{ lat: number; lng: number } | null>;
// and inside buildApp:
const geocode = overrides.geocode ?? vi.fn().mockResolvedValue({ lat: 1, lng: 2 });
app.use("/api/auth", createAuthRouter({ userRepo, otpRepo, sendOtpEmail, geocode, jwtSecret: JWT_SECRET }));
// return geocode alongside the others:
return { app, userRepo, otpRepo, sendOtpEmail, geocode };
```

Then add tests. These reuse the existing helper that seeds a verified OTP challenge — mirror how other verify-otp tests in this file arrange a challenge (find the existing `describe("POST /api/auth/signup/verify-otp"` block and copy its OTP setup). The two new tests:

```ts
describe("restaurant signup geocoding", () => {
  it("geocodes the business address and persists lat/lng", async () => {
    const geocode = vi.fn().mockResolvedValue({ lat: 24.86, lng: 67.0 });
    // arrange a valid OTP challenge for owner@x.co exactly as the sibling verify-otp tests do
    const { app, userRepo } = buildAppWithChallenge({ email: "owner@x.co", geocode });
    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      email: "owner@x.co", otp: "123456", name: "Owner", phone: "03330000123",
      password: "Passw0rd!", role: "restaurant",
      businessName: "Nonna's", businessAddress: "12 Demo Lane, Karachi", cuisine: "Italian",
    });
    expect(res.status).toBe(200);
    expect(geocode).toHaveBeenCalledWith("12 Demo Lane, Karachi");
    expect(userRepo.lastRestaurantOwner).toMatchObject({ lat: 24.86, lng: 67.0 });
  });

  it("still creates the restaurant when geocoding returns null", async () => {
    const geocode = vi.fn().mockResolvedValue(null);
    const { app, userRepo } = buildAppWithChallenge({ email: "owner2@x.co", geocode });
    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      email: "owner2@x.co", otp: "123456", name: "Owner", phone: "03330000124",
      password: "Passw0rd!", role: "restaurant",
      businessName: "Trattoria", businessAddress: "Unknown place", cuisine: "Italian",
    });
    expect(res.status).toBe(200);
    expect(userRepo.lastRestaurantOwner).toMatchObject({ lat: null, lng: null });
  });
});
```

Implement a local `buildAppWithChallenge` helper in the test file that (a) builds an OTP challenge via `createFakeOtpRepository` + `hashOtp("123456")` seeded and active for the email — copy the exact arrangement already used by the passing verify-otp tests above — and (b) calls `buildApp({ otpRepo, geocode })`. If the existing tests already inline this arrangement, extract it into this helper and have them reuse it (DRY).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts`
Expected: FAIL — `createAuthRouter` deps missing `geocode` (type error) and/or `lastRestaurantOwner.lat` undefined.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/repositories/userRepository.ts`:

```ts
export interface RestaurantOwnerSignup {
  name: string; email: string; phone: string; passwordHash: string;
  businessName: string; businessAddress: string; cuisine: string;
  lat?: number | null; lng?: number | null;
}
```

```ts
// in createRestaurantOwner:
createRestaurantOwner(data) {
  const { businessName, businessAddress, cuisine, lat, lng, ...user } = data;
  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { ...user, role: "restaurant" } });
    await tx.restaurantProfile.create({
      data: {
        userId: created.id,
        name: businessName,
        description: "",
        address: businessAddress,
        cuisines: [cuisine],
        opensAt: "11:00",
        closesAt: "23:00",
        estDeliveryMin: 30,
        heroImageUrl: DEFAULT_HERO_IMAGE_URL,
        approvalStatus: "pending",
        approvedAt: null,
        lat: lat ?? null,
        lng: lng ?? null,
        isActive: true,
        isDemo: false,
      },
    });
    return created;
  });
},
```

In `backend/src/routes/authRouter.ts`:

```ts
import type { GeocodeFn } from "../lib/geocode";

export interface AuthRouterDeps {
  userRepo: UserRepository;
  otpRepo: OtpRepository;
  sendOtpEmail: (to: string, otp: string) => Promise<void>;
  geocode: GeocodeFn;
  jwtSecret: string;
}
```

In the verify-otp handler, replace the restaurant branch of the `createRestaurantOwner` call so it geocodes first:

```ts
// just before the `user = isRestaurant ? ...` assignment:
const coords = isRestaurant ? await deps.geocode(businessAddress.trim()) : null;
```

```ts
user = isRestaurant
  ? await deps.userRepo.createRestaurantOwner({
      name, email, phone, passwordHash,
      businessName: businessName.trim(), businessAddress: businessAddress.trim(), cuisine: cuisine.trim(),
      lat: coords?.lat ?? null, lng: coords?.lng ?? null,
    })
  : isPartner
  ? await deps.userRepo.createDeliveryPartner({ name, email, phone, passwordHash, vehicleType })
  : await deps.userRepo.create({ name, email, phone, passwordHash });
```

In `backend/src/app.ts`:

```ts
import { geocodeAddress } from "./lib/geocode";
// ...
app.use("/api/auth", createAuthRouter({
  userRepo, otpRepo, sendOtpEmail: config.sendOtpEmail, geocode: geocodeAddress, jwtSecret: config.jwtSecret,
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/authRouter.test.ts && npx tsc --noEmit`
Expected: PASS (existing + 2 new); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/userRepository.ts backend/src/routes/authRouter.ts backend/src/app.ts backend/tests/routes/authRouter.test.ts
git commit -m "feat(signup): geocode restaurant address into lat/lng at signup"
```

---

### Task 3: Admin endpoint to set/correct restaurant coordinates

**Files:**
- Modify: `backend/src/repositories/adminRepository.ts` (interface + impl: `setRestaurantLocation`)
- Modify: `backend/src/routes/adminRouter.ts` (`PATCH /approvals/:id/location`)
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts` (add `setRestaurantLocation`)
- Modify: `backend/tests/routes/adminRouter.test.ts` (new tests)

**Interfaces:**
- Produces: `AdminRepository.setRestaurantLocation(id: string, lat: number, lng: number): Promise<RestaurantProfile>`; route `PATCH /api/admin/approvals/:id/location` body `{ lat: number, lng: number }` → `{ restaurant }`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/routes/adminRouter.test.ts` (follow the file's existing admin-auth setup for building the app + admin token):

```ts
describe("PATCH /api/admin/approvals/:id/location", () => {
  it("sets restaurant coordinates", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app)
      .patch("/api/admin/approvals/r1/location")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lat: 24.86, lng: 67.0 });
    expect(res.status).toBe(200);
    expect(res.body.restaurant).toMatchObject({ lat: 24.86, lng: 67.0 });
  });

  it("rejects non-finite coordinates with 400", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app)
      .patch("/api/admin/approvals/r1/location")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lat: "x", lng: null });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown restaurant", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app)
      .patch("/api/admin/approvals/nope/location")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ lat: 1, lng: 2 });
    expect(res.status).toBe(404);
  });
});
```

(Reuse the existing `buildAdminApp`/token helper already in this test file; if it's named differently, use that name.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL — route returns 404/handler missing; fake repo lacks `setRestaurantLocation`.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/repositories/adminRepository.ts` interface add:

```ts
setRestaurantLocation(id: string, lat: number, lng: number): Promise<RestaurantProfile>;
```

Impl (next to `approveRestaurant`):

```ts
setRestaurantLocation(id, lat, lng) {
  return prisma.restaurantProfile.update({ where: { id }, data: { lat, lng } });
},
```

In `backend/tests/test-helpers/fakeAdminRepository.ts` add to the returned object:

```ts
async setRestaurantLocation(id, lat, lng) {
  const r = pending.find((x) => x.id === id) as any;
  r.lat = lat; r.lng = lng; return r;
},
```

In `backend/src/routes/adminRouter.ts` (after the reject route):

```ts
router.patch("/approvals/:id/location", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const { lat, lng } = req.body ?? {};
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat and lng must be finite numbers." });
  }
  const existing = await deps.adminRepo.findRestaurantById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Restaurant not found." });
  const updated = await deps.adminRepo.setRestaurantLocation(req.params.id, lat, lng);
  return res.status(200).json({ restaurant: updated });
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts && npx tsc --noEmit`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/adminRepository.ts backend/src/routes/adminRouter.ts backend/tests/test-helpers/fakeAdminRepository.ts backend/tests/routes/adminRouter.test.ts
git commit -m "feat(admin): endpoint to set/correct restaurant coordinates"
```

---

### Task 4: Admin approval UI — location display, edit, and warning

**Files:**
- Modify: `app/src/screens/admin/AApprovalsScreen.tsx`
- Modify: `app/src/lib/types.ts` (ensure `AdminRestaurantDetail` has `lat: number | null; lng: number | null`)

**Interfaces:**
- Consumes: `PATCH /api/admin/approvals/:id/location` from Task 3.

- [ ] **Step 1: Confirm the detail type carries coordinates**

In `app/src/lib/types.ts`, ensure the restaurant-detail type used by `AApprovalsScreen` includes:

```ts
lat: number | null;
lng: number | null;
```

(The backend already returns the full `RestaurantProfile`, so these fields are present in the response; add them to the type if missing.)

- [ ] **Step 2: Add location UI to the approval detail**

In `app/src/screens/admin/AApprovalsScreen.tsx`, in the selected-restaurant detail panel, add below the existing detail fields:

```tsx
{/* Location */}
<div className="admin-detail__loc">
  {selected.lat == null || selected.lng == null ? (
    <p className="admin-warn" role="alert">
      No location set — deliveries can’t be auto-assigned until you set coordinates.
    </p>
  ) : (
    <p className="admin-muted">Location: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
  )}
  <form
    onSubmit={async (e) => {
      e.preventDefault();
      const lat = Number(latInput);
      const lng = Number(lngInput);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const { restaurant } = await apiSend<{ restaurant: AdminRestaurantDetail }>(
        "PATCH", `/api/admin/approvals/${selected.id}/location`, { lat, lng });
      setSelected(restaurant);
    }}
  >
    <input inputMode="decimal" placeholder="lat" value={latInput} onChange={(e) => setLatInput(e.target.value)} />
    <input inputMode="decimal" placeholder="lng" value={lngInput} onChange={(e) => setLngInput(e.target.value)} />
    <button type="submit" className="btn-secondary">Set location</button>
  </form>
</div>
```

Add the two `useState` hooks near the top of the component:

```tsx
const [latInput, setLatInput] = useState("");
const [lngInput, setLngInput] = useState("");
```

Confirm `apiSend`'s signature matches existing usage in this file (it's already imported and used for approve/reject) and reuse it exactly.

- [ ] **Step 3: Build the frontend to verify it compiles**

Run: `cd app && npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Manual verification**

Log in as admin (`admin@demo.feastnow.pk` / `Admin1234!`), open Approvals → select a restaurant with no coordinates → confirm the warning shows → enter lat/lng → Set location → confirm the warning clears and coordinates display. (Requires the backend running; if not, this is a visual/build check only — note it as such.)

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/admin/AApprovalsScreen.tsx app/src/lib/types.ts
git commit -m "feat(admin-ui): show/edit restaurant location on approval detail"
```

---

## Feature B — Rider approval

### Task 5: New riders start pending; grandfather existing; seed rider approved

**Files:**
- Modify: `backend/src/repositories/userRepository.ts` (`createDeliveryPartner`)
- Modify: `backend/prisma/seed.ts` (demo rider `approvedAt`)
- Modify: `backend/tests/routes/authRouter.test.ts` (assert new partner is pending)

**Interfaces:**
- Produces: new delivery-partner profiles have `approvedAt: null`.

- [ ] **Step 1: Write the failing test**

The fake user repo captures `lastDeliveryPartner` but not `approvedAt` (that's a repo-internal detail). Assert the real intent at the Prisma-repo boundary instead with a focused unit test using a Prisma mock. Create `backend/tests/repositories/createDeliveryPartner.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createUserRepository } from "../../src/repositories/userRepository";

it("creates a delivery partner profile with approvedAt null (pending)", async () => {
  const created: any[] = [];
  const tx = {
    user: { create: vi.fn(async ({ data }: any) => ({ id: "u1", ...data })) },
    deliveryPartnerProfile: { create: vi.fn(async ({ data }: any) => { created.push(data); return data; }) },
  };
  const prisma: any = { $transaction: async (fn: any) => fn(tx) };
  const repo = createUserRepository(prisma);
  await repo.createDeliveryPartner({ name: "R", email: "r@x.co", phone: "1", passwordHash: "h", vehicleType: "bike" });
  expect(created[0].approvedAt).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/repositories/createDeliveryPartner.test.ts`
Expected: FAIL — `approvedAt` is a `Date`, not `null`.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/repositories/userRepository.ts`, change `createDeliveryPartner`:

```ts
await tx.deliveryPartnerProfile.create({
  data: { userId: created.id, vehicleType, availabilityStatus: "offline", approvedAt: null },
});
```

Also update the interface doc comment above `createDeliveryPartner` from "auto-approved" to "pending (awaits admin approval)".

In `backend/prisma/seed.ts`, in the `deliveryPartnerProfile.upsert`, ensure the demo rider is approved in both `create` and `update`:

```ts
await prisma.deliveryPartnerProfile.upsert({
  where: { userId: rider.id },
  update: { approvedAt: new Date() },
  create: { userId: rider.id, vehicleType: "motorcycle", availabilityStatus: "offline", approvedAt: new Date() },
});
```

(Match the existing upsert's field names; only ensure `approvedAt: new Date()` is present in both branches. Keep any other fields the current upsert already sets.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/repositories/createDeliveryPartner.test.ts && npx tsc --noEmit`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/userRepository.ts backend/prisma/seed.ts backend/tests/repositories/createDeliveryPartner.test.ts
git commit -m "feat(rider): new riders start pending; seed rider stays approved"
```

---

### Task 6: Block pending riders from going online

**Files:**
- Modify: `backend/src/routes/deliveryRouter.ts` (`POST /availability`)
- Modify: `backend/tests/routes/deliveryRouter.test.ts` (new tests)

**Interfaces:**
- Consumes: `req.partner.approvedAt` (already on `PartnerView`; surfaced as `approved` by `toPartnerDTO`).

- [ ] **Step 1: Write the failing test**

In `backend/tests/routes/deliveryRouter.test.ts`, following the file's existing partner-fixture/token setup, add a pending-partner case. Ensure the fake delivery repo's partner fixture supports `approvedAt`; set it to `null` for this test's partner.

```ts
it("blocks a pending (unapproved) rider from going online with 403", async () => {
  // arrange a partner whose approvedAt is null, with a fresh location
  const { app, token } = buildDeliveryApp({ partner: { approvedAt: null, /* fresh location fields */ } });
  const res = await request(app)
    .post("/api/delivery/availability")
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "online" });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe("not_approved");
});

it("allows an approved rider with a fresh location to go online", async () => {
  const { app, token } = buildDeliveryApp({ partner: { approvedAt: new Date(), /* fresh location fields */ } });
  const res = await request(app)
    .post("/api/delivery/availability")
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "online" });
  expect(res.status).toBe(200);
});
```

Use the same partner-fixture shape the existing availability tests use (the "location_required" test in this file already exercises the fresh-location path — copy its arrangement for the fresh-location fields).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/routes/deliveryRouter.test.ts`
Expected: FAIL — pending rider currently returns 200, not 403.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/routes/deliveryRouter.ts`, in the `/availability` handler, add the approval check as the first thing inside the `status === "online"` branch:

```ts
if (status === "online") {
  if (req.partner!.approvedAt == null) {
    return res.status(403).json({ error: "not_approved", message: "Your rider account is pending approval." });
  }
  const fresh = req.partner!.locationUpdatedAt &&
    Date.now() - req.partner!.locationUpdatedAt.getTime() < LOCATION_STALE_MS;
  if (!fresh) {
    return res.status(409).json({ error: "location_required", message: "Share your location before going online." });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/routes/deliveryRouter.test.ts && npx tsc --noEmit`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/deliveryRouter.ts backend/tests/routes/deliveryRouter.test.ts
git commit -m "feat(rider): block unapproved riders from going online (403)"
```

---

### Task 7: Admin rider-approval endpoints

**Files:**
- Modify: `backend/src/repositories/adminRepository.ts` (interface + impl: `AdminRiderRow`, `listPendingRiders`, `findPendingRiderById`, `approveRider`)
- Modify: `backend/src/routes/adminRouter.ts` (`riderRow` DTO + 3 routes)
- Modify: `backend/tests/test-helpers/fakeAdminRepository.ts` (add rider methods + seed data)
- Modify: `backend/tests/routes/adminRouter.test.ts` (new tests)

**Interfaces:**
- Produces:
  - `AdminRiderRow { id: string; name: string; email: string; phone: string; vehicleType: string; createdAt: Date }`
  - `listPendingRiders(): Promise<AdminRiderRow[]>`
  - `findPendingRiderById(userId: string): Promise<AdminRiderRow | null>`
  - `approveRider(userId: string, now: Date): Promise<void>`
  - Routes: `GET /api/admin/rider-approvals` → `{ riders }`; `GET /api/admin/rider-approvals/:id` → `{ rider }`; `POST /api/admin/rider-approvals/:id/approve` → `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

Add rider seed data to `backend/tests/test-helpers/fakeAdminRepository.ts` (a `riders` array of `{ id, name, email, phone, vehicleType, createdAt, approvedAt, suspendedAt }`), then implement the four methods (see Step 3). Then add tests to `backend/tests/routes/adminRouter.test.ts`:

```ts
describe("rider approvals", () => {
  it("lists pending riders", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app).get("/api/admin/rider-approvals").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.riders.length).toBeGreaterThan(0);
    expect(res.body.riders[0]).toHaveProperty("vehicleType");
  });

  it("approves a pending rider", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app)
      .post("/api/admin/rider-approvals/rider1/approve")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 404 approving an unknown rider", async () => {
    const { app, adminToken } = buildAdminApp();
    const res = await request(app)
      .post("/api/admin/rider-approvals/nope/approve")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("requires admin auth", async () => {
    const { app } = buildAdminApp();
    const res = await request(app).get("/api/admin/rider-approvals");
    expect(res.status).toBe(401);
  });
});
```

Seed one pending rider with id `rider1` in the fake repo.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/routes/adminRouter.test.ts`
Expected: FAIL — routes 404 and fake repo lacks rider methods.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/repositories/adminRepository.ts` add the row type and interface methods:

```ts
export interface AdminRiderRow {
  id: string; name: string; email: string; phone: string;
  vehicleType: string; createdAt: Date;
}
```

```ts
// interface additions:
listPendingRiders(): Promise<AdminRiderRow[]>;
findPendingRiderById(userId: string): Promise<AdminRiderRow | null>;
approveRider(userId: string, now: Date): Promise<void>;
```

Impl (note: no Prisma relation exists between `User` and `DeliveryPartnerProfile`, so join manually with two queries):

```ts
async listPendingRiders() {
  const profiles = await prisma.deliveryPartnerProfile.findMany({
    where: { approvedAt: null }, orderBy: { createdAt: "asc" },
  });
  if (profiles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.userId) }, suspendedAt: null },
    select: { id: true, name: true, email: true, phone: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return profiles.flatMap((p) => {
    const u = byId.get(p.userId);
    return u ? [{ id: u.id, name: u.name, email: u.email, phone: u.phone, vehicleType: p.vehicleType, createdAt: p.createdAt }] : [];
  });
},
async findPendingRiderById(userId) {
  const p = await prisma.deliveryPartnerProfile.findUnique({ where: { userId } });
  if (!p || p.approvedAt != null) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId }, select: { id: true, name: true, email: true, phone: true, suspendedAt: true },
  });
  if (!u || u.suspendedAt != null) return null;
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, vehicleType: p.vehicleType, createdAt: p.createdAt };
},
async approveRider(userId, now) {
  await prisma.deliveryPartnerProfile.update({ where: { userId }, data: { approvedAt: now } });
},
```

In `backend/tests/test-helpers/fakeAdminRepository.ts`, add seed + methods:

```ts
const riders = [
  { id: "rider1", name: "Rana", email: "rana@x.co", phone: "0300", vehicleType: "motorcycle",
    createdAt: new Date("2026-07-20"), approvedAt: null as Date | null, suspendedAt: null as Date | null },
];
// ...in the returned object:
async listPendingRiders() {
  return riders.filter((r) => r.approvedAt == null && r.suspendedAt == null)
    .map(({ id, name, email, phone, vehicleType, createdAt }) => ({ id, name, email, phone, vehicleType, createdAt }));
},
async findPendingRiderById(userId) {
  const r = riders.find((x) => x.id === userId && x.approvedAt == null && x.suspendedAt == null);
  return r ? { id: r.id, name: r.name, email: r.email, phone: r.phone, vehicleType: r.vehicleType, createdAt: r.createdAt } : null;
},
async approveRider(userId, now) {
  const r = riders.find((x) => x.id === userId); if (r) r.approvedAt = now;
},
```

In `backend/src/routes/adminRouter.ts` add the DTO and routes:

```ts
function riderRow(r: { id: string; name: string; email: string; phone: string; vehicleType: string; createdAt: Date }) {
  return { id: r.id, name: r.name, email: r.email, phone: r.phone, vehicleType: r.vehicleType, createdAt: r.createdAt.toISOString() };
}
```

```ts
router.get("/rider-approvals", ...requireAdmin, asyncHandler(async (_req: AdminRequest, res) => {
  const riders = await deps.adminRepo.listPendingRiders();
  return res.status(200).json({ riders: riders.map(riderRow) });
}));

router.get("/rider-approvals/:id", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const rider = await deps.adminRepo.findPendingRiderById(req.params.id);
  if (!rider) return res.status(404).json({ error: "Rider not found." });
  return res.status(200).json({ rider: riderRow(rider) });
}));

router.post("/rider-approvals/:id/approve", ...requireAdmin, asyncHandler(async (req: AdminRequest, res) => {
  const rider = await deps.adminRepo.findPendingRiderById(req.params.id);
  if (!rider) return res.status(404).json({ error: "Rider not found." });
  await deps.adminRepo.approveRider(req.params.id, new Date());
  return res.status(200).json({ ok: true });
}));
```

- [ ] **Step 4: Run full backend suite to verify**

Run: `cd backend && npm test && npx tsc --noEmit`
Expected: PASS (all suites); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/adminRepository.ts backend/src/routes/adminRouter.ts backend/tests/test-helpers/fakeAdminRepository.ts backend/tests/routes/adminRouter.test.ts
git commit -m "feat(admin): rider approval endpoints (list/detail/approve)"
```

---

### Task 8: Admin UI — Restaurants | Riders tabs on Approvals screen

**Files:**
- Modify: `app/src/screens/admin/AApprovalsScreen.tsx`
- Modify: `app/src/lib/types.ts` (add `AdminRiderRow` type)

**Interfaces:**
- Consumes: `GET /api/admin/rider-approvals`, `POST /api/admin/rider-approvals/:id/approve` from Task 7.

- [ ] **Step 1: Add the rider type**

In `app/src/lib/types.ts`:

```ts
export interface AdminRiderRow {
  id: string; name: string; email: string; phone: string;
  vehicleType: string; createdAt: string;
}
```

- [ ] **Step 2: Add a tab switch to the Approvals screen**

In `app/src/screens/admin/AApprovalsScreen.tsx`, introduce a `tab` state and render either the existing restaurant master-detail (unchanged) or a new riders list. Keep the existing restaurant code path intact; wrap the screen body:

```tsx
const [tab, setTab] = useState<"restaurants" | "riders">("restaurants");
// ...
<div className="admin-tabs" role="tablist">
  <button role="tab" aria-selected={tab === "restaurants"} className={`admin-tab${tab === "restaurants" ? " admin-tab--active" : ""}`} onClick={() => setTab("restaurants")}>Restaurants</button>
  <button role="tab" aria-selected={tab === "riders"} className={`admin-tab${tab === "riders" ? " admin-tab--active" : ""}`} onClick={() => setTab("riders")}>Riders</button>
</div>
{tab === "restaurants" ? (/* existing restaurant master-detail JSX */) : <RidersPanel />}
```

- [ ] **Step 3: Implement the RidersPanel**

Add within the same file (small, co-located component):

```tsx
function RidersPanel() {
  const [riders, setRiders] = useState<AdminRiderRow[]>([]);
  const load = useCallback(async () => {
    setRiders(await apiGet<{ riders: AdminRiderRow[] }>("/api/admin/rider-approvals").then((r) => r.riders));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const approve = async (id: string) => {
    await apiSend("POST", `/api/admin/rider-approvals/${id}/approve`, {});
    await load();
  };

  return (
    <div className="admin-screen">
      {riders.length === 0 && <p className="admin-muted">No riders awaiting approval.</p>}
      <ul className="admin-list">
        {riders.map((r) => (
          <li key={r.id} className="admin-row">
            <div>
              <div className="admin-row__title">{r.name} · {r.vehicleType}</div>
              <div className="admin-muted">{r.email} · {r.phone}</div>
            </div>
            <button className="btn-primary" onClick={() => void approve(r.id)}>Approve</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Match `apiGet`/`apiSend` import + call signatures already used at the top of this file. Reuse existing class names where present; only add `admin-tabs`/`admin-tab` styles if the design system lacks them (add minimal rules to `app/src/styles/admin.css` mirroring the sidebar navlink active pattern).

- [ ] **Step 4: Build the frontend**

Run: `cd app && npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Manual verification**

Seed a pending rider (sign up a new delivery account, or set an existing rider's `approvedAt` to null in the DB), log in as admin, open Approvals → Riders tab → confirm the rider appears → Approve → confirm it disappears from the list and that rider can now go online. (Backend must be running; otherwise note as build-only check.)

- [ ] **Step 6: Commit**

```bash
git add app/src/screens/admin/AApprovalsScreen.tsx app/src/lib/types.ts app/src/styles/admin.css
git commit -m "feat(admin-ui): Restaurants|Riders tabs with rider approval"
```

---

### Task 9 (optional): Backfill coordinates for existing restaurants

**Files:**
- Create: `backend/prisma/backfillGeocode.ts`

**Interfaces:**
- Consumes: `geocodeAddress` from Task 1.

- [ ] **Step 1: Write the script**

```ts
// backend/prisma/backfillGeocode.ts
// One-off: geocode existing non-demo restaurants that have no coordinates.
// Run: cd backend && npx tsx prisma/backfillGeocode.ts
import { PrismaClient } from "@prisma/client";
import { geocodeAddress } from "../src/lib/geocode";

const prisma = new PrismaClient();

async function main() {
  const targets = await prisma.restaurantProfile.findMany({
    where: { isDemo: false, OR: [{ lat: null }, { lng: null }] },
  });
  console.log(`Backfilling ${targets.length} restaurant(s)...`);
  for (const r of targets) {
    const coords = await geocodeAddress(r.address);
    if (!coords) { console.log(`  ✗ ${r.name}: geocode failed (${r.address})`); continue; }
    await prisma.restaurantProfile.update({ where: { id: r.id }, data: coords });
    console.log(`  ✓ ${r.name}: ${coords.lat}, ${coords.lng}`);
    await new Promise((res) => setTimeout(res, 1100)); // Nominatim: ≤1 req/sec
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/backfillGeocode.ts
git commit -m "chore(geocode): one-off backfill script for existing restaurants"
```

Do not run against production data without confirmation — it makes live external calls and writes to the DB.

---

## Final verification

- [ ] `cd backend && npm test` — all suites green.
- [ ] `cd backend && npx tsc --noEmit` — clean.
- [ ] `cd app && npm run build` — clean.
- [ ] Push to `main` (per project workflow) only after all of the above pass.

## Self-review notes (coverage)

- Spec §3.1 geocode module → Task 1. §3.2 signup wiring → Task 2. §3.3 admin fallback endpoint → Task 3; UI → Task 4. §3.4 backfill → Task 9.
- Spec §4.1 signup default → Task 5. §4.2 seed → Task 5. §4.3 online guard → Task 6. §4.4 admin endpoints → Task 7. §4.5 admin UI tabs → Task 8. §4.6 frontend gate → already wired (no task; verified in design).
- No schema/migration tasks — both columns pre-exist (constraint honored).
