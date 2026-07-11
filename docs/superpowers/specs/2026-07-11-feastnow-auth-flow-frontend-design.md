# FeastNow Auth Flow — Frontend Design Spec

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)
**Depends on:** `docs/superpowers/specs/2026-07-11-feastnow-backend-auth-service-design.md` (Spec A) — signup/login/OTP calls hit that API for real, not a mock.
**Scope:** Customer path only. Restaurant is paused (per `CLAUDE.md`) and gets a stub, same as today's `login.html` placeholder.

## 1. Summary

Adds the Customer-facing auth flow to the existing static `landing/` site:
role-select → Customer login → sign-up (with real email OTP) → login, plus a
forgot-password screen (UI-only, mocked backend) and a minimal post-auth
landing spot. Stays in the existing multi-page, no-framework architecture
(separate HTML files, shared `assets/css`/`assets/js`), matching the current
`index.html`/`login.html` pattern — no SPA rewrite.

## 2. Pages

| File | Purpose | New / rebuilt |
|---|---|---|
| `role-select.html` | "Are you a Restaurant or a Customer?" | New |
| `login.html` | Real Customer login (split-screen) | Rebuilt (currently a "coming soon" stub) |
| `signup.html` | Sign-up form + in-place OTP step (split-screen) | New |
| `forgot-password.html` | Full UI, mocked backend | New |
| `welcome.html` | Post-auth stub, greets by name via `/api/me` | New |
| `coming-soon.html?for=restaurant\|delivery` | Shared stub for the paused Restaurant path and the existing "Start riding" delivery CTA | New (replaces the current login.html stub content, parameterized) |

## 3. Routing changes on `index.html`

- All "Get Started" CTAs (hero, nav, footer — currently → `login.html`) now
  point to `role-select.html`.
- "List your restaurant" → `coming-soon.html?for=restaurant`.
- "Start riding" → `coming-soon.html?for=delivery`.

## 4. Cross-page motion

- Primary: the **View Transitions API** for cross-document navigation
  (Chrome/Edge get real animated handoffs between pages).
- Fallback for browsers without support: a small JS helper
  (`assets/js/transitions.js`) that adds a fade-out class on link click,
  waits ~180ms, then navigates; the destination page fades in on load.
- Reuses existing tokens only — `--ease-out-expo`, `--dur-fast` (160ms),
  `--dur` (220ms), `--dur-slow` (800ms) from `tokens.css`. No new timing
  system.
- `prefers-reduced-motion`: transitions collapse to an instant swap, same
  convention as the rest of the site.

## 5. `role-select.html`

- Centered card, two tiles: "I am a Customer" / "Are you a Restaurant?".
- Whole screen enters with a scale+fade pop (0.92 → 1, `--ease-out-expo`,
  `--dur-slow`) — a deliberate "pop up," not a hard cut.
- Each tile has a distinct hover: Customer tile lifts with a gold glow,
  Restaurant tile lifts with a navy glow — reusing the `Raised` shadow token
  and the scattered-tilt feel already used on the cuisine tickets.
- "I am a Customer" → `login.html`. "Are you a Restaurant?" → clickable,
  navigates to `coming-soon.html?for=restaurant` (not a disabled/greyed tile —
  it should feel real, on-brand, per the earlier decision).

## 6. `login.html` / `signup.html` — split-screen layout

- **Left panel:** reuses the existing `.hero__card--left` envelope treatment
  (torn-paper flap + wax seal) from the hero, resized to hold form fields
  instead of stat copy.
- **Right panel:** reuses the existing `.cart` SVG illustration, at reduced
  motion intensity — idle steam/wheel animation only, no wheel-spin/mouse
  parallax — so it doesn't compete with the form for attention.
- Panels enter via translate+rotate (separate transform properties, matching
  the GSAP-safe convention already used for the hero card variants) — full
  animation treatment, pushed to match the hero's energy, not a subtle fade.
- **`login.html` fields:** email-or-phone identifier, password. Buttons use
  the existing `.btn`/`.btn--gold`/`.btn--navy` + `.btn__roll` hover-roll
  treatment — fully interactive, not flat. Includes "New Sign Up" (→
  `signup.html`) and "Forgot Password" (→ `forgot-password.html`).
- **`signup.html` fields:** Name, Email, Phone, Password. Submitting the form
  calls `POST /api/auth/signup/request-otp` for real; on success, the *same*
  envelope panel morphs in place into the OTP step (no page navigation) —
  6 individual digit boxes in the numeric mono font (Azeret Mono, per
  DESIGN.md's mono-for-numbers rule), auto-advancing focus, plus a
  countdown-gated "Resend code" link (60s cooldown).
  - Wrong OTP: tomato-colored shake + icon + helper text (per DESIGN.md's
    input-error spec), attempts remaining surfaced after a failure.
  - Correct OTP: calls `POST /api/auth/signup/verify-otp` with the
    originally-entered name/email/phone/password + the OTP; on success, a
    wax-seal "stamp" animation plays on the envelope, the returned JWT is
    stored (`localStorage`), and the page navigates to `welcome.html`.
- **`login.html` submit:** calls `POST /api/auth/login`; on success stores
  the JWT and navigates to `welcome.html`; on failure, inline tomato
  error + shake (generic "incorrect email/phone or password" — no user
  enumeration, matching Spec A's API behavior).

## 7. `forgot-password.html`

- Full on-brand UI (not a bare stub): email input → submit → "check your
  email" confirmation state, fully animated (entrance + transition between
  the two states), matching the site's motion intensity.
- Calls a **mocked** endpoint (client-side simulated delay + always-success
  response) — no real backend route exists yet (Spec A explicitly excludes
  password reset). This is a placeholder contract Spec A can fill in later
  without the frontend changing shape.

## 8. `coming-soon.html`

- Reuses the tone/copy of the current `login.html` stub ("we're still
  setting the table") but reads a `?for=` query param to swap the headline
  between a restaurant-flavored and delivery-flavored message, avoiding two
  near-duplicate stub pages.

## 9. `welcome.html`

- Reads the stored JWT; if absent, redirects to `login.html`.
- Calls `GET /api/me`; on success shows "Welcome, {name} — your table is
  being set," styled consistently with the other stubs.
- On a 401 (expired/invalid token), clears the stored token and redirects to
  `login.html`.

## 10. Responsive behavior

- Below tablet width, the split-screen stacks: form on top, full-width; the
  `.cart` illustration shrinks to a small decorative header graphic rather
  than a side panel — matching the existing mobile simplification pattern
  (3D perspective/diorama already disabled on mobile for the hero).

## 11. New assets

- `assets/css/auth.css` — loaded only by `role-select.html`, `login.html`,
  `signup.html`, `forgot-password.html`, `welcome.html`, `coming-soon.html`.
  Keeps `main.css` from growing with auth-only component styles.
- `assets/js/auth.js` — form validation (email/phone/password format,
  inline tomato errors), OTP digit-box behavior, and the `fetch()` calls to
  Spec A's API.
- `assets/js/transitions.js` — cross-page View Transitions handling + the
  fade fallback described in §4.

## 12. Validation rules (frontend)

- Email: standard format check.
- Phone: non-empty, digits (+ optional leading `+`), no strict international
  format validation (out of scope — SRS doesn't specify a phone format).
- Password: minimum 8 characters (mirrors what Spec A's backend enforces
  server-side — the frontend check is a UX nicety, not the source of truth).

## 13. Out of scope (this spec)

- Restaurant, delivery partner, admin login/signup flows.
- Real forgot-password backend.
- Any post-auth Customer app functionality (browse/order/track) — `welcome.html`
  is intentionally a dead-end stub.
