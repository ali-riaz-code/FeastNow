# Restaurant Role + Real Ordering — Design

**Date:** 2026-07-16
**Status:** Approved by user (brainstorming session)
**Depends on:** Customer Browse Phase 1 (shipped), auth backend (shipped)
**SRS coverage:** FR-1, FR-2 (restaurant fields), FR-16–FR-21; customer ordering FRs needed to feed the queue (cart, place order, cancel, live status). FR-22 (earnings/stats) explicitly deferred.

## 1. Summary

Build the Restaurant role end-to-end in the existing stack — landing signup, role-branched SPA shell, and a real order domain — modeled on Foodpanda's vendor app ("Foodpanda flows, trattoria skin"). Because no Order model exists (Phase 1 was browse-only), this phase also builds **customer cart + cash checkout** so restaurant orders are real, not simulated.

### Decisions made with the user (2026-07-16)

| Decision | Choice |
|---|---|
| Orders data source | **Build customer checkout too** — real end-to-end orders (not a demo simulator, not empty states) |
| Restaurant approval (Admin not built yet) | **Auto-approve after a short delay (~60s)** — real `approvalStatus` gate + Pending Approval screen; Admin phase later replaces the auto-approver |
| Lifecycle after Ready (Delivery role not built) | **Orders park at Ready** ("Waiting for pickup"); no simulated riders. Consequence: no order reaches Delivered this phase; restaurant History holds rejected/cancelled only |
| Foodpanda extras in scope | **Incoming-order full-screen alert + auto-reject countdown only.** Busy/pause mode, category management + bulk sold-out, and earnings summary are OUT |
| Architecture | **Approach 1: role-branched single SPA + polling** (over SSE and over a separate restaurant app) |

### Out of scope (do not build)

Photo/menu-image upload (SRS: future-only) · payouts/bank details (no payments in v1) · restaurant-created promos (SRS puts promos under Admin) · item variants/add-ons, tags, availability schedules · reply-to-reviews · per-day opening hours (schema has one daily window) · busy/pause mode · earnings/statements (FR-22, Low) · delivery partner simulation · push notifications (Capacitor phase).

## 2. Data model (Prisma)

New enum `OrderStatus`: `placed, accepted, preparing, ready, assigned, out_for_delivery, delivered, rejected, cancelled` — full SRS lifecycle in the enum, but transitions beyond `ready` are disabled this phase. Auto-expiry is modeled as `rejected` with `rejectionReason = "Not accepted in time"`.

New model `Order`:

- `id` uuid · `orderNumber` Int `@default(autoincrement()) @unique` (displayed `#FN-1042`; searchable per FR-16)
- `customerId` → `User` · `restaurantId` → `RestaurantProfile`
- `status OrderStatus @default(placed)` · `rejectionReason String?`
- `note String` (customer instructions) · `deliveryAddress String`
- `subtotalCents Int` · `deliveryFeeCents Int` (flat config constant `DELIVERY_FEE_CENTS`, default 9900 = Rs 99.00, snapshotted at order time) · `totalCents Int`
- Timeline: `createdAt` (= placed), `acceptedAt?`, `preparingAt?`, `readyAt?`, `closedAt?` (rejected/cancelled)
- `expiresAt DateTime` (= createdAt + 2 min) · `isDemo Boolean @default(false)`
- Indexes: `(restaurantId, status)`, `(customerId, createdAt)`

New model `OrderItem`:

- `orderId` → `Order` (Cascade) · `menuItemId String?` → `MenuItem` (**SetNull** on delete)
- `nameSnapshot String` · `priceAtOrderCents Int` (mirrors SRS `price_at_order` — **never recompute historical totals from the live menu**) · `quantity Int`

`RestaurantProfile` changes:

- `approvalStatus` enum `pending | approved | rejected`, default `approved` for backfill; **new signups create `pending`**
- `approvedAt` becomes nullable (set on approval)
- `isOnline Boolean @default(true)` — the store Online/Offline toggle
- `userId` gets linked for owned restaurants (demo seed account + new signups)

Customer-facing visibility rule: a restaurant is orderable iff `isActive && approvalStatus == approved && isOnline && open-per-hours`. Browse shows offline/closed restaurants as "Currently closed"; ordering is blocked **server-side**.

## 3. Order state machine (single module)

`backend/src/lib/orderStateMachine.ts` is the only place transitions are defined. Every endpoint calls it; no route re-implements rules (CLAUDE.md mandate).

| From | To | Actor | Notes |
|---|---|---|---|
| placed | accepted | restaurant | sets `acceptedAt`, clears expiry |
| placed | rejected | restaurant | requires reason (picker: Item unavailable / Store too busy / Closing soon / Other) |
| placed | rejected | system | lazy expiry past `expiresAt`, reason "Not accepted in time" |
| placed | cancelled | customer | cancel button while Placed only |
| accepted | preparing | restaurant | sets `preparingAt` |
| preparing | ready | restaurant | sets `readyAt`; **terminal this phase** |

**Lazy expiry:** any read or write touching a `placed` order past `expiresAt` finalizes it as rejected first, atomically (guarded update `WHERE status = 'placed'`), then proceeds. No cron/worker. The client countdown is cosmetic; the server is authoritative. Accept-vs-expiry races resolve via the guarded update — losers get 409.

**Lazy auto-approval:** `GET /restaurant/me` approves a `pending` profile older than ~60s on read. The Admin phase replaces this with a human action on the same field.

## 4. Backend API

All new routes follow the existing deps-injected router pattern (`createXRouter(deps)`), behind `requireAuth`. Restaurant routes additionally require `role == restaurant` and resolve the caller's owned `RestaurantProfile`.

**Auth changes**
- `POST /auth/signup` accepts `role: "customer" | "restaurant"`; restaurant signup additionally requires `businessName`, `businessAddress`, `cuisine` (FR-2) and creates User + pending RestaurantProfile in one transaction.
- `GET /me` returns `role`.

**Customer**
- `POST /customer/orders` — `{restaurantId, items: [{menuItemId, quantity}], note, deliveryAddress}`. Server validates orderability + item availability, recomputes all prices from the live menu, snapshots them, returns the order. 409 with the offending item list if anything is sold out/missing; 409 if restaurant not orderable.
- `GET /customer/orders` — active + history, newest first, paginated.
- `GET /customer/orders/:id` — detail with items + timeline.
- `POST /customer/orders/:id/cancel` — via state machine.

**Restaurant**
- `GET /restaurant/me` — profile + `approvalStatus` (+ lazy auto-approve).
- `GET /restaurant/orders?tab=new|preparing|ready|history&q=&page=` — `q` matches order number or customer name (FR-16). Reads sweep expiry lazily.
- `POST /restaurant/orders/:id/accept` · `POST /restaurant/orders/:id/reject {reason}` · `POST /restaurant/orders/:id/status {to: "preparing" | "ready"}`.
- `GET /restaurant/menu` · `POST /restaurant/menu-items` · `PATCH /restaurant/menu-items/:id` (edit fields, `isAvailable` toggle) · `DELETE /restaurant/menu-items/:id` (confirm in UI; OrderItems keep snapshots).
- `PATCH /restaurant/profile` — name, description, address, cuisines, opensAt/closesAt (FR-21).
- `PATCH /restaurant/store-status {isOnline}`.

**Live updates:** 5-second polling on order screens (both roles), paused when `document.hidden`. No SSE this phase.

## 5. Customer-side UX (makes orders real)

- **Cart becomes a 4th tab** (SRS 4.1: Home/Search, Orders, **Cart**, Profile). Badge with item count.
- **Add to cart** on the restaurant menu: qty stepper per item, sticky "View cart · N items · Rs X" bar. Single-restaurant cart in localStorage; adding from a different restaurant prompts "Replace cart?".
- **Cart/checkout screen:** line items with qty edit/remove, order note, delivery address (text field, remembered locally), fee breakdown (subtotal + flat delivery fee, mono numerals), **"Place order — cash on delivery"**. Unavailable-at-checkout items surfaced from the 409 with a one-tap remove.
- **Orders tab (replaces the placeholder):** active order card with live status timeline — Placed → Accepted → Preparing → Ready, each step **color + icon + label** (DESIGN.md, color-blind safe). Parked-at-Ready copy: "Waiting for rider — live tracking coming soon." Cancel button while Placed. Rejected shows the restaurant's reason. History list below with reorder-friendly detail view (detail only; one-tap reorder deferred).

## 6. Restaurant shell UX (Orders · Menu · Search · Profile)

**Shell branching:** `App.tsx` mounts the customer or restaurant nav tree based on `role` from the session (`/me`). One SPA, shared tokens/components/API layer (NFR-7). AuthGate: `role == restaurant && approvalStatus == pending` → Pending Approval screen (polls `/restaurant/me`, celebrates on approval, unlocks shell).

**Onboarding (landing, vanilla JS like existing pages):** role-select restaurant tile stops pointing at `coming-soon.html` → restaurant signup form (name/email/phone/password **+ business name, address, cuisine**) → existing OTP verification → app Pending Approval screen.

**Orders tab (default landing):**
- Top bar: restaurant name, **Online/Offline toggle** (the most prominent control), notification bell deferred (no push yet).
- Offline state shows a persistent banner across all tabs.
- Segmented control: **New · Preparing · Ready · History**, with count badges.
- New-order card: `#FN-1042`, items + quantities, customer note, order value, **live countdown** to auto-reject, **Accept / Reject** buttons. Reject opens the reason picker.
- **Full-screen incoming-order alert** on new-order detection (poll diff): order summary + Accept/Reject in place, chime + `navigator.vibrate` (sound unlocks after first user interaction — browser autoplay constraint; alert still shows regardless).
- Preparing: card with elapsed prep time + **Mark Ready**.
- Ready: card with "Waiting for pickup" status (no partner info this phase).
- History: rejected/cancelled orders (delivered arrives with the Delivery phase).
- Order detail: full item breakdown with snapshots, price breakdown (mono), customer name + masked phone (`03••••••42`), delivery address, note, status timestamps, **printable receipt** (`window.print` + print stylesheet).

**Menu tab (FR-17):** search-within-menu bar; items grouped by category; each row: thumbnail (existing `imageUrl` or placeholder — no upload), name, price, inline **Available/Sold out** toggle. Floating **+ Add Item**. Item edit screen: name, description, price, category (free text with suggestions from existing categories), availability toggle; **Save / Delete** (delete confirms).

**Search tab (FR-16):** searches own orders (order # or customer name) and own menu items (name); status filter chips; recent searches in localStorage (same pattern as customer search).

**Profile tab:** business info editor — name, description, address, cuisine tags, daily open/close hours (FR-21). **Ratings & Reviews:** average, star breakdown bars, recent reviews list (read-only). Store-status toggle (secondary access). Log out.

**Empty states:** no orders yet ("New orders will appear here"), empty menu ("Add your first item"), empty search, empty history — all designed, per Phase 1 conventions.

## 7. Visual system

Existing tokens and DESIGN.md rules apply: serif display headings, mono for all numerics (prices, timers, order numbers), tomato reserved for destructive actions (Reject, Delete, Offline confirmation), basil for Ready/positive, brass for attention (New order), navy structure. Status is always color + icon + label. Motion 150–250ms with reduced-motion fallbacks; the countdown and elapsed-time displays are live text updates, not animations, so they're exempt and cheap on low-end Android.

## 8. Seeds & demo data

- One **demo restaurant account** (documented login) linked via `userId` to a seeded demo restaurant so the shell is usable immediately without signup.
- A few historical `isDemo` orders (rejected/cancelled mix) so History isn't empty.
- Live orders come from real customer checkouts (use any customer account).
- Existing demo restaurants backfilled `approvalStatus = approved`, `isOnline = true`.

## 9. Error handling

- Place-order against just-offline/closed restaurant → 409, friendly retry message.
- Sold-out/deleted items at place time → 409 with item list; cart offers one-tap removal.
- Invalid transitions (double-accept, accept-after-expiry, cancel-after-accept) → 409 from the state machine; UI refreshes the card's true state.
- Polling failures retry silently with a subtle stale indicator; countdowns keep running client-side.
- Restaurant routes verify ownership on every order/menu-item id (404 on cross-tenant access).

## 10. Testing

- **Unit:** state machine — every legal transition, every illegal one, actor rules, expiry finalization, guarded-update race; price snapshot math; auto-approve threshold.
- **Route-level:** place order (happy path, sold-out 409, offline 409, price recomputation ignores client-sent prices), accept/reject/status endpoints, ownership checks, search.
- **Manual end-to-end before commit:** customer places → restaurant alert fires → accept → preparing → ready → customer timeline reflects each step live; signup → pending → auto-approve; offline toggle hides restaurant from customer browse.

## 11. Build sequencing (for the implementation plan)

1. Schema migration (Order, OrderItem, RestaurantProfile fields) + state machine module + tests.
2. Auth: role in signup/me; restaurant signup (backend + landing form + role-select link).
3. Customer ordering: place/list/cancel endpoints → cart tab + checkout → live Orders tab.
4. Restaurant shell: role branching + Pending Approval → Orders tab (queue, alert, countdown, transitions) → Menu tab → Search tab → Profile tab.
5. Seeds, polish (print receipt, empty states, offline banner), end-to-end verification.
