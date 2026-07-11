# FeastNow Auth Flow Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Customer-facing auth flow (role-select → login → sign-up with real OTP → welcome, plus forgot-password and a paused-role stub) to the existing static `landing/` site, wired to the backend from `docs/superpowers/plans/2026-07-11-feastnow-backend-auth-service.md`.

**Architecture:** Plain multi-page HTML (matching the existing `index.html`/`login.html` pattern, no framework, no build step). Shared logic lives in small ES modules (`config.js`, `auth.js`, `transitions.js`) imported by page-specific scripts. Cross-page motion uses the native `@view-transition` CSS rule where supported, with a JS fade fallback elsewhere. `index.html` itself is touched only for three `href` swaps — its existing intro/scroll choreography is not otherwise modified, to protect the already-shipped, tuned hero.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), the existing `reset.css`/`tokens.css`/`main.css`, a new `assets/css/auth.css`. No new build tooling.

## Global Constraints

- Only `landing/` files change — no backend code here (see the backend plan).
- Reuse existing design tokens from `tokens.css` (colors, `--ease-out-expo`, `--dur`/`--dur-fast`/`--dur-slow`) — no new ad hoc values.
- Reuse existing components where they already exist: `.btn`/`.btn--gold`/`.btn--navy`/`.btn__roll`, `.logo-lockup`, `.stub`, `.num`, `.script`, theme classes (`theme-cream` etc.).
- Every animation must have a `prefers-reduced-motion: reduce` fallback (existing site-wide convention — see `main.css`'s reduced-motion block).
- `index.html`'s existing hero/scroll/intro system is not modified beyond the three `href` changes in Task 3.
- Password minimum length: 8 characters (matches the backend's rule — frontend check is a UX nicety, not the source of truth).
- Forgot-password has no real backend — its submit handler always shows the same "check your email" confirmation after a simulated delay, regardless of whether the email exists (mirrors the real backend's no-enumeration posture, see Task 8).

---

### Task 1: Shared config and cross-page transition helper

**Files:**
- Create: `landing/assets/js/config.js`
- Create: `landing/assets/js/transitions.js`

**Interfaces:**
- Produces: `API_BASE_URL` (string constant, exported from `config.js`) — consumed by `auth.js` (Task 6).
- `transitions.js` has no exports; it self-executes on load, wiring up `[data-transition-link]` anchors. Consumed by every auth page via a `<script type="module" src="assets/js/transitions.js">` tag.

- [ ] **Step 1: Create `landing/assets/js/config.js`**

```js
// Single place to point the auth pages at the backend. Update
// API_BASE_URL once the backend is deployed — see
// docs/superpowers/plans/2026-07-11-feastnow-backend-auth-service.md, Task 14.
export const API_BASE_URL = "http://localhost:3000";
```

- [ ] **Step 2: Create `landing/assets/js/transitions.js`**

```js
// Cross-page motion for the auth flow. Modern (Chromium) browsers get a
// native cross-document View Transition via the `@view-transition` rule in
// auth.css — no JS needed for those. Everywhere else, outbound links get a
// short fade-out before navigating so it never reads as a hard cut.
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const supportsViewTransitions =
  "startViewTransition" in document || CSS.supports("(view-transition-name: none)");

function initFadeFallback() {
  if (prefersReducedMotion || supportsViewTransitions) return;
  document.querySelectorAll("[data-transition-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || link.target === "_blank" || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      document.body.classList.add("page-fade-out");
      setTimeout(() => { window.location.href = href; }, 180);
    });
  });
}

initFadeFallback();
```

- [ ] **Step 3: Verify both files have no syntax errors**

Run: `node --check landing/assets/js/config.js && node --check landing/assets/js/transitions.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add landing/assets/js/config.js landing/assets/js/transitions.js
git commit -m "feat(landing): add shared API config and cross-page transition helper"
```

---

### Task 2: `auth.css` scaffold

**Files:**
- Create: `landing/assets/css/auth.css`

**Interfaces:**
- Produces: `.authpage` (full-viewport centered shell), `.authpage__home` (top-left logo link), `[data-entrance]` (generic pop-up entrance animation), `body.page-fade-out` (outbound fade, paired with `transitions.js`) — consumed by every page in Tasks 4, 6, 7, 8, 9.

- [ ] **Step 1: Create `landing/assets/css/auth.css`**

```css
/* FeastNow auth flow — shared styles for role-select, login, signup,
   forgot-password, welcome, and the coming-soon stub. Consumes tokens.css
   and reuses main.css's .btn/.logo-lockup/.num/.script/.stub primitives. */

@view-transition { navigation: auto; }

/* ---- outbound fade fallback (browsers without View Transitions) ---- */
body.page-fade-out { animation: pageFadeOut var(--dur) var(--ease-out-quart) forwards; }
@keyframes pageFadeOut { to { opacity: 0; } }

/* ---- shared full-viewport centered shell ---- */
.authpage {
  position: relative;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: var(--gutter);
  background: var(--cream);
}
.authpage__home {
  position: absolute; top: var(--s-lg); left: var(--gutter);
  z-index: 2;
}

/* ---- generic pop-up entrance for a centered card ---- */
@keyframes authPop {
  from { opacity: 0; scale: .92; }
  to   { opacity: 1; scale: 1; }
}
[data-entrance] { animation: authPop var(--dur-slow) var(--ease-out-expo) both; }

@media (prefers-reduced-motion: reduce) {
  body.page-fade-out { animation: none; }
  [data-entrance] { animation: none; }
}
```

- [ ] **Step 2: Verify the file is well-formed**

Count braces to confirm every rule is closed:

Run: `node -e "const fs=require('fs'); const css=fs.readFileSync('landing/assets/css/auth.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if (open!==close) { console.error('brace mismatch: '+open+' open vs '+close+' close'); process.exit(1); }"`
Expected: no output, exit code 0. (A real CSS parser check happens visually in Task 4's manual check, once a page actually loads this stylesheet.)

- [ ] **Step 3: Commit**

```bash
git add landing/assets/css/auth.css
git commit -m "feat(landing): scaffold auth.css shared shell and entrance animation"
```

---

### Task 3: `index.html` routing updates

**Files:**
- Modify: `landing/index.html` (6 "Get Started" links at lines 77, 88, 306, 311, 636, 648; 1 "List your restaurant" link at line 482; 1 "Start riding" link at line 616 — line numbers as of this plan's writing; none of these edits change the file's total line count, so line numbers stay stable across this task's steps)

**Interfaces:** none — this task only changes `href` attributes and adds `data-transition-link` markers; no scripts or styles change.

- [ ] **Step 1: Update the 6 "Get Started" links to point to `role-select.html`**

In `landing/index.html`, apply these 6 exact replacements (lines 88 and 636 currently have identical content — use `git diff` after this step to confirm exactly 6 lines changed, since a text-search-and-replace could otherwise miss one or double up):

Line 77 — from:
```html
        <a class="btn btn--gold btn--ticket" href="login.html"><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```
to:
```html
        <a class="btn btn--gold btn--ticket" href="role-select.html" data-transition-link><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```

Line 88 — from:
```html
      <a class="btn btn--gold" href="login.html"><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```
to:
```html
      <a class="btn btn--gold" href="role-select.html" data-transition-link><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```

Line 306 — from:
```html
            <a class="btn btn--gold hero__card-btn" href="login.html">Get Started</a>
```
to:
```html
            <a class="btn btn--gold hero__card-btn" href="role-select.html" data-transition-link>Get Started</a>
```

Line 311 — from:
```html
        <a class="btn btn--gold btn--lg" href="login.html"><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```
to:
```html
        <a class="btn btn--gold btn--lg" href="role-select.html" data-transition-link><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
```

Line 636 — same original content as line 88 above; change it the same way (`href="login.html"` → `href="role-select.html" data-transition-link`).

Line 648 — from:
```html
          <a href="login.html">Get Started</a>
```
to:
```html
          <a href="role-select.html" data-transition-link>Get Started</a>
```

- [ ] **Step 2: Update "List your restaurant" (line 482) to point to the restaurant stub**

From:
```html
          <a class="btn btn--navy btn--lg" href="login.html"><span class="btn__roll"><span>List your restaurant</span><span aria-hidden="true">List your restaurant</span></span></a>
```
to:
```html
          <a class="btn btn--navy btn--lg" href="coming-soon.html?for=restaurant" data-transition-link><span class="btn__roll"><span>List your restaurant</span><span aria-hidden="true">List your restaurant</span></span></a>
```

- [ ] **Step 3: Update "Start riding" (line 616) to point to the delivery stub**

From:
```html
          <a class="btn btn--gold btn--lg" href="login.html"><span class="btn__roll"><span>Start riding</span><span aria-hidden="true">Start riding</span></span></a>
```
to:
```html
          <a class="btn btn--gold btn--lg" href="coming-soon.html?for=delivery" data-transition-link><span class="btn__roll"><span>Start riding</span><span aria-hidden="true">Start riding</span></span></a>
```

- [ ] **Step 4: Verify no other links still point at the old destinations**

Run: `grep -n "login.html" landing/index.html`
Expected: no output (every prior reference has been repointed).

- [ ] **Step 5: Commit**

```bash
git add landing/index.html
git commit -m "feat(landing): route Get Started to role-select, restaurant/rider CTAs to coming-soon stub"
```

---

### Task 4: `role-select.html`

**Files:**
- Create: `landing/role-select.html`
- Modify: `landing/assets/css/auth.css` (append role-select styles)

**Interfaces:**
- Consumes: `.authpage`, `.authpage__home`, `[data-entrance]` (Task 2); `transitions.js` (Task 1).
- Produces: nothing consumed by later tasks (a leaf page).

- [ ] **Step 1: Append role-select styles to `landing/assets/css/auth.css`**

```css
/* ---- role-select ---- */
.roleselect__card {
  width: min(560px, 100%);
  background: var(--off-white);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-overlay);
  padding: clamp(1.75rem, 5vw, 3rem);
  text-align: center;
}
.roleselect__title { font-size: clamp(1.5rem, 4vw, 2.25rem); margin-bottom: .5rem; }
.roleselect__sub { color: var(--brown); margin-bottom: 2rem; }

.roleselect__tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-md);
}
@media (max-width: 560px) {
  .roleselect__tiles { grid-template-columns: 1fr; }
}

.roleselect__tile {
  display: grid; justify-items: center; gap: .5rem;
  padding: 1.75rem 1rem;
  border-radius: var(--r-md);
  background: var(--dough);
  color: var(--navy);
  text-decoration: none;
  transition: translate var(--dur) var(--ease-out-quart),
              rotate var(--dur) var(--ease-out-quart),
              box-shadow var(--dur) var(--ease-out-quart),
              background var(--dur);
}
.roleselect__tile-icon { width: 40px; height: 40px; }
.roleselect__tile-icon svg { width: 100%; height: 100%; }
.roleselect__tile-label { font-weight: 700; font-size: 1.05rem; }
.roleselect__tile-sub { font-size: .82rem; color: var(--brown); }

.roleselect__tile--customer:hover {
  translate: 0 -6px; rotate: -1deg;
  box-shadow: var(--sh-raised), 0 0 0 3px var(--gold);
  background: var(--cream);
}
.roleselect__tile--restaurant:hover {
  translate: 0 -6px; rotate: 1deg;
  box-shadow: var(--sh-raised), 0 0 0 3px var(--navy);
  background: var(--cream);
}

@media (prefers-reduced-motion: reduce) {
  .roleselect__tile:hover { translate: none; rotate: none; }
}
```

- [ ] **Step 2: Create `landing/role-select.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Are you a Restaurant or a Customer?</title>
  <meta name="description" content="Choose how you'd like to use FeastNow.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body class="theme-cream">
  <main class="authpage">
    <a class="authpage__home logo-lockup" href="index.html" data-transition-link>
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
        <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48"
              fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M32 39.8 L32.99 42.64 L35.99 42.70 L33.60 44.52 L34.47 47.40 L32 45.68 L29.53 47.40 L30.40 44.52 L28.01 42.70 L31.01 42.64 Z"
              fill="var(--gold)"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </a>

    <div class="roleselect__card" data-entrance>
      <h1 class="roleselect__title">Are you a Restaurant or a Customer?</h1>
      <p class="roleselect__sub">Pick how you'd like to use FeastNow.</p>

      <div class="roleselect__tiles">
        <a class="roleselect__tile roleselect__tile--customer" href="login.html" data-transition-link>
          <span class="roleselect__tile-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64"><circle cx="36" cy="32" r="16" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 14 V30 M10 14 V22 Q10 26 14 26 Q18 26 18 22 V14 M14 26 V50" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="roleselect__tile-label">I am a Customer</span>
          <span class="roleselect__tile-sub">Browse, order, track delivery</span>
        </a>
        <a class="roleselect__tile roleselect__tile--restaurant" href="coming-soon.html?for=restaurant" data-transition-link>
          <span class="roleselect__tile-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64"><path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>
          </span>
          <span class="roleselect__tile-label">Are you a Restaurant?</span>
          <span class="roleselect__tile-sub">List your kitchen on FeastNow</span>
        </a>
      </div>
    </div>
  </main>

  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verify the file has no syntax errors**

Run: `node --check landing/assets/js/transitions.js`
Expected: no output, exit code 0 (already verified in Task 1; re-running here confirms nothing broke it).

- [ ] **Step 4: Manual check**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/role-select.html`. Confirm: the card pops in on load (scale+fade, no hard cut), each tile lifts with a distinct hover glow (gold tint on Customer, navy tint on Restaurant), "I am a Customer" links to `login.html` (404 is expected until Task 6), "Are you a Restaurant?" links to `coming-soon.html?for=restaurant` (404 is expected until Task 5). Stop the server with `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add landing/role-select.html landing/assets/css/auth.css
git commit -m "feat(landing): add role-select entry screen"
```

---

### Task 5: `coming-soon.html`

**Files:**
- Create: `landing/coming-soon.html`

**Interfaces:** none — a leaf page, reuses `.stub`/`.logo-lockup--lg`/`.logo-lockup--stack` from `main.css` directly (no new CSS needed).

- [ ] **Step 1: Create `landing/coming-soon.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Coming soon</title>
  <meta name="description" content="This part of FeastNow is coming soon.">
  <meta name="robots" content="noindex">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body>
  <main class="stub">
    <div class="logo-lockup logo-lockup--lg logo-lockup--stack">
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
        <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48"
              fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M32 39.8 L32.99 42.64 L35.99 42.70 L33.60 44.52 L34.47 47.40 L32 45.68 L29.53 47.40 L30.40 44.52 L28.01 42.70 L31.01 42.64 Z"
              fill="var(--gold)"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </div>
    <p class="stub__msg" id="stub-message">Loading&hellip;</p>
    <a class="btn btn--navy" href="index.html" data-transition-link><span class="btn__roll"><span>&#8592; Back to home</span><span aria-hidden="true">&#8592; Back to home</span></span></a>
  </main>

  <script>
    var params = new URLSearchParams(window.location.search);
    var target = params.get("for") === "delivery" ? "delivery" : "restaurant";
    var messages = {
      restaurant: "Restaurant sign-up is coming soon — we're still setting the table.",
      delivery: "Rider sign-up is coming soon — we're still setting the table.",
    };
    document.getElementById("stub-message").textContent = messages[target];
    document.title = target === "delivery"
      ? "FeastNow — Rider sign-up coming soon"
      : "FeastNow — Restaurant sign-up coming soon";
  </script>
  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 2: Manual check**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/coming-soon.html?for=restaurant` and confirm it reads "Restaurant sign-up is coming soon…"; open `http://localhost:5500/coming-soon.html?for=delivery` and confirm it reads "Rider sign-up is coming soon…". Stop the server.

- [ ] **Step 3: Commit**

```bash
git add landing/coming-soon.html
git commit -m "feat(landing): add shared coming-soon stub for restaurant/delivery CTAs"
```

---

### Task 6: Shared auth helpers, extracted cart art, and `login.html`

**Files:**
- Create: `landing/assets/svg/cart.svg` (extracted from `landing/index.html:125-270`, self-contained)
- Create: `landing/assets/js/auth.js`
- Create: `landing/login.html`
- Create: `landing/assets/js/login.js`
- Modify: `landing/assets/css/auth.css` (append split-screen + field styles)

**Interfaces:**
- Consumes: `API_BASE_URL` (Task 1).
- Produces (from `auth.js`, consumed by Tasks 7, 8, 9): `isValidEmail(value)`, `isValidPhone(value)`, `isValidPassword(value)`, `saveToken(token)`, `getToken()`, `clearToken()`, `apiPost(path, body)` → `Promise<{ok, status, data}>`, `apiGet(path, token)` → `Promise<{ok, status, data}>`, `showFieldError(inputEl, message)`, `clearFieldError(inputEl)`.
- Produces: `.authsplit`/`.authsplit__form`/`.authsplit__art`/`.field` classes in `auth.css`, reused unchanged by `signup.html` (Task 7).

`landing/index.html` is **not modified** by this task — the cart illustration there stays exactly as it is (zero regression risk to the shipped hero). `cart.svg` is a one-time copy of that same markup into a new standalone file so `login.html`/`signup.html` can load it via `fetch()`; the CSS classes it uses (`.cart__bulb`, `.cart__steam`, `.cart__cloth`, `.cart__garlic`, `.cart__cat`) are already styled with idle CSS-only animations in `main.css` (twinkle/steam/sway/blink) — those play automatically wherever the SVG is embedded. Wheel-spin and mouse-parallax are exclusively driven by `scroll.js`'s hero-specific selectors (`.hero__stage .cart`), which these pages don't load, so the art panel is idle-only by construction — no extra "reduced intensity" code needed.

- [ ] **Step 1: Create `landing/assets/svg/cart.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" class="cart" viewBox="0 0 680 470" role="img" aria-label="Illustration of the FeastNow food cart">
  <defs>
    <pattern id="checker" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="#FFFCF0"/>
      <rect width="7" height="7" fill="#33507E"/>
      <rect x="7" y="7" width="7" height="7" fill="#33507E"/>
    </pattern>
    <symbol id="feastnow-hat" viewBox="0 0 64 64">
      <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
            fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z"
            fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48"
            fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M32 39.8 L32.99 42.64 L35.99 42.70 L33.60 44.52 L34.47 47.40 L32 45.68 L29.53 47.40 L30.40 44.52 L28.01 42.70 L31.01 42.64 Z"
            fill="var(--gold)"/>
    </symbol>
  </defs>
  <ellipse cx="345" cy="442" rx="280" ry="20" fill="rgba(15,44,86,.12)"/>
  <ellipse cx="345" cy="442" rx="400" ry="12" fill="rgba(15,44,86,.06)"/>
  <path d="M118 268 Q76 250 64 214" fill="none" stroke="#4F3C2C" stroke-width="9" stroke-linecap="round"/>
  <circle cx="64" cy="214" r="9" fill="#4F3C2C"/>
  <line x1="152" y1="112" x2="152" y2="240" stroke="#4F3C2C" stroke-width="7"/>
  <line x1="528" y1="112" x2="528" y2="240" stroke="#4F3C2C" stroke-width="7"/>
  <line x1="340" y1="128" x2="340" y2="248" stroke="#D9A82E" stroke-width="6"/>
  <g class="cart__sign">
    <rect x="206" y="26" width="268" height="48" rx="12" fill="#ECE6E1" stroke="#0F2C56" stroke-width="3"/>
    <svg x="222" y="36" width="28" height="28" viewBox="0 0 64 64" style="color:#0F2C56"><use href="#feastnow-hat"></use></svg>
    <text x="352" y="60" text-anchor="middle" font-size="28" fill="#0F2C56" font-weight="640" style="font-family:var(--font-display)">FeastNow</text>
  </g>
  <line x1="536" y1="58" x2="536" y2="112" stroke="#4F3C2C" stroke-width="5" stroke-linecap="round"/>
  <path d="M536 58 L584 68 L536 82 Z" fill="#128643"/>
  <clipPath id="awn">
    <path d="M108 88 h464 v26
      a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0
      a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0 a29 16 0 0 1 -58 0 Z"/>
  </clipPath>
  <g clip-path="url(#awn)">
    <rect x="108" y="86" width="464" height="52" fill="#ECE6E1"/>
    <rect x="108" y="86" width="58" height="52" fill="#0F2C56"/>
    <rect x="224" y="86" width="58" height="52" fill="#0F2C56"/>
    <rect x="340" y="86" width="58" height="52" fill="#0F2C56"/>
    <rect x="456" y="86" width="58" height="52" fill="#0F2C56"/>
  </g>
  <path d="M152 138 Q340 176 528 138" fill="none" stroke="#4F3C2C" stroke-width="2.5"/>
  <circle class="cart__bulb" cx="230" cy="152" r="5" fill="#E3AF04"/>
  <circle class="cart__bulb" cx="303" cy="161" r="5" fill="#E3AF04"/>
  <circle class="cart__bulb" cx="377" cy="161" r="5" fill="#E3AF04"/>
  <circle class="cart__bulb" cx="450" cy="152" r="5" fill="#E3AF04"/>
  <g class="cart__placard">
    <rect x="279" y="132" width="122" height="27" rx="7" fill="#0F2C56" stroke="#E3AF04" stroke-width="2"/>
    <text x="340" y="150.5" text-anchor="middle" font-size="13" font-weight="700" fill="#E3AF04" letter-spacing="2.5" style="font-family:var(--font-sans)">ORDER HERE</text>
  </g>
  <g class="cart__cloth">
    <path d="M504 150 q24 -12 48 0 l8 62 q-32 16 -64 0 Z" fill="url(#checker)" stroke="#0F2C56" stroke-width="2" stroke-opacity=".3"/>
  </g>
  <g class="cart__garlic">
    <path d="M282 114 q2 8 0 16 q-2 8 0 16" fill="none" stroke="#4F3C2C" stroke-width="1.5"/>
    <g stroke="#4F3C2C" stroke-width="1">
      <ellipse cx="274" cy="132" rx="6" ry="9" fill="#F2EDE9"/>
      <ellipse cx="282" cy="136" rx="6" ry="9" fill="#F2EDE9"/>
      <ellipse cx="290" cy="132" rx="6" ry="9" fill="#F2EDE9"/>
      <ellipse cx="278" cy="148" rx="5" ry="8" fill="#F2EDE9"/>
      <ellipse cx="286" cy="146" rx="5" ry="8" fill="#F2EDE9"/>
      <ellipse cx="282" cy="158" rx="5" ry="7" fill="#F2EDE9"/>
    </g>
    <g fill="none" stroke="#4F3C2C" stroke-width=".8">
      <path d="M270 130 q-3 -4 -1 -8"/>
      <path d="M294 130 q3 -4 1 -8"/>
    </g>
  </g>
  <g class="cart__steam" fill="none" stroke="#D4C29A" stroke-width="5" stroke-linecap="round">
    <path d="M232 158 q-8 -14 0 -26 q8 -12 0 -24"/>
    <path d="M262 166 q-8 -14 0 -26 q8 -12 0 -24"/>
  </g>
  <rect x="158" y="168" width="212" height="76" rx="10" fill="#C0DEEE" opacity=".5" stroke="#ECE6E1" stroke-width="4"/>
  <g>
    <path d="M228 192 l4 -24 l8 0 l4 24 Z" fill="#2F241A"/>
    <rect x="232" y="170" width="8" height="14" rx="3" fill="#128643"/>
    <rect x="233" y="170" width="6" height="6" rx="2" fill="#FFFCF0" opacity=".6"/>
    <text x="236" y="196" font-size="6" fill="#FFFCF0" text-anchor="middle" font-weight="700" style="font-family:var(--font-sans)">vino</text>
    <ellipse cx="196" cy="208" rx="14" ry="10" fill="#ECE6E1" stroke="#4F3C2C" stroke-width="1.5"/>
    <circle cx="196" cy="207" r="5" fill="#C72531"/>
    <ellipse cx="310" cy="208" rx="14" ry="10" fill="#ECE6E1" stroke="#4F3C2C" stroke-width="1.5"/>
    <circle cx="310" cy="207" r="5" fill="#128643"/>
    <path d="M198 232 a26 22 0 0 1 52 0 Z" fill="#E3AF04"/>
    <rect x="190" y="230" width="68" height="7" rx="3.5" fill="#ECE6E1"/>
    <path d="M282 232 a26 22 0 0 1 52 0 Z" fill="#E3AF04"/>
    <rect x="274" y="230" width="68" height="7" rx="3.5" fill="#ECE6E1"/>
  </g>
  <g>
    <rect x="398" y="164" width="118" height="80" rx="9" fill="#2F241A" stroke="#ECE6E1" stroke-width="3"/>
    <text x="457" y="192" text-anchor="middle" font-size="20" fill="#ECE6E1" style="font-family:var(--font-script)">menu</text>
    <line x1="414" y1="208" x2="500" y2="208" stroke="#ECE6E1" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
    <line x1="414" y1="222" x2="482" y2="222" stroke="#ECE6E1" stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
  </g>
  <rect x="120" y="248" width="440" height="126" rx="16" fill="#0F2C56"/>
  <rect x="102" y="248" width="476" height="16" rx="8" fill="#ECE6E1"/>
  <text x="340" y="322" text-anchor="middle" font-size="30" fill="#FFFCF0" style="font-family:var(--font-script)">fresh &amp; fast</text>
  <g>
    <rect x="506" y="288" width="12" height="20" rx="2" fill="#128643"/>
    <rect x="518" y="288" width="12" height="20" rx="2" fill="#FFFCF0"/>
    <rect x="530" y="288" width="12" height="20" rx="2" fill="#C72531"/>
  </g>
  <path d="M154 374 a52 52 0 0 1 104 0 Z" fill="#1B2F5E"/>
  <path d="M434 374 a52 52 0 0 1 104 0 Z" fill="#1B2F5E"/>
  <g class="cart__wheel">
    <circle cx="206" cy="396" r="44" fill="#2F241A"/>
    <circle cx="206" cy="396" r="29" fill="#E3AF04"/>
    <g stroke="#FFFCF0" stroke-width="5" stroke-linecap="round">
      <line x1="206" y1="372" x2="206" y2="420"/>
      <line x1="182" y1="396" x2="230" y2="396"/>
    </g>
    <circle cx="206" cy="396" r="8" fill="#0F2C56"/>
  </g>
  <g class="cart__wheel">
    <circle cx="486" cy="396" r="44" fill="#2F241A"/>
    <circle cx="486" cy="396" r="29" fill="#E3AF04"/>
    <g stroke="#FFFCF0" stroke-width="5" stroke-linecap="round">
      <line x1="486" y1="372" x2="486" y2="420"/>
      <line x1="462" y1="396" x2="510" y2="396"/>
    </g>
    <circle cx="486" cy="396" r="8" fill="#0F2C56"/>
  </g>
  <g class="cart__cat">
    <ellipse cx="340" cy="434" rx="20" ry="10" fill="#2F241A"/>
    <circle cx="354" cy="427" r="8" fill="#2F241A"/>
    <path d="M360 422 l3 -5 M360 425.5 l4 -3.5" fill="none" stroke="#2F241A" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="356" cy="425" rx="2.5" ry="2" fill="#E3AF04"/>
    <circle cx="356" cy="426.5" r="1" fill="#0F2C56"/>
    <path d="M322 434 q-14 0 -20 -6" fill="none" stroke="#2F241A" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>
```

- [ ] **Step 2: Create `landing/assets/js/auth.js`**

```js
import { API_BASE_URL } from "./config.js";

const TOKEN_KEY = "feastnow_token";

export function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value) {
  return typeof value === "string" && /^\+?\d{7,15}$/.test(value.replace(/[\s-]/g, ""));
}

export function isValidPassword(value) {
  return typeof value === "string" && value.length >= 8;
}

export function saveToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function apiGet(path, token) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function showFieldError(inputEl, message) {
  const field = inputEl.closest(".field");
  if (!field) return;
  field.classList.add("field--error");
  const errorEl = field.querySelector(".field__error");
  if (errorEl) errorEl.textContent = message;
}

export function clearFieldError(inputEl) {
  const field = inputEl.closest(".field");
  if (!field) return;
  field.classList.remove("field--error");
  const errorEl = field.querySelector(".field__error");
  if (errorEl) errorEl.textContent = "";
}
```

- [ ] **Step 3: Append split-screen and field styles to `landing/assets/css/auth.css`**

```css
/* ---- split-screen: envelope form (left) + cart art (right) ---- */
.authsplit {
  display: grid;
  grid-template-columns: minmax(320px, 480px) minmax(280px, 420px);
  gap: var(--s-xl);
  align-items: center;
  width: min(1000px, 100%);
}
@media (max-width: 860px) {
  .authsplit { grid-template-columns: 1fr; gap: var(--s-lg); }
  .authsplit__art { order: -1; max-width: 220px; margin-inline: auto; }
}

.authsplit__form {
  position: relative;
  background: var(--cream);
  border-radius: var(--r-lg);
  padding: clamp(1.75rem, 4vw, 2.75rem) clamp(1.5rem, 4vw, 2.25rem) 2.25rem;
  box-shadow: var(--sh-overlay), inset 0 0 0 1px rgba(15,44,86,.06);
  animation: authFormIn var(--dur-slow) var(--ease-out-expo) both;
}
.authsplit__flap {
  position: absolute; top: 0; left: 0; right: 0; height: 12px;
  background: var(--navy);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
}
.authsplit__seal {
  position: absolute; top: -14px; left: 50%; translate: -50% 0;
  width: 40px; height: 40px;
  display: grid; place-items: center;
  background: var(--gold); color: var(--navy);
  border-radius: 50%;
  font-size: .7rem; font-weight: 700; letter-spacing: .04em;
  box-shadow: 0 2px 6px rgba(15,44,86,.18);
}
.authsplit__title { margin-top: 1rem; font-size: clamp(1.35rem, 3vw, 1.75rem); text-align: center; }
.authsplit__sub { color: var(--brown); text-align: center; margin-bottom: 1.5rem; font-size: .92rem; }
.authsplit__submit { width: 100%; margin-top: .5rem; }
.authsplit__links { display: flex; justify-content: space-between; margin-top: 1.25rem; font-size: .88rem; }
.authsplit__links a { color: var(--navy); font-weight: 600; }

.authsplit__art {
  display: grid; place-items: center;
  animation: authArtIn var(--dur-slow) var(--ease-out-expo) both;
}
.authsplit__art svg { width: 100%; height: auto; max-width: 340px; }

@keyframes authFormIn {
  from { opacity: 0; translate: -24px 0; rotate: -3deg; }
  to   { opacity: 1; translate: 0 0; rotate: 0deg; }
}
@keyframes authArtIn {
  from { opacity: 0; translate: 24px 0; rotate: 2deg; }
  to   { opacity: 1; translate: 0 0; rotate: 0deg; }
}

/* ---- form fields (shared by login, signup, forgot-password) ---- */
.field { margin-bottom: 1.1rem; text-align: left; }
.field__label {
  display: block; font-size: .8125rem; font-weight: 600;
  letter-spacing: .04em; text-transform: uppercase; color: var(--navy);
  margin-bottom: .35rem;
}
.field__input {
  width: 100%; min-height: 48px; padding: 0 1rem;
  border-radius: var(--r-sm); border: 2px solid transparent;
  background: var(--dough); color: var(--navy);
  font-family: var(--font-sans); font-size: 1rem;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.field__input:focus-visible {
  outline: none; border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold);
}
.field__error {
  display: block; min-height: 1.1em; margin-top: .35rem;
  font-size: .8rem; color: var(--tomato);
}
.field--error .field__input {
  border-color: var(--tomato);
  animation: fieldShake var(--dur) var(--ease-out-quart);
}
@keyframes fieldShake {
  25% { translate: -4px 0; }
  75% { translate: 4px 0; }
}

@media (prefers-reduced-motion: reduce) {
  .authsplit__form, .authsplit__art { animation: none; }
  .field--error .field__input { animation: none; }
}
```

- [ ] **Step 4: Create `landing/login.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Customer Login</title>
  <meta name="description" content="Log in to your FeastNow customer account.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body class="theme-cream">
  <main class="authpage">
    <a class="authpage__home logo-lockup" href="index.html" data-transition-link>
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </a>

    <div class="authsplit">
      <div class="authsplit__form">
        <span class="authsplit__flap" aria-hidden="true"></span>
        <span class="authsplit__seal num" aria-hidden="true">FN</span>
        <h1 class="authsplit__title">Welcome back</h1>
        <p class="authsplit__sub">Log in to order from your favorite kitchens.</p>

        <form id="login-form" novalidate>
          <div class="field">
            <label class="field__label" for="login-identifier">Email or phone</label>
            <input class="field__input" type="text" id="login-identifier" name="identifier" autocomplete="username" required>
            <span class="field__error" role="alert"></span>
          </div>
          <div class="field">
            <label class="field__label" for="login-password">Password</label>
            <input class="field__input" type="password" id="login-password" name="password" autocomplete="current-password" required>
            <span class="field__error" role="alert"></span>
          </div>

          <button class="btn btn--gold authsplit__submit" type="submit">
            <span class="btn__roll"><span>Log in</span><span aria-hidden="true">Log in</span></span>
          </button>
        </form>

        <div class="authsplit__links">
          <a href="signup.html" data-transition-link>New Sign Up</a>
          <a href="forgot-password.html" data-transition-link>Forgot Password</a>
        </div>
      </div>

      <div class="authsplit__art" aria-hidden="true" data-cart-mount></div>
    </div>
  </main>

  <script>
    fetch("assets/svg/cart.svg").then((r) => r.text()).then((svg) => {
      document.querySelector("[data-cart-mount]").innerHTML = svg;
    });
  </script>
  <script type="module" src="assets/js/login.js"></script>
  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `landing/assets/js/login.js`**

```js
import { isValidEmail, isValidPhone, isValidPassword, saveToken, apiPost, showFieldError, clearFieldError } from "./auth.js";

const form = document.getElementById("login-form");
const identifierInput = document.getElementById("login-identifier");
const passwordInput = document.getElementById("login-password");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldError(identifierInput);
  clearFieldError(passwordInput);

  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;

  let hasError = false;
  if (!identifier || (!isValidEmail(identifier) && !isValidPhone(identifier))) {
    showFieldError(identifierInput, "Enter a valid email or phone number.");
    hasError = true;
  }
  if (!isValidPassword(password)) {
    showFieldError(passwordInput, "Password must be at least 8 characters.");
    hasError = true;
  }
  if (hasError) return;

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await apiPost("/api/auth/login", { identifier, password });
  submitBtn.disabled = false;

  if (!ok) {
    showFieldError(passwordInput, data.error || "Incorrect email/phone or password.");
    return;
  }

  saveToken(data.token);
  window.location.href = "welcome.html";
});
```

- [ ] **Step 6: Verify JS syntax**

Run: `node --check landing/assets/js/auth.js && node --check landing/assets/js/login.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Manual check (UI/validation only — full login success requires the backend running, see Task 10)**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/login.html`. Confirm: the envelope panel and cart art both animate in on load (translate+rotate, not a fade-only), the cart's bulbs/steam/cloth/garlic/cat show idle motion with no wheel-spin, submitting with an empty/invalid identifier or a short password shows an inline tomato error with a shake, "New Sign Up" links to `signup.html` (404 expected until Task 7), "Forgot Password" links to `forgot-password.html` (404 expected until Task 8). Below ~860px width, the layout stacks (form on top, art shrinks). Stop the server.

- [ ] **Step 8: Commit**

```bash
git add landing/assets/svg/cart.svg landing/assets/js/auth.js landing/assets/css/auth.css landing/login.html landing/assets/js/login.js
git commit -m "feat(landing): add auth.js helpers, extracted cart art, and real login page"
```

---

### Task 7: `signup.html` with in-place OTP step

**Files:**
- Create: `landing/signup.html`
- Create: `landing/assets/js/signup.js`
- Modify: `landing/assets/css/auth.css` (append OTP box + seal-stamp styles)

**Interfaces:**
- Consumes: everything from `auth.js` (Task 6), `.authsplit`/`.field` classes (Task 6).
- Produces: nothing consumed by later tasks (a leaf page).

- [ ] **Step 1: Append OTP and seal-stamp styles to `landing/assets/css/auth.css`**

```css
/* ---- OTP step (signup) ---- */
.otp-boxes { display: flex; gap: .5rem; justify-content: center; margin: .5rem 0 .75rem; }
.otp-boxes__input {
  width: 44px; height: 52px; text-align: center;
  font-size: 1.3rem; border-radius: var(--r-sm); border: 2px solid transparent;
  background: var(--dough); color: var(--navy);
}
.otp-boxes__input:focus-visible { outline: none; border-color: var(--gold); box-shadow: 0 0 0 2px var(--gold); }
.otp-boxes--shake { animation: fieldShake var(--dur) var(--ease-out-quart); }
.otp-error { display: block; min-height: 1.1em; text-align: center; margin-bottom: .75rem; font-size: .85rem; color: var(--tomato); }
.otp-resend { text-align: center; font-size: .88rem; color: var(--brown); }
.otp-resend button { background: none; border: none; color: var(--navy); font-weight: 700; cursor: pointer; padding: 0; font-family: inherit; font-size: inherit; }
.otp-resend button:disabled { color: var(--beige); cursor: default; }

.authsplit__form--sealed .authsplit__seal { animation: sealStamp .5s var(--ease-out-expo); }
@keyframes sealStamp {
  0%   { scale: 1.6; opacity: .4; }
  60%  { scale: .9; opacity: 1; }
  100% { scale: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .otp-boxes--shake { animation: none; }
  .authsplit__form--sealed .authsplit__seal { animation: none; }
}
```

- [ ] **Step 2: Create `landing/signup.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Sign Up</title>
  <meta name="description" content="Create a FeastNow customer account.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body class="theme-cream">
  <main class="authpage">
    <a class="authpage__home logo-lockup" href="index.html" data-transition-link>
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </a>

    <div class="authsplit">
      <div class="authsplit__form">
        <span class="authsplit__flap" aria-hidden="true"></span>
        <span class="authsplit__seal num" aria-hidden="true">FN</span>

        <form id="signup-form" novalidate>
          <h1 class="authsplit__title">Join FeastNow</h1>
          <p class="authsplit__sub">Create your customer account.</p>

          <div class="field">
            <label class="field__label" for="signup-name">Name</label>
            <input class="field__input" type="text" id="signup-name" name="name" autocomplete="name" required>
            <span class="field__error" role="alert"></span>
          </div>
          <div class="field">
            <label class="field__label" for="signup-email">Email</label>
            <input class="field__input" type="email" id="signup-email" name="email" autocomplete="email" required>
            <span class="field__error" role="alert"></span>
          </div>
          <div class="field">
            <label class="field__label" for="signup-phone">Phone</label>
            <input class="field__input" type="tel" id="signup-phone" name="phone" autocomplete="tel" required>
            <span class="field__error" role="alert"></span>
          </div>
          <div class="field">
            <label class="field__label" for="signup-password">Password</label>
            <input class="field__input" type="password" id="signup-password" name="password" autocomplete="new-password" required>
            <span class="field__error" role="alert"></span>
          </div>

          <button class="btn btn--gold authsplit__submit" type="submit">
            <span class="btn__roll"><span>Send verification code</span><span aria-hidden="true">Send verification code</span></span>
          </button>
        </form>

        <form id="otp-form" novalidate hidden>
          <h1 class="authsplit__title">Check your email</h1>
          <p class="authsplit__sub">Enter the 6-digit code we just sent you.</p>

          <div class="otp-boxes" role="group" aria-label="Verification code">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 1">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 2">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 3">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 4">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 5">
            <input class="otp-boxes__input num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Digit 6">
          </div>
          <span class="otp-error" id="otp-error" role="alert"></span>

          <button class="btn btn--gold authsplit__submit" type="submit">
            <span class="btn__roll"><span>Verify &amp; create account</span><span aria-hidden="true">Verify &amp; create account</span></span>
          </button>

          <p class="otp-resend">
            Didn't get it?
            <button type="button" id="otp-resend" disabled>Resend code</button>
            <span class="num" id="otp-resend-countdown"></span>
          </p>
        </form>

        <div class="authsplit__links">
          <a href="login.html" data-transition-link>Already have an account?</a>
        </div>
      </div>

      <div class="authsplit__art" aria-hidden="true" data-cart-mount></div>
    </div>
  </main>

  <script>
    fetch("assets/svg/cart.svg").then((r) => r.text()).then((svg) => {
      document.querySelector("[data-cart-mount]").innerHTML = svg;
    });
  </script>
  <script type="module" src="assets/js/signup.js"></script>
  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `landing/assets/js/signup.js`**

```js
import {
  isValidEmail, isValidPhone, isValidPassword,
  saveToken, apiPost, showFieldError, clearFieldError,
} from "./auth.js";

const signupForm = document.getElementById("signup-form");
const otpForm = document.getElementById("otp-form");
const nameInput = document.getElementById("signup-name");
const emailInput = document.getElementById("signup-email");
const phoneInput = document.getElementById("signup-phone");
const passwordInput = document.getElementById("signup-password");
const otpInputs = Array.from(document.querySelectorAll(".otp-boxes__input"));
const otpError = document.getElementById("otp-error");
const otpBoxesEl = document.querySelector(".otp-boxes");
const resendBtn = document.getElementById("otp-resend");
const resendCountdown = document.getElementById("otp-resend-countdown");

let pendingSignup = null;
let resendTimer = null;

function startResendCooldown(seconds) {
  let remaining = seconds;
  resendBtn.disabled = true;
  resendCountdown.textContent = `(${remaining}s)`;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    resendCountdown.textContent = remaining > 0 ? `(${remaining}s)` : "";
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
    }
  }, 1000);
}

otpInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && otpInputs[i - 1]) {
      otpInputs[i - 1].focus();
    }
  });
});

function otpValue() {
  return otpInputs.map((i) => i.value).join("");
}

function requestOtp(email) {
  return apiPost("/api/auth/signup/request-otp", { email });
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  [nameInput, emailInput, phoneInput, passwordInput].forEach(clearFieldError);

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  let hasError = false;
  if (!name) { showFieldError(nameInput, "Enter your name."); hasError = true; }
  if (!isValidEmail(email)) { showFieldError(emailInput, "Enter a valid email."); hasError = true; }
  if (!isValidPhone(phone)) { showFieldError(phoneInput, "Enter a valid phone number."); hasError = true; }
  if (!isValidPassword(password)) { showFieldError(passwordInput, "Password must be at least 8 characters."); hasError = true; }
  if (hasError) return;

  const submitBtn = signupForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await requestOtp(email);
  submitBtn.disabled = false;

  if (!ok) {
    showFieldError(emailInput, data.error || "Could not send a verification code.");
    return;
  }

  pendingSignup = { name, email, phone, password };
  signupForm.hidden = true;
  otpForm.hidden = false;
  otpInputs[0].focus();
  startResendCooldown(60);
});

resendBtn.addEventListener("click", async () => {
  if (!pendingSignup || resendBtn.disabled) return;
  resendBtn.disabled = true;
  await requestOtp(pendingSignup.email);
  startResendCooldown(60);
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  otpError.textContent = "";
  const otp = otpValue();

  if (otp.length !== 6) {
    otpError.textContent = "Enter all 6 digits.";
    return;
  }

  const submitBtn = otpForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await apiPost("/api/auth/signup/verify-otp", { ...pendingSignup, otp });
  submitBtn.disabled = false;

  if (!ok) {
    otpError.textContent = data.error || "Incorrect verification code.";
    otpBoxesEl.classList.add("otp-boxes--shake");
    setTimeout(() => otpBoxesEl.classList.remove("otp-boxes--shake"), 220);
    otpInputs.forEach((i) => { i.value = ""; });
    otpInputs[0].focus();
    return;
  }

  document.querySelector(".authsplit__form").classList.add("authsplit__form--sealed");
  saveToken(data.token);
  setTimeout(() => { window.location.href = "welcome.html"; }, 500);
});
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check landing/assets/js/signup.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual check (UI/validation only — full OTP send/verify requires the backend running, see Task 10)**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/signup.html`. Confirm: invalid field values show inline errors on submit; with the backend not running, submitting valid values shows a network-error state (expected — full flow is Task 10). Manually unhide the OTP form for a UI check by running this in the browser console: `document.getElementById('signup-form').hidden = true; document.getElementById('otp-form').hidden = false;` — confirm the 6 digit boxes auto-advance focus as you type, Backspace on an empty box moves focus back, and the "Resend code" button is disabled with a countdown next to it. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add landing/signup.html landing/assets/js/signup.js landing/assets/css/auth.css
git commit -m "feat(landing): add sign-up page with in-place OTP step"
```

---

### Task 8: `forgot-password.html`

**Files:**
- Create: `landing/forgot-password.html`
- Create: `landing/assets/js/forgot-password.js`
- Modify: `landing/assets/css/auth.css` (append `.fpcard` styles)

**Interfaces:**
- Consumes: `isValidEmail`, `showFieldError`, `clearFieldError` (Task 6); `.authpage`, `[data-entrance]`, `.field` classes.
- Produces: nothing consumed by later tasks (a leaf page).

- [ ] **Step 1: Append forgot-password card styles to `landing/assets/css/auth.css`**

```css
/* ---- forgot-password (centered card, not split-screen) ---- */
.fpcard {
  width: min(420px, 100%);
  background: var(--off-white);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-overlay);
  padding: clamp(1.75rem, 5vw, 2.5rem);
  text-align: center;
}
.fpcard__title { font-size: clamp(1.35rem, 3vw, 1.75rem); margin-bottom: .5rem; }
.fpcard__sub { color: var(--brown); margin-bottom: 1.5rem; font-size: .92rem; }
.fpcard__confirm { color: var(--navy); font-weight: 500; margin-bottom: 1.5rem; }
.fpcard__back { display: inline-block; margin-top: 1.25rem; color: var(--navy); font-weight: 600; font-size: .9rem; }

.fpcard__confirm, .fpcard form {
  animation: authPop var(--dur) var(--ease-out-expo) both;
}

@media (prefers-reduced-motion: reduce) {
  .fpcard__confirm, .fpcard form { animation: none; }
}
```

- [ ] **Step 2: Create `landing/forgot-password.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Forgot Password</title>
  <meta name="description" content="Reset your FeastNow account password.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body class="theme-cream">
  <main class="authpage">
    <a class="authpage__home logo-lockup" href="index.html" data-transition-link>
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </a>

    <div class="fpcard" data-entrance>
      <form id="fp-form" novalidate>
        <h1 class="fpcard__title">Forgot your password?</h1>
        <p class="fpcard__sub">Enter the email on your account and we'll send you a reset link.</p>

        <div class="field">
          <label class="field__label" for="fp-email">Email</label>
          <input class="field__input" type="email" id="fp-email" name="email" autocomplete="email" required>
          <span class="field__error" role="alert"></span>
        </div>

        <button class="btn btn--gold authsplit__submit" type="submit">
          <span class="btn__roll"><span>Send reset link</span><span aria-hidden="true">Send reset link</span></span>
        </button>
      </form>

      <div id="fp-confirmation" hidden>
        <p class="fpcard__confirm">Check your email &mdash; if an account exists for that address, a reset link is on its way.</p>
      </div>

      <a class="fpcard__back" href="login.html" data-transition-link>&#8592; Back to login</a>
    </div>
  </main>

  <script type="module" src="assets/js/forgot-password.js"></script>
  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `landing/assets/js/forgot-password.js`**

```js
import { isValidEmail, showFieldError, clearFieldError } from "./auth.js";

const form = document.getElementById("fp-form");
const confirmation = document.getElementById("fp-confirmation");
const emailInput = document.getElementById("fp-email");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldError(emailInput);

  const email = emailInput.value.trim();
  if (!isValidEmail(email)) {
    showFieldError(emailInput, "Enter a valid email.");
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  // Mocked backend: always shows the same confirmation after a short delay,
  // regardless of whether the email exists — matches the real backend's
  // no-enumeration posture (see the backend plan's login endpoint).
  setTimeout(() => {
    form.hidden = true;
    confirmation.hidden = false;
  }, 600);
});
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check landing/assets/js/forgot-password.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual check**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/forgot-password.html`. Confirm: the card pops in on load; submitting an invalid email shows an inline error; submitting a valid email shows a brief disabled-button state then swaps to the "check your email" confirmation. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add landing/forgot-password.html landing/assets/js/forgot-password.js landing/assets/css/auth.css
git commit -m "feat(landing): add forgot-password page with mocked confirmation flow"
```

---

### Task 9: `welcome.html`

**Files:**
- Create: `landing/welcome.html`
- Create: `landing/assets/js/welcome.js`
- Modify: `landing/assets/css/auth.css` (append `.welcomecard` styles)

**Interfaces:**
- Consumes: `getToken`, `clearToken`, `apiGet` (Task 6).
- Produces: nothing (terminal page).

- [ ] **Step 1: Append welcome card styles to `landing/assets/css/auth.css`**

```css
/* ---- welcome (post-auth stub) ---- */
.welcomecard {
  min-height: 100dvh; display: grid; place-content: center; justify-items: center;
  gap: 1.4rem; text-align: center; padding: var(--gutter);
}
.welcomecard__msg { color: var(--brown); font-size: 1.125rem; max-width: 34ch; }
```

- [ ] **Step 2: Create `landing/welcome.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Welcome</title>
  <meta name="description" content="You're logged in to FeastNow.">
  <meta name="robots" content="noindex">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/auth.css">
</head>
<body class="theme-cream">
  <main class="welcomecard" data-entrance>
    <div class="logo-lockup logo-lockup--lg logo-lockup--stack">
      <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z"
              fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
        <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48"
              fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M32 39.8 L32.99 42.64 L35.99 42.70 L33.60 44.52 L34.47 47.40 L32 45.68 L29.53 47.40 L30.40 44.52 L28.01 42.70 L31.01 42.64 Z"
              fill="var(--gold)"/>
      </svg>
      <span class="wordmark">FeastNow</span>
    </div>
    <p class="welcomecard__msg" id="welcome-message">Loading&hellip;</p>
    <a class="btn btn--navy" href="index.html" data-transition-link><span class="btn__roll"><span>&#8592; Back to home</span><span aria-hidden="true">&#8592; Back to home</span></span></a>
  </main>

  <script type="module" src="assets/js/welcome.js"></script>
  <script type="module" src="assets/js/transitions.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `landing/assets/js/welcome.js`**

```js
import { getToken, clearToken, apiGet } from "./auth.js";

async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const { ok, data } = await apiGet("/api/me", token);
  if (!ok) {
    clearToken();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("welcome-message").textContent =
    `Welcome, ${data.name} — your table is being set.`;
}

init();
```

- [ ] **Step 4: Verify JS syntax**

Run: `node --check landing/assets/js/welcome.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual check**

Run: `npx --yes serve landing -l 5500`, open `http://localhost:5500/welcome.html` directly (no token in `localStorage`). Confirm it immediately redirects to `login.html`. Full "arrives here after a real login" behavior is covered in Task 10. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add landing/welcome.html landing/assets/js/welcome.js landing/assets/css/auth.css
git commit -m "feat(landing): add welcome stub that greets the authenticated user"
```

---

### Task 10: Full end-to-end manual verification

**Files:** none (verification only).

This requires the backend from `docs/superpowers/plans/2026-07-11-feastnow-backend-auth-service.md` to be reachable — either running locally (`cd backend && npm run dev`, with `landing/assets/js/config.js`'s `API_BASE_URL` pointed at `http://localhost:3000`, which is already its default) or deployed to Railway (in which case temporarily update `API_BASE_URL` to the Railway URL for this check, then revert or leave it set once the backend is confirmed deployed).

- [ ] **Step 1: Start the backend locally**

Run (from `backend/`): `npm run dev`
Expected: `FeastNow backend listening on port 3000`. Leave this running.

- [ ] **Step 2: Serve the landing site**

Run (from the repo root, in a second terminal): `npx --yes serve landing -l 5500`
Expected: prints `http://localhost:5500`.

- [ ] **Step 3: Walk the full customer path with a real email you control**

Open `http://localhost:5500/index.html` and click "Get Started." Confirm:
- Arrives at `role-select.html` with the pop-in entrance.
- Clicking "I am a Customer" arrives at `login.html` with the split-screen entrance.
- Clicking "New Sign Up" arrives at `signup.html`.
- Fill in Name/Email (a real address you control)/Phone/Password, submit. Confirm a real email arrives with a 6-digit code within about a minute, and the form morphs into the OTP step.
- Enter the code. Confirm the wax-seal stamp animation plays and it navigates to `welcome.html`, greeting you by the name you entered.

- [ ] **Step 4: Verify login with the account just created**

Navigate to `login.html` (e.g. via the browser back button or the URL bar). Log in with the same email/phone and password. Confirm it navigates to `welcome.html` and greets you correctly.

- [ ] **Step 5: Verify a wrong password is rejected**

On `login.html`, submit the same identifier with a wrong password. Confirm an inline "Incorrect email/phone or password" error appears — no navigation.

- [ ] **Step 6: Verify the Restaurant and delivery stubs**

From `role-select.html`, click "Are you a Restaurant?" — confirm it lands on `coming-soon.html?for=restaurant` with the restaurant-flavored message. From `index.html`, click "Start riding" — confirm it lands on `coming-soon.html?for=delivery` with the rider-flavored message.

- [ ] **Step 7: Verify forgot-password**

From `login.html`, click "Forgot Password," submit any valid-looking email, confirm the "check your email" confirmation appears (this path is mocked — no real email is sent).

- [ ] **Step 8: Verify responsive stacking and reduced motion**

Resize the browser below ~860px width on `login.html`/`signup.html` and confirm the split-screen stacks (form on top, art shrinks to a small header graphic). Enable OS "reduce motion" and reload each page; confirm every entrance/hover/shake animation is skipped with content still fully usable.

- [ ] **Step 9: Stop both servers**

Press `Ctrl+C` in each terminal (backend `npm run dev`, and `serve`).

If all checks pass, the customer auth flow is genuinely working end-to-end against the real backend — no further commits needed (Tasks 1–9 already committed the code).
