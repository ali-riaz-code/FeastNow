# Customer Role — Phase 1 "Browse" — Design

**Date:** 2026-07-13
**Status:** Approved
**Depends on:** Auth flow (login/signup/OTP, `/me`) — complete and deployed.

## 1. Context and phasing

The customer role is delivered in four phases, each its own spec → plan → build → deploy cycle:

1. **Browse (this spec)** — marketplace schema + seed data, mobile-first app shell with tabs, home feed, restaurant detail with menu, search.
2. **Cart & checkout** — add-to-cart flows, floating cart pill, order note, promo code entry, place order (cash only), confirmation screen.
3. **Orders & tracking** — order state machine, active-order status pill, order history, reorder, live status updates.
4. **Profile & engagement** — saved addresses, loyalty balance, vouchers, ratings/reviews authored by the customer.

Phase 1 exists because every later phase depends on restaurants and menus existing, and it gets the Foodpanda-style feed on screen fastest.

Current ground truth: frontend is vanilla HTML/CSS/JS in `landing/` (Vercel); backend is Node/TS + Prisma on Render with Supabase Postgres; the Prisma schema contains only `User` and `OtpChallenge`; routes are auth + `/me`. After login the user currently lands on `welcome.html`.

## 2. Decisions made during brainstorming and spec review

- **Frontend tech — deliberate architecture reversal (2026-07-13):** React + Vite SPA, mobile-first web app. This **reverses CLAUDE.md's original React Native stack**; CLAUDE.md has been updated to record the new direction. Chosen because the customer shell is app-like (persistent tabs, shared components, cart state later) and must stay continuous with the deployed web auth flow.
- **Platform strategy (FR-27, push, app stores):** web SPA now; **Capacitor wrap planned before the Delivery Partner role**. Rationale: FR-27's continuous background location sharing is a Delivery Partner requirement — the Customer role only *views* partner location on a foreground map (polling/SSE), which web handles. True push and background geolocation are impossible on mobile web (iOS Web Push needs 16.4+ plus an installed PWA; SRS targets iOS 15+), so the native-capability deadline is the Delivery Partner phase, at which point the React code ports into Capacitor with FCM/APNs and background-geolocation plugins — which also provides Play Store / App Store distribution. Until then: Phase 1 ships PWA installability (manifest + minimal service worker), and customer notifications are in-app live status, with web push only where supported. Confirmed by the user 2026-07-13.
- **Build order — deliberate reversal, explicitly confirmed (2026-07-13):** the previously agreed dependency order was Auth → Admin → Restaurant → Customer → Delivery Partner with no seed data. This spec reverses that: Customer is built first on flagged, disposable demo seed data (lifecycle in §3). Trade-off accepted for speed-to-visible-product: the SRS's High-priority flows are overwhelmingly customer-side, and the strict order would ship two operator shells before anything customer-visible. Known risk: seeds may paper over schema assumptions that real restaurant-entered data would expose. The user confirmed this reversal explicitly.
- **Slicing:** browse-first (this phase), not a thin vertical slice and not backend-complete-first.
- **Seed data:** required — no real restaurants exist. Feed rows can only render against seeded demo data.
- **Menu items are display-only in Phase 1.** The Add button and cart pill ship together in Phase 2; no dead buttons.
- **Single `/home` endpoint** returning all feed sections, not per-row endpoints. One round trip on a phone; the client renders whatever sections arrive, so personalized rows slot in later with zero client changes. Trade-off acknowledged: rows no longer load independently; acceptable at seeded scale, revisit if a section gets expensive.

## 3. Backend — data model (Prisma)

Three new models, forward-compatible with SRS §7:

### `RestaurantProfile`
- `id` (uuid), `userId` (nullable — seeded restaurants have no owner account until the Restaurant role is built; SRS ties profile to user, so the column exists now)
- `name`, `description`, `address`
- `cuisines: String[]` (tag array; a join table is deferred until a real need appears)
- `opensAt`, `closesAt` ("HH:mm" 24-hour strings, e.g. "11:00"/"23:00"; "closed now" is computed from these server-side)
- `avgRating` (float), `ratingCount` (int)
- `estDeliveryMin` (int) — basis for "Under 30 Minutes"
- `orderCount` (int, synthetic for now) — basis for "Most Popular"
- `approvedAt` (DateTime) — basis for "New on FeastNow"; staggered in seed
- `heroImageUrl`, `isActive`
- `isDemo` (boolean, default false) — marks seeded demo rows; see seed lifecycle below

### `MenuItem`
- `id`, `restaurantId` (FK), `category` (string, e.g. "Starters"), `name`, `description`
- `priceCents` (int) — **money is integer cents, never floats**. This is the field Phase 2's `price_at_order` snapshots from.
- `imageUrl`, `isAvailable`

### `Rating`
- `id`, `restaurantId` (FK), `orderId` (nullable until Phase 3), `stars` (1–5 int), `reviewText`, `authorName` (string; seeded reviews have no user), `createdAt`

Included in Phase 1 because ratings **visibility** is High priority (FR-32) and "Top Rated" needs a real basis.

### Seed script
- ~20 restaurants across 6–8 cuisines, Unsplash imagery (same direct-URL approach as the landing cuisine carousel).
- 8–15 menu items each, grouped into 3–4 categories, with realistic prices.
- 3–8 seeded reviews per restaurant; `avgRating`/`ratingCount` consistent with the seeded reviews.
- Staggered `approvedAt`, varied `estDeliveryMin` (some ≤30, some above), varied `orderCount`, varied hours (so some restaurants read "Closed now" depending on time of day).
- Idempotent: re-running the seed resets marketplace demo data without touching `User`/`OtpChallenge`.

### Seed data lifecycle
- Every seeded restaurant is `isDemo: true`; its `MenuItem` and `Rating` rows are tied to it by FK. The seed script only ever creates/updates/deletes `isDemo` rows — it can never touch real data.
- When real restaurants onboard (Restaurant role phase), demo restaurants are **retired via `isActive: false`** (hidden from every browse query) rather than hard-deleted, preserving referential integrity if test orders from Phases 2–3 reference them.
- A hard-purge script (delete `isDemo` restaurants + dependents) is provided for pre-launch cleanup, to be run once no orders reference demo rows.

## 4. Backend — endpoints

All JWT-protected with the same middleware as `/me`. All responses JSON over HTTPS.

| Endpoint | Purpose | FR |
|---|---|---|
| `GET /api/customer/home` | All feed sections in one response: `{ sections: [{ key, title, restaurants: RestaurantCardDTO[] }] }`. Sections with no data are omitted. | FR-9 |
| `GET /api/restaurants?search=&cuisine=&sort=&page=` | Paginated list powering All Restaurants grid + cuisine-chip filtering. | FR-9 |
| `GET /api/restaurants/:id` | Profile + menu grouped by category + recent reviews. | FR-10, FR-32 |
| `GET /api/search?q=` | Live search: `{ restaurants[], dishes[] }`. Dish hits carry their restaurant id/name. | FR-8 |

`RestaurantCardDTO`: id, name, cuisines, avgRating, ratingCount, estDeliveryMin, heroImageUrl, isOpenNow. Computed `isOpenNow` is server-side so all clients agree.

Phase 1 sections in `/home` (order matters): `most_popular`, `top_rated`, `new_on_feastnow`, `under_30`. `order_again` and `because_you_liked` are Phase 3+ — the contract already supports them (client renders whatever sections arrive).

Performance: NFR-1's ~2s search budget is **assumed, not yet verified**, to be comfortably met at seeded scale. Phase 1 verification must measure actual endpoint latency (home, list, search) and record the numbers; the assumption must be re-benchmarked once data volume grows past seed scale. Queries use indexes on `cuisines`, `approvedAt`, `orderCount`, `avgRating` regardless.

## 5. Frontend — `app/` React + Vite SPA

### Placement and deployment
- New `app/` directory at repo root; served at **`/app/`** on the existing Vercel site (Vite `base: '/app/'`).
- Vercel build assembles output = `landing/*` at root + SPA build under `/app/`. Landing/auth pages remain untouched vanilla files.

### Auth handoff
- Login success redirects to `/app/` (previously `welcome.html`; the welcome page stays in the repo but is no longer the destination).
- On boot the app reads the existing stored session, calls `/me`; invalid/absent session bounces to `/login.html`. Network failure on `/me` must NOT clear a valid session (same rule the welcome page already follows).

### App shell
- Bottom tab bar: **Home / Orders / Profile**. Floating cart pill is Phase 2.
- Mobile-first; on desktop the app renders as a centered phone-width canvas (max ~480px) on the cream backdrop — a deliberate "app in a frame." This is an **accepted limitation, not an oversight**: a stretched desktop layout of a bottom-tab app would be worse than a clean frame. A real responsive desktop layout is deferred to post-Phase-4 (or earlier if desktop usage justifies it).
- **PWA installability:** web app manifest (name, icons, theme colors) + minimal service worker so the app is installable from the browser. Full offline support is out of scope; this is the interim install story until the Capacitor wrap (§2).
- Transitions 150–250ms with `prefers-reduced-motion` fallbacks (PRODUCT.md/DESIGN.md motion rules).

### Design system
- DESIGN.md tokens ported as CSS custom properties (same values as `landing/assets/css/tokens.css`).
- Shared components built once: `RestaurantCard`, `Chip`, `SectionRow` (horizontal scroll row), `SkeletonCard`, `SearchBar`, `TabBar`.
- Typography: serif display for restaurant names (Customer-shell privilege), sans body, **mono for all numerics** (ratings, prices, minutes).
- **Gold-Is-Rare:** gold marks the rating star on cards and the price on menu rows — nothing else.
- **Tricolore-Means-Status:** basil/tomato only for open/closed and (later) order states, always icon + label + color.

## 6. Screens

### Home tab
- Sticky header: search bar (placeholder "Search restaurants, cuisines, dishes...") + static location pill ("Deliver to · Demo Address" — real addresses are Phase 4).
- Cuisine chip row: horizontal scroll, DESIGN.md Chip styling (dough at rest, navy fill + cream text selected), "All" first and resets; selecting a chip filters the whole feed live.
- Feed rows (each a horizontal-scroll `SectionRow` of `RestaurantCard`s): Most Popular Near You, Top Rated, New on FeastNow, Under 30 Minutes.
- All Restaurants: infinite-scroll grid at the bottom with sort control.
- Skeleton cards while loading; pull-to-refresh re-fetches the feed.
- Cards for closed restaurants: grayed with a "Closed now" badge (icon + label), still tappable through to detail.

### Restaurant detail (pushed route)
- Hero image, serif restaurant name, cuisine tags, rating + review count (mono), address, hours, "Closed now" banner when applicable.
- Menu grouped by category with sticky category tabs; each row: name, description, price (mono, gold), thumbnail, availability state ("Unavailable" dimmed).
- **No Add buttons in Phase 1** (display-only; Phase 2 adds them with the cart).
- Reviews section at the bottom: recent seeded reviews with stars; "See all" if long.

### Search screen (full-screen, from tapping the search bar)
- Recent searches (localStorage, clearable).
- Live-as-you-type results (debounced) grouped **Restaurants** / **Dishes**; tapping a dish opens its restaurant's detail.

### Orders tab (Phase 1 stub)
- Designed empty state: friendly copy ("Your orders will show up here") + "Browse restaurants" CTA → Home. Real content in Phase 3.

### Profile tab (Phase 1 minimal)
- Initials avatar, name/email/phone from `/me`, Logout (clears session → `/login.html`). Everything else arrives in Phase 4 — no placeholder dead entries.

## 7. Errors, loading, empty states

- Home feed: skeletons → content; on request failure, a single friendly retry state (uniform network-error handling matching the auth pages).
- Sections with no data never render as empty rows — they're omitted server-side.
- Restaurant detail / search: same skeleton-then-content pattern; search with no results shows a "No matches" state, not a blank list.

## 8. Testing and verification

- **Backend (Vitest):** per-endpoint tests — home section shapes and ordering, restaurant list filtering/search/pagination, detail grouping, `isOpenNow` logic across boundary times, search grouping; plus a seed-integrity test (counts, rating consistency).
- **Frontend:** Playwright smoke — login → feed renders with sections → open a restaurant → menu + reviews visible → search returns grouped results; screenshot verification against the design system (same workflow as the auth pages).
- **Latency measurement (NFR-1):** verification includes measuring real response times for `/home`, `/restaurants`, and `/search` against the seeded database and recording the numbers — the ~2s budget is verified, not assumed.
- Everything verified locally end-to-end before commit/push (git workflow rule); Vercel and Render auto-deploy from `main`.

## 9. Known limitations (accepted, revisit later)

- **"Most Popular Near You" is not measuring real popularity.** It ranks a synthetic, hand-written `orderCount` from the seed script. It becomes real in Phase 3+ when actual orders accumulate and the basis switches to real order counts. Until then the row is a believable demo, not a signal.
- **"Near You" is not geographic.** No real location logic in Phase 1; the location pill is a static demo address.
- **Desktop is a letterboxed phone frame** (~480px centered), by decision — see §5. Real responsive desktop layout deferred to post-Phase-4.
- **No true push notifications on web.** In-app live status only until the Capacitor wrap (§2); iOS web push is unavailable/unreliable at SRS's target versions.
- **All marketplace content is seeded demo data** (flagged `isDemo`, lifecycle in §3) until the Restaurant role onboards real restaurants.
- **NFR-1 performance is verified only at seed scale** (§8); must be re-benchmarked as data grows.

## 10. Out of scope for Phase 1

Add-to-cart and cart pill; checkout; order placement and the order state machine; live tracking; saved/real addresses (location pill is static); loyalty, promo codes, customer-authored ratings; Order Again and Because-you-liked rows (contract supports them; data arrives in Phase 3); Restaurant/Delivery/Admin shells.
