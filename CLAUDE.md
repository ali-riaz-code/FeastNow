# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

No longer greenfield. Built so far: static landing + vanilla-JS auth flow in `landing/` (Vercel), Node/TS + Prisma auth backend in `backend/` (Render, Supabase Postgres), design docs in `docs/superpowers/`. The requirements spec is `FeastNow_SRS.docx` (SRS v1.0, July 2026); the stack and requirements below are constraints, not suggestions.

**Build order (decided 2026-07-13, reversing the earlier Auth → Admin → Restaurant → Customer → Delivery order):** Customer role is built first, on seeded demo data flagged `isDemo` (lifecycle: retired via `isActive: false` when real restaurants onboard; hard-purge script for pre-launch). Admin and Restaurant roles follow the customer phases. Rationale and confirmation recorded in `docs/superpowers/specs/2026-07-13-customer-browse-phase1-design.md` §2.

## Tech stack

- **Client (decided 2026-07-13, reversing the original React Native plan):** **mobile-first web** — vanilla HTML/CSS/JS for landing/auth pages in `landing/`, and a **React + Vite + TypeScript SPA** in `app/` (served at `/app/`) for the role shells, starting with Customer. Targets phone browsers on Android 10+ / iOS 15+; renders as a centered phone-width frame on desktop (accepted limitation; responsive desktop deferred). PWA-installable (manifest + service worker). **Native capabilities (background geolocation for FR-27, FCM/APNs push, app-store distribution) arrive via a Capacitor wrap of the SPA, planned before the Delivery Partner role** — until then, customer notifications are in-app live status (polling/SSE), since mobile-web push is unavailable/unreliable at target iOS versions.
- **Backend:** Node.js + TypeScript, REST API — **Express** (chosen; in production on Render with Prisma + Supabase Postgres). The SRS only specifies "cloud-hosted REST API over HTTPS/JSON" (§2.4, §4.3); it does not mandate a language or framework, so this was chosen for consistency with the RN client (shared TS types/DTOs between mobile and API) and typical fit for a REST-over-HTTPS marketplace backend.
- **Database:** PostgreSQL. Recommend an ORM (Prisma or TypeORM) given the relational, foreign-key-heavy schema in SRS §7 (Order → Order Item → Menu Item, etc.).
- **Admin portal:** SRS §1.2/§2.1 describes Admin as a "web or tablet-based back-office" — likely a separate web app (e.g. React) rather than a shell inside the RN mobile app. Confirm this before building; it changes the repo layout (mobile app vs. mobile app + separate admin web app).
- **Push notifications:** FCM (Android) / APNs (iOS), per SRS §4.3 — delivered via the Capacitor wrap (see Client above); in-app live status until then.
- **Mapping/geolocation:** required by SRS §4.3 for delivery routing and live tracking; vendor not specified — decide (e.g. Google Maps Platform, Mapbox) before building the Delivery Partner and tracking modules.
- **Auth:** salted password hashes, TLS 1.2+ in transit (NFR-3). No specific auth library mandated — decide when scaffolding.

## Coding conventions

Not yet established by real code, so these are starting defaults — update once the team has actually written code and picked patterns:

- **Language:** TypeScript everywhere (mobile + backend), strict mode on.
- **Formatting/linting:** ESLint + Prettier, shared config across mobile and backend where feasible.
- **Naming:** camelCase for variables/functions, PascalCase for components/classes/types, snake_case only where it mirrors DB columns (matches SRS §7 field names like `price_at_order`, `current_location`).
- **API layer:** role-specific UI logic must sit behind a shared API layer (NFR-7) — do not fork business logic per shell; fork only presentation.
- **State machine logic:** order status transitions (Placed → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered, plus the Rejected/Cancelled branch) must be validated in one shared place (e.g. a single state-machine module/service), not re-implemented per endpoint.
- **Money/pricing:** always snapshot `price_at_order` on Order Item creation; never recompute historical order totals from the live menu.

## What FeastNow is

A **multi-restaurant food-ordering marketplace** (think Foodpanda / Uber Eats), not a single-restaurant app. One mobile codebase + shared backend renders **four distinct role-based experiences** selected by account type:

- **Customer** — browse/search all approved restaurants, order, track live delivery, rate, earn loyalty.
- **Restaurant** — manage only its own profile/menu/orders; accept-reject-update order status.
- **Delivery Partner** — go online/offline, accept assignments, confirm pickup, share live location, mark delivered.
- **Admin** — web/tablet back-office: approve restaurants, moderate reviews/users, manage promos, view metrics.

Targets Android 10+ and iOS 15+. Cloud-hosted REST API over HTTPS/JSON. **No in-app payments in this version** — cash / pay-on-pickup only. No multi-language support yet.

## Architecture that spans multiple areas

- **One app shell, four navigation shells.** The single mobile app switches its entire navigation tree based on `User.role` (`customer | restaurant | delivery_partner | admin`). Role is chosen up-front at first launch and drives which sign-up form and home UI appear. Keep role-specific UI logic behind a **shared API layer** (NFR-7) so shells stay independent but consistent. A shared visual design system (color/type/components) must make all four shells feel like one product.

- **Order lifecycle is a fixed state machine** — the backbone that couples Customer, Restaurant, and Delivery Partner modules:
  ```
  Placed → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered
  ```
  A `Rejected/Cancelled` branch is reachable only from `Placed` or `Accepted`. Restaurant drives `Accepted → Preparing → Ready`; the system auto-assigns a nearby available delivery partner at `Ready`; the partner drives `Assigned → Out for Delivery → Delivered`. Status changes fan out to customer + restaurant + partner via push notifications and live status views. Treat this sequence as authoritative — validate all transitions against it.

- **Delivery assignment** is triggered by the restaurant marking an order `Ready`: assign to the nearest **online** partner by proximity (or an open claimable pool), with an accept/decline time window. Requires a mapping/geolocation service for routing and continuous live-location sharing during delivery.

- **Cross-cutting services (external):** push notifications (FCM/APNs) for order/delivery updates; mapping/geolocation for assignment, routing, and live tracking. Admin is a **separately-authenticated** portal — admin credentials are elevated and distinct from customer/restaurant/partner accounts.

## Git workflow

After completing and verifying a task (code runs, no errors), always commit and push
to `main` on GitHub without waiting to be asked. Use clear, conventional commit
messages (e.g. `feat: add order state machine`, `fix: correct price_at_order snapshot`).
Never push code that hasn't been tested/run locally first. Vercel auto-deploys on every
push to `main` — no separate deploy step needed.

## Core data model (from SRS §7)

Central entities and their key relationships — the schema all modules share:

- `User` (role: customer | restaurant | delivery_partner | admin) — base account for the three app roles.
- `Restaurant Profile` (user_id, business name, address, cuisine, hours, average_rating).
- `Menu Item` (restaurant_id, name, description, price, availability).
- `Order` (customer_id, restaurant_id, delivery_partner_id, status, note, promo_code_id) → has many `Order Item` (menu_item_id, quantity, **price_at_order** — snapshot the price at order time, do not recompute from the live menu).
- `Delivery Partner Profile` (user_id, vehicle_type, availability_status, current_location).
- `Rating` (order_id, target_type: restaurant | delivery_partner, stars 1–5, review_text) — a completed order can rate both the restaurant and the partner.
- `Loyalty Account` (customer_id, points_balance); `Promo Code` (code, discount_type, discount_value, active, expiry_date).
- `Admin User` is a **separate** entity from `User` (own credentials + permission_level).

## Requirement priorities

The SRS tags every requirement High / Medium / Low. Build **High-priority** flows first — auth, search, browse menu, cart, place order, order-status management, delivery assignment/pickup/tracking, ratings visibility, restaurant approval. Loyalty redemption, promo codes, reviews, and analytics are Medium/Low. When scoping or sequencing work, follow these priorities rather than inventing your own.

## Explicitly out of scope (do not build)

In-app payments/refunds; multi-order route optimization; multi-language; advanced restaurant/admin analytics. Camera/menu-photo upload is future-only.

## Key non-functional constraints

- Search returns within ~2s under normal conditions (NFR-1).
- Passwords stored as **salted hashes**; all traffic TLS 1.2+ (NFR-3).
- Must run acceptably on low-to-mid-range Android devices (restaurant staff hardware).
- Design for scale from hundreds to tens of thousands of concurrent users without redesign (NFR-5).


## Design context

Frontend design work is governed by two root files — read them before building or changing any UI:

- **`PRODUCT.md`** — strategic: register (`product`), users, purpose, brand personality, anti-references, design principles, accessibility.
- **`DESIGN.md`** — visual system: palette, typography, elevation, components, do's/don'ts. Currently a SEED (pre-code); re-run `/impeccable document` once UI code exists to capture real tokens.

**Two references, kept separate — "Foodpanda flows, trattoria skin":**
- **Functionality / UX flows → Foodpanda.** Mirror its marketplace IA and interaction patterns (location gate, restaurant home feed + cuisine tiles + search, sectioned menu, item customization + cart, cash checkout, live tracking timeline + map, history/reorder, post-delivery ratings, separate rider/vendor flows). Adopt the *flows*, not the pink look.
- **Visual identity → `pizza-amici.nl`.** Warm rustic-Italian trattoria: layered cream canvas, deep-navy structure/ink, brass-gold accent, tricolore (tomato/basil) status pops; serif display + clean sans body + **mono for numerics only**. Order status is always color **+ icon + label** (color-blind safe). Motion is responsive (150–250ms) with reduced-motion fallbacks — never brand-site scroll choreography that stutters on low-end Android.

## Source of truth

`FeastNow_SRS.docx` is the agreed basis for design, implementation, and testing (IEEE 830). When a requirement is ambiguous, cite the specific `FR-` / `NFR-` ID and confirm rather than assume.
