# Delivery Partner Role — Design Spec

**Date:** 2026-07-18
**Status:** Approved for planning
**SRS coverage:** FR-1, FR-3–FR-7, FR-13, FR-23–FR-29; NFR-1, NFR-3, NFR-5, NFR-7
**Supersedes:** the earlier "full-native now" direction discussed at the start of this session (Capacitor wrap + Google Maps SDK + FCM + background geolocation). That direction was reversed in favor of a plain web SPA — see §1.

---

## 1. Summary & key reversal

The Delivery Partner role is built as a **plain web SPA shell**, consistent with the already-shipped Customer and Restaurant shells (`app/`), plus a delivery backend module. It ships with **zero external accounts, API keys, or billing** required.

This reverses an earlier idea in the same session to build the role "full-native now" (Capacitor wrap, embedded Google Maps SDK, FCM push, background geolocation). That was dropped once we settled on **manual navigation**: the rider receives the customer's **text delivery address** and taps a button that opens the **Google Maps app** with directions preloaded (a free public deep-link URL, no key). That single decision removes the need for an embedded map, background GPS, a maps SDK, and a push service — so no native foundation phase is required.

### 1.1 What this deliberately does NOT include (and why)
- **No embedded live map / no live rider tracking for the customer.** This is a conscious **reduction of FR-27**: the customer sees a **status timeline** (Assigned → Out for Delivery → Delivered) via polling, not a moving map. The rider navigates in their own Google Maps app. Live moving-map tracking is deferred to a future Capacitor/maps phase.
- **No Capacitor wrap, no FCM push, no background geolocation** in this build. Assignment offers arrive via the existing in-app polling + chime (`usePolling` + `lib/chime.ts`). "Notify the rider when the app is fully closed" remains a future Capacitor+push item.
- **No partner ratings.** The `Rating` model links restaurants only. Rating the delivery partner (SRS `target_type: delivery_partner`) is a separate Medium-priority item, out of scope here.
- **No in-app payments** (already out of scope per CLAUDE.md). Payout is a computed number shown to the rider, not a real disbursement.

### 1.2 External setup required from the human
**None** to build, run, and verify this role. For the record, the following are optional and needed ONLY for future richer versions, not this build:
- Google Maps Platform API key + billing → only for an embedded live map or geocoding of typed addresses.
- Firebase project + `google-services.json` (+ Capacitor) → only for push that reaches a closed app.
- Apple Developer account → only for iOS app-store distribution.

---

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Client shape | Web SPA (no Capacitor) | Consistent with shipped Customer/Restaurant shells; zero setup |
| Navigation | Google Maps deep-link (`https://www.google.com/maps/dir/?api=1&destination=<addr>`) | Free, no key; opens native Maps |
| Contact | `tel:` links (Call Restaurant / Call Customer) | Free, works on mobile web |
| Geolocation | Browser Geolocation API (free) | No key; partner GPS when Online, customer GPS at checkout, restaurant coords seeded |
| Assignment | Direct offer to **nearest** online partner; re-offer to next nearest on decline/timeout | Matches SRS "nearest available partner" (FR-25) |
| Approval gate | Schema + Pending Approval screen present; **auto-approved this phase** | Admin portal not built yet; gate infra ready for when it ships |
| Payout | **PKR 50 base + 15/km** of haversine restaurant→dropoff; flat base fallback if no dropoff coords; snapshot on accept | SRS defines no fare model; one config constant, easy to tune |
| Proof of delivery | Optional **text note** | Matches SRS "optionally with a proof-of-delivery note"; no camera/upload dependency |
| Customer tracking | Status **timeline only** (FR-27 reduced) | No live map in this build |
| Doc structure | One phased spec | Assignment engine stays coherent in one place |

---

## 3. Architecture overview

Three phases, dependency-ordered. All work sits behind the existing **shared API layer** (NFR-7); no business logic is forked per shell, only presentation.

```
Phase 1  Backend        — schema, state-machine extension, assignment engine, endpoints
Phase 2  Delivery shell — web SPA screens for the partner
Phase 3  Cross-role     — restaurant assignment status + customer timeline extension
```

### 3.1 Order lifecycle (authoritative state machine)

The existing `backend/src/lib/orderStateMachine.ts` is the single source of truth (CLAUDE.md mandate) and currently stops at `ready`. This spec extends it:

```
Placed → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered
                                   │
                                   └─ (no partner found) stays Ready, flagged "seeking rider"
Rejected/Cancelled reachable only from Placed/Accepted (unchanged)
```

- **Restaurant** drives `Accepted → Preparing → Ready` (existing).
- **System** drives `Ready → Assigned` (on partner accept).
- **Delivery partner** drives `Assigned → Out for Delivery → Delivered`.

New actor and transitions added to `TRANSITIONS`:
```ts
delivery_partner: {
  assigned:         ["out_for_delivery"],
  out_for_delivery: ["delivered"],
},
system: {
  placed: ["rejected"],   // existing
  ready:  ["assigned"],   // new: applied when an offer is accepted
},
```
New timestamp fields mapped in `timestampFieldFor`: `assigned → assignedAt`, `out_for_delivery → outForDeliveryAt`, `delivered → deliveredAt`. `closedAt` continues to mark terminal states; `delivered` sets both `deliveredAt` and `closedAt`.

---

## 4. Phase 1 — Backend

Built test-driven (`superpowers:test-driven-development`), with in-memory fakes mirroring real repositories, following the existing pattern (`userRepository`, `orderRepository`, etc.).

### 4.1 Schema additions (Prisma)

```prisma
model DeliveryPartnerProfile {
  id                 String   @id @default(uuid())
  userId             String   @unique
  vehicleType        VehicleType
  idDocumentUrl      String?           // collected at signup, not gated on
  availabilityStatus AvailabilityStatus @default(offline)
  currentLat         Float?
  currentLng         Float?
  locationUpdatedAt  DateTime?
  approvedAt         DateTime?         // auto-set on signup this phase
  createdAt          DateTime @default(now())
  @@index([availabilityStatus])
}

enum VehicleType { bike motorcycle car }
enum AvailabilityStatus { offline online }
```

`RestaurantProfile` additions (reference point for nearest-partner):
```prisma
lat Float?   // seeded for demo restaurants
lng Float?
```

`Order` additions:
```prisma
deliveryPartnerId String?    // FK → User (role delivery_partner)
deliveryLat       Float?     // captured at checkout (browser GPS), nullable
deliveryLng       Float?
payoutCents       Int?       // snapshot when a partner accepts
assignedAt        DateTime?
outForDeliveryAt  DateTime?
deliveredAt       DateTime?
proofNote         String?    // optional text at delivery
```

New model:
```prisma
model DeliveryOffer {
  id          String      @id @default(uuid())
  orderId     String
  partnerId   String      // User id of the offered partner
  status      OfferStatus @default(pending)
  sequence    Int         @default(1)   // reassignment attempt number
  offeredAt   DateTime    @default(now())
  expiresAt   DateTime
  respondedAt DateTime?
  @@index([partnerId, status])
  @@index([orderId, status])
}

enum OfferStatus { pending accepted declined expired }
```

A Prisma migration is added; demo restaurants are backfilled with `lat`/`lng` in the seed.

### 4.2 Assignment engine

A single module (e.g. `backend/src/lib/deliveryAssignment.ts`) owns assignment logic so it is not re-implemented per endpoint.

**Trigger:** the existing restaurant "mark ready" transition. After the order is set to `ready`, the engine attempts an offer.

**Nearest selection:** among partners with `availabilityStatus = online`, `approvedAt != null`, a fresh-enough `locationUpdatedAt`, and no other active delivery (`assigned`/`out_for_delivery`), pick the minimum haversine distance from partner `currentLat/Lng` to the restaurant `lat/lng`. Create a `DeliveryOffer` (`pending`, `expiresAt = now + OFFER_WINDOW_MS`).

**Constants (one config file):**
```ts
export const OFFER_WINDOW_MS = 45_000;
export const MAX_OFFER_ATTEMPTS = 5;
export const PAYOUT_BASE_CENTS = 5_000;      // PKR 50.00
export const PAYOUT_PER_KM_CENTS = 1_500;    // PKR 15.00 / km
export const LOCATION_STALE_MS = 60_000;     // partner GPS considered stale after
export const LOCATION_PING_MS = 10_000;      // client ping cadence (foreground)
```

**Lazy expiry & reassignment** (no cron/worker — mirrors the existing `AUTO_APPROVE_AFTER_MS` lazy pattern): whenever the order or offers are read (partner poll of `/offers`, restaurant/customer poll of the order, or an accept attempt), any `pending` offer past `expiresAt` is marked `expired`, and if the order is still `ready` a new offer is created for the next nearest partner (`sequence + 1`). After `MAX_OFFER_ATTEMPTS` or when no eligible partner remains, the order stays `ready` with no `pending` offer — surfaced as **"seeking rider"** to restaurant/customer.

**Accept:** validate the offer is still `pending` and unexpired and the order still `ready` → set order `status = assigned`, `deliveryPartnerId`, `assignedAt`; snapshot `payoutCents = PAYOUT_BASE_CENTS + round(km × PAYOUT_PER_KM_CENTS)` where `km` = haversine(restaurant, dropoff) when `deliveryLat/Lng` exist, else `payoutCents = PAYOUT_BASE_CENTS`; mark offer `accepted`; expire any sibling `pending` offers for that order.

**Accept race:** first valid accept wins; a later accept for a now-`assigned` order returns **409** and the stale offer is marked `expired`.

### 4.3 Payout

Integer cents, computed once and **snapshotted** on `Order.payoutCents` at accept time; never recomputed from live constants afterward (same discipline as `price_at_order`). Haversine distance is computed in the assignment module.

### 4.4 Endpoints (`/api/delivery/*`, behind `requireAuth` + a delivery-partner role guard)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/delivery/me` | Partner profile (+ approval status) |
| PATCH | `/api/delivery/me` | Edit name/phone/vehicle |
| POST | `/api/delivery/availability` | `{ status: online \| offline }`; going online requires a recent location; blocked offline mid-delivery |
| POST | `/api/delivery/location` | `{ lat, lng }` ping; updates `currentLat/Lng/locationUpdatedAt` |
| GET | `/api/delivery/offers` | Pending offer(s) for this partner (drives the modal); runs lazy expiry/reassign |
| POST | `/api/delivery/offers/:id/accept` | Accept → order `assigned`, snapshot payout |
| POST | `/api/delivery/offers/:id/decline` | Decline → expire offer, re-offer next nearest |
| GET | `/api/delivery/active` | Current active delivery: order + restaurant (name/address/phone/coords) + customer (name/phone/address) + payout |
| POST | `/api/delivery/orders/:id/pickup` | `assigned → out_for_delivery` |
| POST | `/api/delivery/orders/:id/deliver` | `out_for_delivery → delivered` + optional `proofNote` |
| POST | `/api/delivery/orders/:id/unable` | "Unable to complete" → returns order to seeking-rider (see §7) |
| GET | `/api/delivery/earnings` | Today/week totals + completed-delivery list |

**Auth/signup (FR-23):** the existing auth flow is extended for the `delivery_partner` role (vehicle type + optional ID document at signup), reusing the OTP verification (FR-3) and login/forgot-password (FR-4/FR-5) machinery already built for customer/restaurant. `approvedAt` is auto-set on verified signup this phase.

**Customer checkout addition (small):** the existing checkout captures the customer's device location via the browser Geolocation API (best-effort, permission-gated) and stores `deliveryLat/deliveryLng` on the order for payout distance. Denial is non-fatal (flat base fallback). Text `deliveryAddress` remains required and unchanged.

---

## 5. Phase 2 — Delivery Partner shell (frontend, web SPA)

### 5.1 Routing & role
- `app/src/App.tsx`: `me.role === "delivery_partner"` → `<DeliveryShell />`. Unknown roles still fall back to Customer.
- `landing/` auth pages: add the **delivery-partner option** to the role picker (FR-1 gap — SRS only enumerates Customer/Restaurant). Vanilla-JS addition mirroring the existing restaurant signup path.
- `DeliveryShell`: 3 bottom tabs via the existing `TabBar` — `[ Active Delivery ] [ Availability ] [ Earnings ]` — plus a Profile/Settings route (logout lives there, not in main nav, per FR-6/FR-7). A badge dot on Active Delivery when a delivery is in progress.

### 5.2 Screens

| Screen | Key elements | States |
|---|---|---|
| `DAvailabilityScreen` (FR-24) | Large Online/Offline toggle; status label; requests location permission on first Online (modal) | Offline · Online-no-assignment (searching animation) · Online-locked-during-delivery (banner + "Go to Active Delivery") |
| `AssignmentOfferModal` (FR-25) | Restaurant name, pickup distance, dropoff distance, estimated payout, countdown bar (`useCountdown`), Accept / Decline | Shown over Availability when a `pending` offer is polled; timeout = decline |
| `DActiveDeliveryScreen` (FR-26/27/28) | Order card, **Navigate** (Maps deep-link), **Call Restaurant/Customer** (`tel:`), Confirm Pickup, Mark Delivered + optional note field | Heading-to-Pickup → Out-for-Delivery → Arrived; empty state when Online but no delivery |
| `DEarningsScreen` (FR-29) | Today's & this week's earnings + delivery counts; list of completed deliveries (date, restaurant, payout) | Read-only; intentionally simple (Low priority) |
| `DProfileScreen` (FR-6/7) | View/edit name, phone, vehicle; change password; **Log Out**; ID document read-only | — |
| `DPendingApprovalScreen` | "Pending approval" message, no toggle access | Wired but dormant (auto-approved this phase) |

Live updates use the existing `usePolling`; a new offer plays `lib/chime.ts`. Visual identity follows `DESIGN.md` (trattoria skin) and status is always color **+ icon + label** (reuse/extend `OrderStatus`).

---

## 6. Phase 3 — Cross-role integration

- **Restaurant** `ROrderDetailScreen`: once `ready`, show assignment progress — "Finding a rider…" → "Rider assigned: {name}" → "Out for delivery" → "Delivered" — reading the order's status + partner name.
- **Customer** `OrderDetailScreen`: extend the `OrderStatus` timeline past `ready` through `assigned → out_for_delivery → delivered`. No live map; status + ETA text only. Status changes are picked up by the existing polling.
- The restaurant "mark ready" endpoint is the auto-assignment trigger (§4.2); no new restaurant UI action is required beyond displaying the resulting status.

---

## 7. [GAP] resolutions (items not defined by the SRS)

| Gap | Resolution |
|---|---|
| Where does the partner pick their role at signup? (FR-1) | Add delivery-partner to the landing role picker |
| Delivery-partner approval gate? | Schema + Pending Approval screen present; auto-approved this phase; real approval arrives with Admin |
| Payout/fare model | PKR 50 + 15/km (haversine restaurant→dropoff), one config constant, snapshot on accept |
| Reassignment logic | Re-offer to next nearest, `sequence++`, cap `MAX_OFFER_ATTEMPTS`, then "seeking rider" |
| Proof-of-delivery format | Optional text note |
| Can't go offline mid-delivery | Server-blocked (`/availability` rejects offline while an active delivery exists) + UI banner |
| Accept race | First valid accept wins; others → 409, offer expired |
| Cancellation mid-delivery | `POST /orders/:id/unable` returns the order to seeking-rider state and frees the partner; full admin handling deferred |
| Location ping frequency | ~10s foreground (`LOCATION_PING_MS`); degrades gracefully; no background sharing this build |
| Notify when app closed | Out of scope; future Capacitor + FCM |

---

## 8. Testing

- **Backend (TDD):** state-machine extension (new transitions valid; illegal transitions rejected); assignment engine (nearest selection, offer lifecycle, lazy expiry, reassignment cap, exhaustion → seeking-rider, accept race → 409); payout snapshot (with and without dropoff coords); each endpoint with fakes mirroring real repos. Zero regressions in the existing suite.
- **Frontend:** typecheck + lint clean; manual end-to-end walkthrough of the partner flow (Online → offer → accept → pickup → deliver → earnings) and the cross-role views.
- **Manual multi-actor check:** two/three browser sessions (customer, restaurant, delivery) driving one order through the full lifecycle.

---

## 9. Non-functional alignment

- **NFR-7** shared API layer: all delivery logic behind `/api/delivery/*` and shared modules; shells fork presentation only.
- **NFR-3** salted hashes + TLS: reuses existing auth; no new credential storage beyond the standard user record.
- **NFR-1** search ~2s: unaffected (no new heavy queries; nearest-partner selection is a bounded in-memory sort over online partners).
- **NFR-5** scale: lazy expiry avoids background workers; assignment is O(online partners) per trigger. Revisit with a queue/worker only if online-partner counts grow large.
- **Money discipline:** integer cents, snapshot on accept, never recomputed.
