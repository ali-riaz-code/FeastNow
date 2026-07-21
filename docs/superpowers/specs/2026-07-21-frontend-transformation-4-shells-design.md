# Frontend Transformation — All Four Role Shells

**Date:** 2026-07-21
**Status:** Approved (design), pending implementation plan
**Scope:** Visual + UX transformation of the `app/` React SPA (Customer, Restaurant, Delivery, Admin shells) to match the animated, color-rich language of the `landing/` site. **Presentation only — no functionality changes.**

---

## 1. Goal & Non-Goals

### Goal
Transform the four role shells from their current flat, quiet state into an animated, color-rich "trattoria brought to life" experience that matches the `landing/` site's energy — bold color variety, orchestrated motion, and polished UX — tuned **maximal across all four shells** (overriding the former Operator-Restraint Rule, per explicit user decision on 2026-07-21).

### Non-Goals (hard constraints)
- **No functionality changes.** No new routes, no removed routes, no API changes, no changes to state logic, the cart, the order state machine, auth gating, polling, or any data flow.
- JSX may be **restructured for layout** and **wrapped in motion components**; event handlers, effects, refs, and business logic remain behaviorally identical.
- All existing behavior and tests remain green.
- No dark mode (out of scope).
- No changes to `landing/` or `backend/`.

### Invariants preserved
- **Color-blind-safe status:** every order-lifecycle / availability state remains color **+ icon + label**, never color alone.
- **Contrast:** all text remains WCAG 2.1 AA (body ≥4.5:1, large/bold ≥3:1).
- **Reduced motion:** every animation has a `prefers-reduced-motion` fallback (crossfade or instant).
- **Low-end Android:** motion stays on transform/opacity/filter (compositor-friendly); no animating layout properties; motion library loaded in its lightweight form.

---

## 2. Current State (baseline)

- **Stack:** React 19 + Vite 8 + react-router 6, TypeScript strict. No animation library today.
- **Design tokens:** `app/src/styles/tokens.css` is **identical** to `landing/assets/css/tokens.css` (same palette, type, radius, space, elevation, z-scale, motion eases/durations). Foundation already shared.
- **Shells:** `CustomerShell`, `RestaurantShell`, `DeliveryShell` render the shared bottom `TabBar`; `AdminShell` is a full-width back-office with a left sidebar (keeps this layout).
- **Motion today:** skeleton shimmer, tab color fade, `:active` scale on cards. That is essentially all.
- **Landing motion (the reference):** GSAP + Lenis + ScrollTrigger + Swiper. Signature = one-time intro curtain (letters rise → curtain lifts → hero assembles: awning drops, ticker falls, cart rolls in, cards fly in, steam billows), staggered `expo.out` entrances, native cross-document View Transitions for the auth flow.

### Screen inventory (all get the treatment)
- **Customer (7):** Home, Restaurant detail, Search, Cart, Orders, Order detail, Profile.
- **Restaurant (7):** Orders queue, Order detail, Menu, Menu-item edit, Search, Profile, Pending-approval.
- **Delivery (5):** Active delivery, Availability, Earnings, Profile, Pending-approval.
- **Admin (5):** Dashboard, Approvals, Users, Moderation, Promotions.
- **Shared:** boot screen, `AuthGate`, `TabBar`, cards/chips/skeleton/search components, assignment-offer modal, incoming-order alert.

---

## 3. Technical Approach

### 3.1 Motion library
- Add **`motion`** (Framer Motion's successor; React 19-native). Package: `motion`, import from `motion/react`.
- Load via **`LazyMotion` + `domAnimation`** feature bundle (`<LazyMotion features={domAnimation}>` at app root) and use the `m.*` components (not `motion.*`) so the tree-shaken bundle stays ~15–20KB rather than the full ~50KB.
- **`useReducedMotion()`** gates or neutralizes every animation. A shared `useReducedMotion`-aware variants helper avoids per-component reduced-motion boilerplate.
- Route transitions via **`AnimatePresence`** around the routed outlet in each shell.

### 3.2 Shared-first foundation (Phase 0)
Build once, compose everywhere. New shared modules under `app/src/`:

- **`styles/motion.css`** — new surface + motion tokens layered on `tokens.css` (never edits the shared token values; adds `--awning-grad`, spring/stagger presets, elevation for headers, focus/press helpers).
- **`lib/motion.ts`** — shared `motion` config: `domAnimation` re-export, reusable `variants` (screenEnter, staggerParent, staggerChild, revealUp, popIn), spring presets, and a `useMotionSafe()` hook returning either the real variants or reduced ones.
- **`components/Screen.tsx`** — wraps each route's root in an entrance animation (fade+rise, staggered children), owns the `.screen` padding. Drop-in replacement for the current `<main className="screen">`.
- **`components/AppHeader.tsx`** — the navy "awning" top bar (title/brand, optional actions slot, optional search slot). One component, themed per shell via props.
- **`components/TabBar.tsx`** (upgrade existing) — keep the flex layout + `TabDef` API; add a **sliding gold pill indicator** (shared layout animation via `layoutId`) that moves to the active tab, plus an icon pop on activation. Badge and a11y unchanged.
- **`components/Reveal.tsx`** — in-view stagger primitive (`whileInView`) for lists/sections; enhances an already-visible default (content is never gated behind the animation).
- **`components/PageTransition.tsx`** — `AnimatePresence` wrapper keyed on `location.pathname` for route change transitions.
- **`components/BootIntro.tsx`** — one-time-per-session curtain (see §5).

### 3.3 What "no functionality change" means concretely
- Every screen keeps its exact hooks, effects, handlers, and returned data paths.
- Refactors are limited to: replacing `<main className="screen">` with `<Screen>`, wrapping lists in `<Reveal>`/stagger parents, swapping static elements for `m.*` equivalents, adding an `<AppHeader>`, and CSS. IntersectionObserver infinite-scroll, pull-to-refresh, polling, cart math, and status transitions are untouched.
- Playwright e2e specs (`test:e2e`) and the app build (`tsc -b && vite build`) must pass unchanged after every phase.

---

## 4. Visual System Upgrades (shared)

Layered on the existing palette — no token value changes; only additions.

- **Awning headers:** navy (`--navy` → `--navy-deep`) top bars per shell, replacing bare cream headers; cream/gold text on navy (AA verified). Gives each shell the landing's "storefront" anchor.
- **Section canvases:** alternate `--cream` / `--butter` / `--off-white` backgrounds to create rhythm and depth (landing uses `--butter` for gold-tinted sections). No side-stripe borders.
- **Confident gold:** gold stays "the one thing that matters" per screen (price, rating, current step, active tab) — used more consistently, never as body text on cream (Gold-Is-Rare Rule kept).
- **Tricolore forward:** status pills gain motion (pulse on active states) while keeping color+icon+label.
- **Elevation:** headers and sheets gain the existing `--sh-overlay`; cards keep `--sh-raised`, animating shadow only on interaction.

---

## 5. Boot Intro (one-time per session)

- A `BootIntro` overlay echoing the landing curtain: FeastNow wordmark rises → curtain lifts (expo) → first screen assembles beneath.
- **Gated:** plays once per browser session (`sessionStorage` flag), and is fully skipped under `prefers-reduced-motion` (instant to app). Never plays on route navigation.
- Reuses the existing boot-screen slot; does not block interactivity beyond its ~1s run and never gates content visibility (app is rendered underneath).

---

## 6. Per-Shell Plan

### 6.1 Customer (fullest energy)
- Boot curtain (shared).
- Navy awning `AppHeader` (location pill + search).
- Cuisine chips animate in (stagger); selected chip animates.
- Home sections + grid: staggered card reveals via `Reveal`; `RestaurantCard` gains a richer hover/press and image treatment.
- Restaurant detail: parallax image hero, sticky menu-section headers, animated add-to-cart.
- Cart: animated line-item add/remove/quantity, animated total.
- Orders + Order detail: **living status timeline** — animated progress fill, gold current-step, gentle pulse on the active state; reuses existing `OrderStatus` triple.
- Profile: warm restyle, animated avatar.

### 6.2 Restaurant (calm but alive)
- Navy operator `AppHeader` with the existing online/offline toggle (animated knob + state).
- Incoming-order alert: animated entrance synced to the existing chime.
- Order queue cards: animate on arrival and as status advances; gold "action needed" pulse on orders awaiting action.
- Menu / menu-edit / search / profile: awning header, big targets, tasteful entrance motion.

### 6.3 Delivery (outdoor-legible)
- High-contrast navy header.
- Availability: large GO ONLINE toggle with a live pulse ring when online.
- Assignment-offer modal: animated entrance + the existing countdown, now visualized.
- Active delivery: animated status/route progression.
- Earnings: count-up numbers (mono), animated rows. Profile restyle.

### 6.4 Admin (back-office, keeps sidebar)
- Sidebar restyled richer (navy, animated active nav item).
- Dashboard: colored metric tiles with **count-up** values, animated on load.
- Approvals / Users / Moderation / Promotions: animated table/list rows, smooth tab + master/detail transitions. Density preserved.

---

## 7. Documentation Updates

- **DESIGN.md:** retire the Operator-Restraint Rule; document the new maximal-everywhere motion + surface system, the shared components, and the motion tokens. Re-capture real component tokens now that animated code exists.
- **PRODUCT.md:** adjust the design-principles wording that reserved expressiveness for Customer, to reflect the maximal-everywhere decision, while keeping "works on the worst phone in the room" as a hard constraint.

---

## 8. Phasing (→ implementation plan)

| Phase | Content | Verification |
|---|---|---|
| 0 | Foundation: install `motion`, `motion.css`, `lib/motion.ts`, shared components (`Screen`, `AppHeader`, `TabBar` upgrade, `Reveal`, `PageTransition`, `BootIntro`) | build + e2e green; shared components render in one shell |
| 1 | Customer shell (7 screens) | build + e2e green; visual pass |
| 2 | Restaurant shell (7 screens) | build + e2e green; visual pass |
| 3 | Delivery shell (5 screens) | build + e2e green; visual pass |
| 4 | Admin shell (5 screens) | build + e2e green; visual pass |
| 5 | DESIGN.md / PRODUCT.md update; full polish + a11y/reduced-motion/contrast verification | build + e2e green; final review |

Each phase ends with `npm run build` (tsc + vite) and `npm run test:e2e` passing, and is committed separately.

---

## 9. Risks & Mitigations

- **Jank on low-end Android** → `LazyMotion` lightweight bundle; transform/opacity/filter only; `will-change` used sparingly; reduced-motion path is a true fast-path.
- **Accidental behavior change during JSX restructure** → e2e suite gates every phase; refactors limited to presentation wrappers; no edits to effect/handler bodies.
- **Motion overload ("too much")** → motion conveys state/feedback/reveal, not decoration; staggers are per-list not per-section-reflex; a `quieter` pass is available if any shell feels overstimulating.
- **Contrast regressions from new navy surfaces** → verify cream/gold-on-navy pairings at build; keep gold as fill (never body text on cream).

---

## 10. Success Criteria

- All four shells feel like one animated, color-rich product consistent with the landing site.
- Zero functional regressions; build + e2e green throughout.
- Every animation degrades gracefully under reduced motion; all text AA; status remains color+icon+label.
- DESIGN.md/PRODUCT.md reflect the shipped system.
