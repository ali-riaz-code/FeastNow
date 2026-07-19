# Admin Role — Design Spec

**Date:** 2026-07-20
**Status:** Approved (brainstorming), pending spec review
**SRS refs:** FR-36–FR-41, NFR-1–NFR-7, §2.1, §4.1, §7
**Precedent:** Customer, Restaurant, and Delivery Partner roles are already built and in production (Render backend + Vercel `app/` SPA). This is the fourth and final role shell.

---

## 1. Scope & decisions

Four architectural decisions were confirmed up front (they resolve the SRS §2.1-vs-§7 contradiction and the "separate web app?" question):

| Decision | Chosen | Rejected |
|---|---|---|
| **Admin auth** | Shared `User` table, `role = admin` (already in enum). No public signup; admins seeded manually. `requireAdmin` guard. | Separate `AdminUser` table + isolated auth path. |
| **Portal form factor** | A shell (`AdminShell`) inside the existing `app/` SPA, reusing AuthGate + shared API layer + design tokens. Rendered **full-width** (not the phone frame). | A separate `admin/` React/Vite web app. |
| **Build scope** | All five areas in one phase: Dashboard, Approvals, Users, Moderation, Promotions. | High-priority core only (Approvals + Users + Dashboard). |
| **Moderation model** | Admin browses/searches **all** reviews and removes any. | Upstream "report review" action + flagged-review queue. |

**Design defaults folded in (each vetoable):**
- **No permission tiers, no 2FA.** `permission_level` (SRS §7) stays unused; a single `role = admin` grants full access. NFR-3 requires only salted hashes + TLS, both already satisfied.
- **Dashboard third metric is "Pending Approvals"**, not "Flagged Content Count" — because the search-and-remove moderation model produces no flags to count.
- **Promo codes are admin-CRUD only** (create + deactivate, no edit, per FR-40's wording). **No customer-facing redemption** in this phase — that is a separate Medium/Low flow.
- **No audit-log table, no restaurant license verification** this phase (neither exists in the SRS for these flows).

### Explicitly out of scope
Permission tiers; 2FA; audit-log table; review-flag mechanism; customer promo redemption; restaurant business-license upload; charts/BI dashboards (SRS §8 excludes advanced admin analytics).

---

## 2. Data model changes

One Prisma migration adds the following. Nothing existing is renamed or dropped.

```prisma
// User — suspension (FR-38)
model User {
  // ...existing fields...
  suspendedAt      DateTime?
  suspensionReason String?
}

// RestaurantProfile — rejection note (FR-37)
model RestaurantProfile {
  // ...existing fields...
  adminNote String?   // optional reason captured on Approve/Reject
}

enum DiscountType {
  percentage
  fixed
}

// PromoCode (FR-40) — admin-managed; no redemption wiring this phase
model PromoCode {
  id            String       @id @default(uuid())
  code          String       @unique
  discountType  DiscountType
  discountValue Int          // percent (1–100) or fixed cents, per discountType
  active        Boolean      @default(true)
  expiresAt     DateTime?
  createdAt     DateTime     @default(now())

  @@index([active])
}
```

Notes:
- `discountValue` is an integer: whole percent when `percentage`, cents when `fixed` — consistent with the money-in-cents convention (`priceCents`, `totalCents`).
- Restaurant approval already exists (`approvalStatus`, `approvedAt`); Approve/Reject sets those plus the new `adminNote`. No new approval columns needed.

---

## 3. Backend

New `adminRouter.ts` mounted at `/api/admin`, entirely behind a new `requireAdmin` middleware. New `adminRepository.ts` holds the queries (keeps the router thin, matching `ownerRouter` + `ownerRepository`).

### 3.1 `requireAdmin` middleware
Mirrors `createRequireOwner`'s shape: `requireAuth` → load the `User` by `req.userId` → `403` unless `role === "admin"` **and** not suspended. Returns `RequestHandler[]` for mounting.

### 3.2 Endpoints (all `requireAdmin`)

| Method + path | Purpose | FR |
|---|---|---|
| `GET /api/admin/metrics` | `{ activeOrders, newSignups24h, pendingApprovals }` | FR-41 |
| `GET /api/admin/approvals` | List restaurants where `approvalStatus = pending` | FR-37 |
| `GET /api/admin/approvals/:id` | One pending restaurant's detail | FR-37 |
| `POST /api/admin/approvals/:id/approve` | Set `approvalStatus = approved`, `approvedAt = now`, optional `adminNote` | FR-37 |
| `POST /api/admin/approvals/:id/reject` | Set `approvalStatus = rejected`, optional `adminNote` (reason) | FR-37 |
| `GET /api/admin/users?q=&role=` | Search users by name/email/phone, optional role filter | FR-38 |
| `POST /api/admin/users/:id/suspend` | Set `suspendedAt = now`, optional `suspensionReason` | FR-38 |
| `POST /api/admin/users/:id/reinstate` | Clear `suspendedAt` + `suspensionReason` | FR-38 |
| `GET /api/admin/reviews?q=` | List/search all `Rating` rows (by restaurant name) | FR-39 |
| `DELETE /api/admin/reviews/:id` | Remove review, then recompute the restaurant's `avgRating` + `ratingCount` | FR-39 |
| `GET /api/admin/promos` | List all promo codes | FR-40 |
| `POST /api/admin/promos` | Create `{ code, discountType, discountValue, expiresAt? }` | FR-40 |
| `POST /api/admin/promos/:id/deactivate` | Set `active = false` | FR-40 |

**Metrics definitions (deterministic, testable):**
- `activeOrders` = orders whose `status` is not in `{delivered, rejected, cancelled}`.
- `newSignups24h` = `User` rows with `createdAt >= now - 24h`.
- `pendingApprovals` = restaurants with `approvalStatus = pending`.

**Guardrails:**
- An admin **cannot suspend another admin or themselves** (400) — prevents lockout.
- Suspend/reinstate/remove validate the target exists (404) and the state transition is legal (e.g. reinstate only a suspended user) — 409 otherwise.
- Promo `code` is uppercased + trimmed; duplicate → 409 (unique constraint). `discountValue` validated per type (percentage 1–100; fixed > 0).

### 3.3 Suspension enforcement (the cross-cutting change)
`suspendedAt != null` must actually block the account, not just display a badge:
- **`/login`**: after password match, reject a suspended user with a generic 403 ("This account has been suspended.").
- **`requireAuth`** (or the shared user-load path): a suspended user's token is rejected 401/403 so existing sessions die on next request.
- **Customer browse**: a suspended **restaurant** must disappear from search/browse. Reuse the existing active/approved gate — extend the "is orderable" predicate to also require `owner.suspendedAt == null` (or, simpler and matching the existing `isActive` gate, flip the restaurant's `isActive` when its owner is suspended). Chosen approach: **extend the browse predicate**, so reinstating restores visibility without a second write. Confirm during implementation which is cleaner against the current query.

---

## 4. Frontend — AdminShell

### 4.1 Routing & entry
- `App.tsx` `RoleShell` gains: `me.role === "admin" ? <AdminShell /> : ...`. The existing "admin shell arrives in a later phase" comment is removed.
- Admin logs in via the **existing** login page/flow (shared token). No new auth UI is strictly required; a small "Staff / Admin" affordance on the login screen is optional and can be deferred. **Decision: no separate admin login page this phase** — admins use the normal login; role routing does the rest.

### 4.2 Layout — full-width back-office, same skin
The three app roles render in a phone-width frame with a fixed bottom `tab-bar` (max 480px). Admin is a back-office and renders **full-width** with a **left sidebar nav** instead — but built **entirely from existing tokens and idioms**, so it reads as the same product:
- Canvas `--cream`; sidebar `--off-white` with a `--dough` right border; content max-width ~`--maxw` with `--gutter` padding.
- Sidebar items reuse the `tab-bar__tab`/`--active` pattern (navy active, brown idle, `--dur-fast var(--ease-out-quart)` color transition), stacked vertically with icon + label.
- New CSS lives in `app/src/styles/admin.css`, imported like the other role stylesheets. **No new tokens** — only compositions of existing `--r-*`, `--s-*`, `--sh-*`, color, and motion vars.

### 4.3 Screens
All screens are composed from existing components/idioms (`SearchBar`, `Chip`, card shell, `.btn-primary`/outline buttons, `StatusBadge`/`OrderStatus` where status is shown).

- **Dashboard** — three metric cards (card = `--r-md`, `--off-white`, `--sh-raised`, `--s-lg` padding). Big number in `--font-mono` (numerics-only rule), label in `--font-sans`, section heading in `--font-display`. Read-only; optional Refresh (outline button). No charts.
- **Approvals** — list of pending restaurants (name/cuisine/address/submitted date) as rows/cards → detail panel with full info + **Approve** (`.btn-primary`) / **Reject** (outline, `--tomato` border like `.btn-logout`) + optional reason field.
- **Users** — `SearchBar` (reused verbatim) + role filter `Chip`s (Customer/Restaurant/Delivery Partner) → results list (name/role/status/join date) → detail with **Suspend** (tomato outline) / **Reinstate** (`.btn-primary`). Status shown as a color+icon+label badge (color-blind-safe, per DESIGN.md).
- **Moderation** — search reviews by restaurant + list (reviewer, target restaurant, stars in `--gold-deep`, text) → **Remove Review** (tomato outline) with a confirm step.
- **Promotions** — list of codes (code in `--font-mono`, discount, active/inactive badge, expiry) + **Create Promo Code** (`.btn-primary`) opening a form (code, discountType chips, value, expiry) + per-row **Deactivate** (outline).

### 4.4 Design-fidelity mandate (hard requirement)
Every admin screen must look built by the same person on the same day as the landing page:
- **Color:** only the palette in `tokens.css`. **Gold-Is-Rare** — gold appears only on rating stars (`--gold-deep`) and focus rings (`--gold` glow, as in `.search-bar:focus-within`). Never a base/fill color.
- **Type:** `--font-display` for headings, `--font-sans` for body/UI, `--font-mono` for numerics only (metrics, prices, promo codes, counts). No new font sizes/weights invented — reuse the scale already in the shipped CSS.
- **Shape/elevation:** `--r-sm/md/lg/pill` and `--sh-raised`/`--sh-overlay` only. Cards match `restaurant-card`'s radius/shadow/`:active { scale(0.98) }` feel.
- **Motion:** only `--dur-fast`/`--dur`/`--dur-slow` with `--ease-out-quart`/`--ease-out-expo`. No new curves or durations. Respect the existing reduced-motion posture.
- **Buttons:** reuse `.btn-primary` and the outline (`.btn-retry`/`.btn-logout`) styles; destructive actions use the tomato-outline variant. No new button shapes.
- **Operator-Restraint:** restraint over decoration — three numbers, not a BI dashboard; plain lists, not ornamented panels.

---

## 5. Seeding

A `seedAdmin` script (or an addition to the existing seed) creates at least one admin `User` (`role = admin`, salted password hash, flagged/derivable as non-demo). Documented so the operator can create real admins pre-launch. Credentials surfaced to the user after implementation, not committed.

---

## 6. Testing (TDD, matching repo convention)

Router tests (RED→GREEN) per endpoint group, plus the cross-cutting behaviors that are easy to regress:
- **Auth:** non-admin token → 403 on every `/api/admin/*`; suspended admin → blocked.
- **Approvals:** approve flips status + makes the restaurant appear in customer browse; reject stores the note and keeps it hidden.
- **Users:** suspend blocks a subsequent `/login`; suspend a restaurant owner removes it from browse; reinstate restores both; cannot suspend self/another admin.
- **Moderation:** removing a review recomputes `avgRating`/`ratingCount` correctly (incl. removing the last review → rating 0, count 0).
- **Promotions:** duplicate code → 409; percentage bounds enforced; deactivate flips `active`.
- **Metrics:** each of the three counts matches seeded fixtures exactly.

Frontend: build + lint clean; manual/verify pass driving admin login → each tab.

---

## 7. Build order (implementation sequencing)

1. Schema migration (`suspendedAt`, `suspensionReason`, `adminNote`, `PromoCode`, `DiscountType`).
2. `requireAdmin` + suspension enforcement in `/login` and `requireAuth` (with tests).
3. `adminRepository` + `adminRouter` endpoints, group by group, TDD.
4. `seedAdmin`.
5. `AdminShell` + `admin.css` + `App.tsx` wiring.
6. The five screens, composed from existing components.
7. Verify pass (admin login → all tabs), commit, push.
