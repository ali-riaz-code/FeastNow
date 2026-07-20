# Restaurant Geocoding + Rider Approval — Design

**Date:** 2026-07-20
**Status:** Approved (brainstorm)
**Author:** Claude + ali-riaz-code

## 1. Problem

Two gaps break the intended end-to-end marketplace flow ("list a new restaurant → order → nearest rider → admin approves restaurants and riders"):

1. **No restaurant coordinates.** Restaurant signup (`createRestaurantOwner`) never sets `RestaurantProfile.lat/lng`, and no owner/admin path sets them afterward. The delivery assignment engine skips any order whose restaurant has null coordinates (`deliveryAssignment.ts:21` — `if (order.restaurantLat == null || order.restaurantLng == null) continue;`). Result: a *newly listed* restaurant's orders are never offered to any rider. Only seeded demo restaurants (hard-coded coords in `seedData.ts`) work.

2. **Riders auto-approve; admin cannot approve them.** `createDeliveryPartner` sets `approvedAt: new Date()` at signup, so no rider is ever pending. There is no admin endpoint or UI to review riders. The frontend approval gate already exists but is dormant (`PartnerContext.tsx:54` → `DPendingApprovalScreen`).

Both target fields already exist and are nullable (`RestaurantProfile.lat/lng`, `DeliveryPartnerProfile.approvedAt`), so **neither feature requires a database migration.**

## 2. Decisions (from brainstorm)

- **Restaurant coordinates:** geocode the typed business address server-side via a free, no-API-key service (OpenStreetMap Nominatim). Automatic; owners never enter coordinates. Admin approval detail is the human fallback for failed/incorrect geocodes.
- **Rider migration:** grandfather existing riders as approved (they already have `approvedAt` set). Only new signups start pending. The demo seed rider stays approved.
- **Rider reject:** reuse the existing `suspendUser` mechanism — no new rider approval state/enum.

## 3. Feature A — Restaurant geocoding

### 3.1 Geocode module (`backend/src/lib/geocode.ts`)
- `geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null>`
- Calls `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<address>`.
- Sends a descriptive `User-Agent` header (Nominatim usage policy requires it).
- Short timeout (e.g. 5s via `AbortController`). Returns `null` on timeout, network error, non-200, or empty results. **Never throws** — a geocode failure must not block signup.
- Exported as a plain function; injected into the auth router as a dependency (`GeocodeFn`) so tests pass a fake and never hit the network.

### 3.2 Signup wiring (`authRouter.ts` + `userRepository.ts`)
- Restaurant signup already collects and validates `businessAddress`.
- After OTP verification, before/within account creation: `const coords = await deps.geocode(businessAddress)`.
- Extend `RestaurantOwnerSignup` type and `createRestaurantOwner` to accept optional `lat`/`lng` and persist them on the `RestaurantProfile` (default `null` when coords is null).
- Signup succeeds regardless of geocode outcome.

### 3.3 Admin fallback (`adminRouter.ts` + `adminRepository.ts` + `AApprovalsScreen.tsx`)
- New endpoint `PATCH /api/admin/approvals/:id/location` with body `{ lat, lng }` (both finite numbers, validated). Sets the restaurant's coordinates.
- Admin approval detail displays current lat/lng and an editable form to set/correct them.
- A restaurant with null coords shows a visible warning on the detail ("No location set — deliveries can't be auto-assigned until you set coordinates").

### 3.4 Backfill (one-off, optional)
- `backend/prisma/backfillGeocode.ts`: idempotent script that geocodes existing non-demo restaurants where `lat`/`lng` is null. Demo rows already have coords. Not part of the app runtime.

## 4. Feature B — Rider approval

### 4.1 Signup default (`userRepository.ts`)
- `createDeliveryPartner` sets `approvedAt: null` (was `new Date()`). New riders start pending.
- Existing riders keep their timestamp → auto-grandfathered as approved.

### 4.2 Seed (`seed.ts`)
- The demo rider upsert explicitly sets `approvedAt` to a date so the demo delivery flow keeps working without manual approval.

### 4.3 Backend guard (`deliveryRouter.ts`)
- `POST /api/delivery/availability` with `status: "online"` rejects a rider whose `approvedAt` is null: `403 { error: "not_approved" }`. Defense in depth behind the frontend gate.

### 4.4 Admin endpoints (`adminRouter.ts` + `adminRepository.ts`)
Mirror the restaurant approval endpoints:
- `GET /api/admin/rider-approvals` — list pending riders (`approvedAt == null`, not suspended), newest first.
- `GET /api/admin/rider-approvals/:id` — rider detail (name, email, phone, vehicle type, applied-at).
- `POST /api/admin/rider-approvals/:id/approve` — set `approvedAt = now`.
- Reject: reuse existing `POST /api/admin/users/:id/suspend`. No new endpoint.

### 4.5 Admin UI (`AApprovalsScreen.tsx`)
- The Approvals screen gains two tabs: **Restaurants | Riders** (no new sidebar item).
- Riders tab: master-detail list of pending riders; detail shows profile + Approve button (and a link/affordance to suspend via the existing Users flow for reject).

### 4.6 Frontend gate
- Already wired: `PartnerContext.tsx:54` renders `DPendingApprovalScreen` when `!profile.approved`, and `toPartnerDTO` exposes `approved = approvedAt != null`. No change needed beyond the backend now producing pending riders.

## 5. Testing (TDD)

- **geocode.ts:** mocked `fetch` — success returns coords; empty results → null; non-200 → null; thrown/timeout → null.
- **Signup:** fake geocoder returning coords → restaurant persisted with lat/lng; fake returning null → restaurant still created with null coords, signup succeeds.
- **Delivery:** pending rider (`approvedAt == null`) blocked from going online (403); approved rider allowed.
- **Admin:** `GET /rider-approvals` returns only pending, non-suspended riders; approve sets `approvedAt`; `PATCH /approvals/:id/location` sets coords and rejects non-finite input.
- All existing tests remain green; TypeScript strict.

## 6. Out of scope (YAGNI)

- Interactive map pin picker and any mapping/tiles vendor.
- Owner-facing location editor UI (admin is the correction path for now).
- Distinct rider "rejected" state/enum (suspend covers it).
- Live routing / turn-by-turn.

## 7. Files touched

**Backend:** `src/lib/geocode.ts` (new), `src/routes/authRouter.ts`, `src/repositories/userRepository.ts`, `src/routes/deliveryRouter.ts`, `src/routes/adminRouter.ts`, `src/repositories/adminRepository.ts`, `prisma/seed.ts`, `prisma/backfillGeocode.ts` (new), plus test files and fake repositories.

**Frontend:** `app/src/screens/admin/AApprovalsScreen.tsx`, `app/src/lib/types.ts` (rider approval DTO types).

No Prisma schema/migration changes.
