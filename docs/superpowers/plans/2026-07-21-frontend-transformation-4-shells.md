# Frontend Transformation — All Four Shells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Customer, Restaurant, Delivery, and Admin shells of the `app/` React SPA into an animated, color-rich experience matching the `landing/` site, changing presentation only — no functionality, route, API, or state-logic changes.

**Architecture:** A shared Phase-0 foundation adds the `motion` library (via `LazyMotion` for a small bundle) plus reusable animation primitives and layout components (`Screen`, `AppHeader`, animated `TabBar`, `Reveal`, `PageTransition`, `BootIntro`). Each shell then composes those primitives; screen refactors are limited to wrapping existing markup in motion components, adding headers, and CSS. Every existing hook, handler, effect, and data path is preserved byte-for-byte.

**Tech Stack:** React 19, Vite 8, react-router-dom 6, TypeScript strict, `motion` (Framer Motion successor), CSS custom properties (existing `tokens.css`).

## Global Constraints

- **No functionality changes.** No route add/remove, no API change, no state-logic/cart/order-state-machine/auth/polling change. Refactors limited to presentation: wrapping markup, adding headers, className/CSS changes. (spec §1)
- **Preserve behavior & tests.** `npm run build` (`tsc -b && vite build`) and `npm run test:e2e` (`playwright test`) must pass after every task. (spec §3.3)
- **Color-blind-safe status:** every order/availability state stays color **+ icon + label**. (spec §1)
- **Contrast:** all text WCAG 2.1 AA (body ≥4.5:1, large/bold ≥3:1). (spec §1)
- **Reduced motion:** every animation degrades (crossfade/instant) under `prefers-reduced-motion`. (spec §1)
- **Low-end Android:** animate only transform/opacity/filter; never layout properties; `motion` loaded via `LazyMotion`+`domAnimation` with `m.*` components. (spec §3.1)
- **Do not edit token VALUES** in `tokens.css`; only add new tokens in `motion.css`. (spec §4)
- **Do not touch** `landing/` or `backend/`. (spec §1)
- **Working directory for all commands:** `app/` (i.e. `cd "c:/Users/aliri/OneDrive/Desktop/Feast Now/app"`).
- **Commit style:** conventional commits; end message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Phase 0 creates:**
- `app/src/styles/motion.css` — new surface + motion tokens and shared animation utility classes.
- `app/src/lib/motion.ts` — shared `motion` variants, spring/ease presets, `domAnimation` re-export.
- `app/src/components/Screen.tsx` — animated screen wrapper (replaces `<main className="screen">`).
- `app/src/components/AppHeader.tsx` — navy "awning" top bar.
- `app/src/components/Reveal.tsx` — in-view stagger primitive.
- `app/src/components/PageTransition.tsx` — route-change transition wrapper.
- `app/src/components/BootIntro.tsx` — one-time-per-session intro curtain.
- `app/src/styles/motion-components.css` — CSS for the above components.

**Phase 0 modifies:**
- `app/package.json` — add `motion` dependency.
- `app/src/main.tsx` — import `motion.css` + `motion-components.css`.
- `app/src/App.tsx` — wrap tree in `LazyMotion` + `MotionConfig`; mount `BootIntro`.
- `app/src/components/TabBar.tsx` — add sliding gold indicator + icon pop.
- `app/src/styles/shell.css` — TabBar indicator styles.

**Phases 1–4 modify** the screen and CSS files of each shell (exact files per task).

**Phase 5 modifies** `DESIGN.md`, `PRODUCT.md`.

---

## Verification model

This is a presentation transformation, so the per-task loop is:
1. Make the change.
2. `npm run build` — TypeScript strict + Vite must pass (catches structural breakage).
3. `npm run test:e2e` — regression guard: existing behavior unchanged. If the suite has no relevant coverage for a screen, build + manual visual check per the `run` skill stands in; never skip build.
4. Visual check (optional per task, required at phase end): launch via the `run` skill and confirm the screen renders and animates.
5. Commit.

Because there is no meaningful "failing unit test" for a visual wrapper, tasks are TDD-shaped where logic exists (none is added here) and regression-shaped otherwise: the existing e2e suite is the test that must stay green.

---

## PHASE 0 — Foundation

### Task 0.1: Add the `motion` library

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install**

Run:
```bash
cd "c:/Users/aliri/OneDrive/Desktop/Feast Now/app" && npm install motion
```
Expected: `motion` appears under `dependencies` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Verify it resolves in a build**

Run:
```bash
npm run build
```
Expected: build succeeds (motion is installed but not yet imported).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(app): add motion animation library"
```

---

### Task 0.2: Motion tokens + shared variants

**Files:**
- Create: `app/src/styles/motion.css`
- Create: `app/src/lib/motion.ts`
- Modify: `app/src/main.tsx`

**Interfaces:**
- Produces (`lib/motion.ts`): `domAnimation` (re-export), `easeExpo: number[]`, `spring`, `springSoft` (Transition objects), and variant objects `screenVariants`, `staggerParent`, `staggerChild`, `revealUp`, `popIn`, `slideUp`.

- [ ] **Step 1: Create `app/src/styles/motion.css`**

```css
/* Additive surface + motion tokens layered on tokens.css — no token value edits. */
:root {
  /* awning header surface (navy gradient) */
  --awning-grad: linear-gradient(135deg, var(--navy-deep) 0%, var(--navy) 62%);
  --awning-ink: var(--cream);
  --awning-ink-dim: rgba(255, 252, 240, 0.72);

  /* section canvases for rhythm */
  --canvas-warm: var(--butter);
  --canvas-plain: var(--off-white);

  /* header elevation */
  --sh-header: 0 6px 22px rgba(15, 44, 86, 0.16);

  /* motion presets (mirror landing eases) */
  --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-enter: 420ms;
}

/* Utility: a subtle live pulse ring (online / active states). Compositor-only. */
@keyframes pulse-ring {
  0%   { transform: scale(1);    opacity: 0.55; }
  70%  { transform: scale(1.9);  opacity: 0; }
  100% { transform: scale(1.9);  opacity: 0; }
}
.pulse-ring::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: currentColor; opacity: 0.5; z-index: -1;
  animation: pulse-ring 1800ms var(--ease-out-quart) infinite;
}

/* Utility: gentle attention pulse for "action needed". */
@keyframes soft-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.035); }
}
.attn-pulse { animation: soft-pulse 1600ms var(--ease-out-quart) infinite; }

@media (prefers-reduced-motion: reduce) {
  .pulse-ring::after, .attn-pulse { animation: none !important; }
}
```

- [ ] **Step 2: Create `app/src/lib/motion.ts`**

```ts
// Shared motion config. Import `m` (not `motion`) at call sites so LazyMotion
// tree-shakes the bundle. Reduced motion is handled globally by MotionConfig
// reducedMotion="user" (see App.tsx) plus the CSS block in global.css.
import { domAnimation } from "motion/react";
import type { Variants, Transition } from "motion/react";

export { domAnimation };

export const easeExpo = [0.16, 1, 0.3, 1];
export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };

// Whole-screen entrance: fade + rise, and orchestrate children.
export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: easeExpo, when: "beforeChildren", staggerChildren: 0.055 },
  },
};

// Parent that staggers its children (for lists/rows). Use with staggerChild.
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeExpo } },
};

// Single element reveal-up.
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeExpo } },
};

// Pop-in for badges / modals / hex-style accents.
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 480, damping: 30 } },
};

// Bottom-sheet / offer slide-up.
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeExpo } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: easeExpo } },
};
```

- [ ] **Step 3: Wire stylesheet imports in `app/src/main.tsx`**

Add after the `tokens.css` import and before `global.css` (so component CSS can override), then add `motion-components.css` after `admin.css`:
```ts
import "./styles/tokens.css";
import "./styles/motion.css";
import "./styles/global.css";
```
And at the end of the style imports (after `./styles/admin.css`):
```ts
import "./styles/motion-components.css";
```
(Create an empty `app/src/styles/motion-components.css` now with a single comment `/* motion component styles */` so the import resolves; Task 0.3+ fill it.)

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS (new files compile; no visual change yet).

- [ ] **Step 5: Commit**

```bash
git add src/styles/motion.css src/styles/motion-components.css src/lib/motion.ts src/main.tsx
git commit -m "feat(app-ui): motion tokens, shared variants, and stylesheet wiring"
```

---

### Task 0.3: Wrap app in LazyMotion + MotionConfig

**Files:**
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: `domAnimation` from `lib/motion.ts`.
- Produces: app tree is inside `<LazyMotion features={domAnimation}>` and `<MotionConfig reducedMotion="user">`, enabling `m.*` components and global reduced-motion everywhere below.

- [ ] **Step 1: Rewrite `app/src/App.tsx`**

```tsx
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, MotionConfig } from "motion/react";
import { AuthGate, useMe } from "./AuthGate";
import { domAnimation } from "./lib/motion";
import { CustomerShell } from "./shells/CustomerShell";
import { RestaurantShell } from "./shells/RestaurantShell";
import { DeliveryShell } from "./shells/DeliveryShell";
import { AdminShell } from "./shells/AdminShell";

function RoleShell() {
  const me = useMe();
  // Anything unknown falls back to the customer experience (SRS §4.1).
  return me.role === "admin" ? <AdminShell />
    : me.role === "restaurant" ? <RestaurantShell />
    : me.role === "delivery_partner" ? <DeliveryShell />
    : <CustomerShell />;
}

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AuthGate>
          <BrowserRouter basename="/app">
            <RoleShell />
          </BrowserRouter>
        </AuthGate>
      </MotionConfig>
    </LazyMotion>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS. (`strict` mode on LazyMotion enforces `m.*` usage — any accidental `motion.*` will fail the build, which is the guardrail we want.)

- [ ] **Step 3: e2e regression**

Run: `npm run test:e2e`
Expected: PASS (no behavior change; app still boots into the correct shell).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app-ui): enable motion via LazyMotion + global reduced-motion config"
```

---

### Task 0.4: `Screen` wrapper component

**Files:**
- Create: `app/src/components/Screen.tsx`
- Modify: `app/src/styles/motion-components.css`

**Interfaces:**
- Produces: `Screen` — `(props: { children: ReactNode; className?: string; refProp?: Ref<HTMLElement>; } & HTMLMotionProps<"main">) => JSX.Element`. Renders `<m.main className="screen ...">` with `screenVariants` (`initial="hidden" animate="show"`). Forwards arbitrary props/handlers so it is a drop-in for the existing `<main className="screen ...">`.

- [ ] **Step 1: Create `app/src/components/Screen.tsx`**

```tsx
import { forwardRef, type ReactNode } from "react";
import { m } from "motion/react";
import { screenVariants } from "../lib/motion";

type ScreenProps = {
  children: ReactNode;
  className?: string;
} & React.ComponentProps<typeof m.main>;

/** Animated screen root. Drop-in for `<main className="screen">`, adds a
 *  fade+rise entrance and orchestrates staggered children that opt in with
 *  `variants={staggerChild}`. All extra props (ref, onScroll, etc.) pass through. */
export const Screen = forwardRef<HTMLElement, ScreenProps>(function Screen(
  { children, className = "", ...rest }, ref
) {
  return (
    <m.main
      ref={ref}
      className={`screen ${className}`.trim()}
      variants={screenVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </m.main>
  );
});
```

- [ ] **Step 2: Add CSS to `app/src/styles/motion-components.css`**

```css
/* Screen wrapper keeps the existing .screen padding from shell.css; nothing
   extra needed here yet. Placeholder anchor for future screen-level rules. */
.screen { will-change: opacity; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/Screen.tsx src/styles/motion-components.css
git commit -m "feat(app-ui): animated Screen wrapper component"
```

---

### Task 0.5: `AppHeader` awning bar

**Files:**
- Create: `app/src/components/AppHeader.tsx`
- Modify: `app/src/styles/motion-components.css`

**Interfaces:**
- Produces: `AppHeader` — `(props: { title?: ReactNode; subtitle?: ReactNode; leading?: ReactNode; actions?: ReactNode; children?: ReactNode; sticky?: boolean; }) => JSX.Element`. Renders a navy gradient `<header className="appbar">` with an animated entrance; `children` render below the title row (e.g. a search bar).

- [ ] **Step 1: Create `app/src/components/AppHeader.tsx`**

```tsx
import type { ReactNode } from "react";
import { m } from "motion/react";
import { easeExpo } from "../lib/motion";

type AppHeaderProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
};

/** Navy "awning" top bar shared by every shell. Cream ink on navy (AA). */
export function AppHeader({ title, subtitle, leading, actions, children, sticky }: AppHeaderProps) {
  return (
    <m.header
      className={`appbar${sticky ? " appbar--sticky" : ""}`}
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: easeExpo }}
    >
      <div className="appbar__row">
        {leading && <div className="appbar__leading">{leading}</div>}
        {(title || subtitle) && (
          <div className="appbar__titles">
            {title && <h1 className="appbar__title serif">{title}</h1>}
            {subtitle && <p className="appbar__subtitle">{subtitle}</p>}
          </div>
        )}
        {actions && <div className="appbar__actions">{actions}</div>}
      </div>
      {children && <div className="appbar__extra">{children}</div>}
    </m.header>
  );
}
```

- [ ] **Step 2: Add CSS to `app/src/styles/motion-components.css`**

```css
/* --- AppHeader (awning) --- */
.appbar {
  background: var(--awning-grad); color: var(--awning-ink);
  padding: calc(env(safe-area-inset-top) + var(--s-md)) var(--s-md) var(--s-md);
  box-shadow: var(--sh-header); position: relative; z-index: var(--z-sticky);
}
.appbar--sticky { position: sticky; top: 0; }
.appbar__row { display: flex; align-items: center; gap: var(--s-sm); min-height: 40px; }
.appbar__leading { display: flex; align-items: center; }
.appbar__titles { flex: 1; min-width: 0; }
.appbar__title { margin: 0; font-size: 22px; color: var(--awning-ink); line-height: 1.1; }
.appbar__subtitle { margin: 2px 0 0; font-size: 13px; color: var(--awning-ink-dim); }
.appbar__actions { display: flex; align-items: center; gap: var(--s-sm); }
.appbar__extra { margin-top: var(--s-md); }
/* Search bar sitting inside a navy header adapts to the dark surface. */
.appbar__extra .search-bar { background: rgba(255,252,240,0.14); border-color: transparent; color: var(--awning-ink); }
.appbar__extra .search-bar input { color: var(--awning-ink); }
.appbar__extra .search-bar input::placeholder { color: var(--awning-ink-dim); opacity: 1; }
.appbar__extra .search-bar:focus-within { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(227,175,4,0.35); }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppHeader.tsx src/styles/motion-components.css
git commit -m "feat(app-ui): navy awning AppHeader component"
```

---

### Task 0.6: `Reveal` in-view stagger primitive

**Files:**
- Create: `app/src/components/Reveal.tsx`

**Interfaces:**
- Produces: `Reveal` — `(props: { children: ReactNode; className?: string; as?: "div"|"ul"|"section"; }) => JSX.Element` renders a stagger parent (whileInView) ; `RevealItem` — `(props: { children: ReactNode; className?: string; }) => JSX.Element` renders a staggered child. Content is visible by default (animation only enhances).

- [ ] **Step 1: Create `app/src/components/Reveal.tsx`**

```tsx
import type { ReactNode } from "react";
import { m } from "motion/react";
import { staggerParent, staggerChild } from "../lib/motion";

/** Staggered in-view reveal for a list/section. Enhances an already-visible
 *  default: if JS/animation never runs, children still render (opacity animates
 *  from the variant, and reduced-motion users get it instantly via MotionConfig). */
export function Reveal({ children, className = "", once = true }:
  { children: ReactNode; className?: string; once?: boolean }) {
  return (
    <m.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.15 }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className = "" }:
  { children: ReactNode; className?: string }) {
  return <m.div className={className} variants={staggerChild}>{children}</m.div>;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Reveal.tsx
git commit -m "feat(app-ui): Reveal in-view stagger primitive"
```

---

### Task 0.7: Upgrade `TabBar` with sliding gold indicator

**Files:**
- Modify: `app/src/components/TabBar.tsx`
- Modify: `app/src/styles/shell.css`

**Interfaces:**
- Consumes: existing `TabDef` interface (unchanged: `{ to, label, icon, end, badge? }`).
- Produces: same `TabBar` export/signature; adds a `layoutId`-animated gold indicator under the active tab and an icon pop on activation. No API change — all three shells keep calling `<TabBar tabs={...} />`.

- [ ] **Step 1: Rewrite `app/src/components/TabBar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import { m } from "motion/react";
import type { ReactNode } from "react";

export interface TabDef {
  to: string; label: string; icon: ReactNode; end: boolean; badge?: number;
}

export function TabBar({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) => `tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}>
          {({ isActive }) => (
            <>
              {isActive && (
                <m.span className="tab-bar__pill" layoutId="tabPill"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }} aria-hidden="true" />
              )}
              <m.span className="tab-bar__icon"
                animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                {tab.icon}
                {tab.badge ? <span className="tab-bar__badge mono">{tab.badge > 9 ? "9+" : tab.badge}</span> : null}
              </m.span>
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Add the pill styles to `app/src/styles/shell.css`**

Add after the existing `.tab-bar__tab--active` rule:
```css
.tab-bar__tab { position: relative; }
.tab-bar__pill {
  position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
  width: 44px; height: 34px; border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--gold) 22%, transparent); z-index: 0;
}
.tab-bar__icon, .tab-bar__tab > span:last-child { position: relative; z-index: 1; }
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: e2e regression**

Run: `npm run test:e2e`
Expected: PASS (navigation still works; tab labels/links unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/TabBar.tsx src/styles/shell.css
git commit -m "feat(app-ui): sliding gold indicator + icon pop on TabBar"
```

---

### Task 0.8: `BootIntro` one-time curtain

**Files:**
- Create: `app/src/components/BootIntro.tsx`
- Modify: `app/src/styles/motion-components.css`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `BootIntro` — `() => JSX.Element | null`. Renders a fixed overlay curtain once per session (guarded by `sessionStorage.getItem("fn_intro_seen")`); removes itself on animation complete or immediately under reduced motion. Mounted once inside `App`, above the router.

- [ ] **Step 1: Create `app/src/components/BootIntro.tsx`**

```tsx
import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "motion/react";

const KEY = "fn_intro_seen";

/** One-time-per-session intro curtain echoing the landing site. Never gates the
 *  app (rendered above it, self-removes). Skipped under reduced motion and on
 *  every load after the first in a session. */
export function BootIntro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(KEY) !== "1";
  });

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    if (reduce) { setShow(false); return; }
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [show, reduce]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {show && (
        <m.div className="boot-intro" aria-hidden="true"
          initial={{ y: 0 }} exit={{ y: "-108%" }}
          transition={{ duration: 0.85, ease: [0.7, 0, 0.3, 1], delay: 0.55 }}>
          <m.span className="boot-intro__hat"
            initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          <m.span className="boot-intro__word serif"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}>
            FeastNow
          </m.span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Add CSS to `app/src/styles/motion-components.css`**

```css
/* --- Boot intro curtain --- */
.boot-intro {
  position: fixed; inset: 0; z-index: var(--z-intro);
  background: var(--awning-grad); color: var(--cream);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  border-radius: 0 0 40% 40% / 0 0 12% 12%;
}
.boot-intro__hat {
  width: 60px; height: 22px; border-radius: 40px 40px 0 0;
  background: var(--gold);
}
.boot-intro__word { font-size: 40px; letter-spacing: -0.01em; }
```

- [ ] **Step 3: Mount in `app/src/App.tsx`**

Add the import and render `<BootIntro />` just inside `MotionConfig`, before `AuthGate`:
```tsx
import { BootIntro } from "./components/BootIntro";
```
```tsx
      <MotionConfig reducedMotion="user">
        <BootIntro />
        <AuthGate>
```

- [ ] **Step 4: Build + e2e**

Run: `npm run build && npm run test:e2e`
Expected: PASS. (If e2e flakes because the curtain overlays the first paint, the intro self-removes in ≤1.4s and sets the session flag; add `sessionStorage.setItem('fn_intro_seen','1')` in the Playwright setup/`beforeEach` if a spec needs the app instantly — do this in the test setup only, not app code.)

- [ ] **Step 5: Commit**

```bash
git add src/components/BootIntro.tsx src/styles/motion-components.css src/App.tsx
git commit -m "feat(app-ui): one-time-per-session boot intro curtain"
```

---

### Task 0.9: Phase-0 visual smoke check

**Files:** none (verification only).

- [ ] **Step 1: Launch the app** using the `run` skill (or `npm run dev` and open `/app/`). Sign in as each role.
- [ ] **Step 2: Confirm:** boot curtain plays once, TabBar gold pill slides between tabs, no console errors, reduced-motion (OS setting) shows instant transitions.
- [ ] **Step 3:** If all good, no commit needed. Note any issues and fix before Phase 1.

---

## PHASE 1 — Customer Shell

> Each task: read the current file, apply the specified transformation (wrap in `Screen`, add `AppHeader`, wrap lists in `Reveal`/`RevealItem`, add CSS), keep every hook/handler/effect identical, then build + e2e + commit. Import `m` from `motion/react` where motion elements are added.

### Task 1.1: Home screen

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`
- Modify: `app/src/styles/home.css`

- [ ] **Step 1:** Replace the root `<main className="screen home" ref={mainRef}>…</main>` with `<Screen className="home" ref={mainRef}>…</Screen>` (import `Screen`). Keep `ref={mainRef}` (pull-to-refresh) and all state/effects verbatim.
- [ ] **Step 2:** Replace the `<header className="home__header">` block with an `<AppHeader sticky leading={<LocationPill/>}>` containing the existing `<SearchBar readOnly onTap={…} />` as `children`. Move the existing location button markup into the `leading` slot unchanged (same `onClick`, `aria-label`). Import `AppHeader`.
- [ ] **Step 3:** Wrap the restaurant grid items in a stagger: change `<div className="grid">{gridItems.map(...)}</div>` to `<Reveal className="grid">{gridItems.map((r) => <RevealItem key={r.id}><RestaurantCardView restaurant={r} /></RevealItem>)}</Reveal>`. Keep skeletons and the sentinel exactly as-is (skeletons stay plain divs). Import `Reveal, RevealItem`.
- [ ] **Step 4:** In `home.css`, since the header is now navy `AppHeader`, remove the now-unused `.home__header` sticky/background rules and the `.location-pill` colors that assumed cream bg; restyle `.location-pill` for the navy header:
```css
.location-pill { align-self: flex-start; display: inline-flex; gap: 4px; align-items: baseline;
  background: none; border: none; padding: 0; color: var(--awning-ink-dim); font-size: 13px; }
.location-pill__value { color: var(--awning-ink); font-weight: 600; }
```
Add a warm canvas to the section band for rhythm:
```css
.all-restaurants { margin-top: var(--s-lg); background: var(--canvas-warm);
  margin-inline: calc(-1 * var(--s-md)); padding: var(--s-lg) var(--s-md) var(--s-md); border-radius: var(--r-lg) var(--r-lg) 0 0; }
.all-restaurants__head h2 { color: var(--navy); }
```
- [ ] **Step 5:** Build: `npm run build` → PASS.
- [ ] **Step 6:** e2e: `npm run test:e2e` → PASS (feed loads, chips filter, infinite scroll, pull-to-refresh unchanged).
- [ ] **Step 7:** Commit: `git add src/screens/HomeScreen.tsx src/styles/home.css && git commit -m "feat(customer-ui): animated awning home with staggered feed"`

### Task 1.2: Restaurant detail screen

**Files:**
- Modify: `app/src/screens/RestaurantScreen.tsx`
- Modify: `app/src/styles/restaurant.css`

- [ ] **Step 1:** Read the current file. Replace its screen root with `<Screen>`. Preserve all data fetching, cart handlers, and menu-section logic.
- [ ] **Step 2:** Give the restaurant image a parallax hero: wrap the hero image element in `<m.div>` and translate on scroll using `useScroll`/`useTransform` from `motion/react` scoped to the screen container. Concretely, add at top of component:
```tsx
import { m, useScroll, useTransform } from "motion/react";
// inside component:
const heroRef = useRef<HTMLDivElement>(null);
const { scrollY } = useScroll();
const heroY = useTransform(scrollY, [0, 240], [0, 60]);
```
and render the hero image as `<m.img style={{ y: heroY }} ... />` (keep its `src`/`alt`). If the current hero markup differs, apply the same `style={{ y: heroY }}` to the image element only.
- [ ] **Step 3:** Make menu-section headers sticky and wrap each menu section's items in `<Reveal>`/`<RevealItem>` (keep add-to-cart buttons and handlers unchanged). In `restaurant.css` add:
```css
.menu-section__title { position: sticky; top: 0; z-index: var(--z-sticky);
  background: var(--bg); padding: var(--s-sm) 0; color: var(--navy); }
```
(Use the actual section-title class name from the file; if different, apply the sticky rule to it.)
- [ ] **Step 4:** Animate the add-to-cart tap: on the add button, wrap in `<m.button whileTap={{ scale: 0.94 }}>` preserving its `onClick`, `type`, `disabled`, and text.
- [ ] **Step 5:** Build → PASS. **Step 6:** e2e → PASS (add to cart still updates cart). **Step 7:** Commit: `feat(customer-ui): parallax hero, sticky menu sections, tactile add-to-cart`.

### Task 1.3: Search screen

**Files:**
- Modify: `app/src/screens/SearchScreen.tsx`
- Modify: `app/src/styles/search.css`

- [ ] **Step 1:** Wrap root in `<Screen>`. Add an `<AppHeader>` housing the search input (keep the existing controlled input value/handlers, debounce, and results logic identical).
- [ ] **Step 2:** Wrap results list in `<Reveal>`/`<RevealItem>` (keep keys and result markup). Recent-searches and empty states stay as-is but get `revealUp` on their container via `<m.div variants={revealUp} initial="hidden" animate="show">`.
- [ ] **Step 3:** In `search.css`, adapt any header rules for the navy `AppHeader` (as in Task 1.1 Step 4).
- [ ] **Step 4:** Build → PASS. **Step 5:** e2e → PASS (search query → results unchanged). **Step 6:** Commit: `feat(customer-ui): animated search with awning header`.

### Task 1.4: Cart screen

**Files:**
- Modify: `app/src/screens/CartScreen.tsx`
- Modify: `app/src/styles/orders.css` (or the cart's stylesheet — use whichever the file imports/uses)

- [ ] **Step 1:** Wrap root in `<Screen>`; add `<AppHeader title="Your cart" />`.
- [ ] **Step 2:** Animate line items with presence: wrap the list in `<AnimatePresence>` and each row in `<m.li variants={staggerChild} ... exit={{ opacity: 0, x: -24 }} layout>`; keep quantity +/- and remove handlers identical. Import `AnimatePresence, m` and `staggerChild`.
- [ ] **Step 3:** Animate the total on change: wrap the total value in `<m.span key={total} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>` so it re-animates when `total` changes (keep the mono class + formatting).
- [ ] **Step 4:** `whileTap={{ scale: 0.97 }}` on the Place Order button (keep its handler/disabled/label).
- [ ] **Step 5:** Build → PASS. **Step 6:** e2e → PASS (quantity math, place-order flow unchanged). **Step 7:** Commit: `feat(customer-ui): animated cart line items and total`.

### Task 1.5: Orders list + Order detail (living status timeline)

**Files:**
- Modify: `app/src/screens/OrdersScreen.tsx`
- Modify: `app/src/screens/OrderDetailScreen.tsx`
- Modify: `app/src/components/OrderStatus.tsx`
- Modify: `app/src/styles/orders.css`

- [ ] **Step 1 (Orders list):** Wrap root in `<Screen>`, add `<AppHeader title="Orders" />`, wrap the orders list in `<Reveal>`/`<RevealItem>`. Keep polling and navigation identical.
- [ ] **Step 2 (Order detail):** Wrap root in `<Screen>`, add `<AppHeader title="Order" leading={<BackButton/>} />` using the existing back navigation. Keep polling/`useCountdown` intact.
- [ ] **Step 3 (Living timeline):** The order status is rendered via `OrderStatus`. Without changing its color+icon+label triple or its status logic, add to the active step a gold pulse and to the progress connector an animated fill. In `OrderStatus.tsx`, wrap the active step's icon container with `className="... pulse-ring"` colored gold (add `style={{ color: "var(--gold)" }}` only on the ring element, not the label), and render the timeline connector as `<m.span className="ostatus__fill" initial={{ scaleX: 0 }} animate={{ scaleX: progress }} style={{ transformOrigin: "left" }} />` where `progress` is derived from the existing status index already computed in the component (do not add new status logic — reuse the index/among-states value already present). If the component currently has no index, compute it locally from the passed status against the existing ordered status list already imported there.
- [ ] **Step 4:** Add timeline CSS to `orders.css`:
```css
.ostatus__fill { display: block; height: 3px; background: var(--gold); border-radius: 2px; }
```
- [ ] **Step 5:** Build → PASS. **Step 6:** e2e → PASS (status display, polling, countdown unchanged). **Step 7:** Commit: `feat(customer-ui): living order-status timeline + animated orders`.

### Task 1.6: Profile screen

**Files:**
- Modify: `app/src/screens/ProfileScreen.tsx`
- Modify: `app/src/styles/shell.css` (profile rules live here)

- [ ] **Step 1:** Wrap root in `<Screen>`; add `<AppHeader title="Profile" />`.
- [ ] **Step 2:** Animate the avatar in with `popIn` (`<m.div variants={popIn} initial="hidden" animate="show">`), keep initials/logic. Keep the logout button handler identical; add `whileTap={{ scale: 0.97 }}`.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS. **Step 5:** Commit: `feat(customer-ui): warm animated profile`.

### Task 1.7: Customer route transitions

**Files:**
- Modify: `app/src/shells/CustomerShell.tsx`

- [ ] **Step 1:** Wrap the `<Routes>` in an `AnimatePresence` keyed transition. Because react-router v6 needs the location for `AnimatePresence`, add:
```tsx
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
// inside component:
const location = useLocation();
```
and render:
```tsx
<AnimatePresence mode="wait">
  <Routes location={location} key={location.pathname}>
    {/* existing routes unchanged */}
  </Routes>
</AnimatePresence>
```
Keep `<TabBar tabs={tabs} />` outside the `AnimatePresence`. Each screen already animates its own entrance via `Screen`, so this adds a clean cross-fade between routes. Keep all routes/paths identical.
- [ ] **Step 2:** Build → PASS. **Step 3:** e2e → PASS (all customer routes reachable). **Step 4:** Commit: `feat(customer-ui): route transition wrapper`.

### Task 1.8: Customer visual pass

- [ ] Launch via `run` skill; walk Home → restaurant → cart → orders → order detail → profile. Confirm animations, contrast on navy headers, reduced-motion fallback, no console errors. Fix anything off, commit fixes.

---

## PHASE 2 — Restaurant Shell

### Task 2.1: Restaurant AppHeader + online toggle

**Files:**
- Modify: `app/src/shells/RestaurantShell.tsx`
- Modify: `app/src/styles/rshell.css`

- [ ] **Step 1:** Replace the `<header className="rtopbar">` in `RTopBar` with `<AppHeader title={profile.name} actions={<OnlineToggle/>} />`, moving the existing toggle button (with its exact `onClick`, `role="switch"`, `aria-checked`, `disabled`) into the `actions` slot. Keep the `toggle` async handler and confirm dialog verbatim.
- [ ] **Step 2:** Animate the toggle knob: make the knob `<m.span className="rtoggle__knob" layout>` so it springs between on/off; keep the `rtoggle--on` class logic.
- [ ] **Step 3:** Animate `OfflineBanner` entrance with `<m.p variants={slideUp} initial="hidden" animate="show">` (keep `role="status"` and copy).
- [ ] **Step 4:** In `rshell.css`, remove `.rtopbar` background rules now superseded by `.appbar`; keep `.rtoggle` styles, adjusting colors for the navy header (knob stays visible; on=basil, off=neutral).
- [ ] **Step 5:** Build → PASS. **Step 6:** e2e → PASS (store status toggle still calls the PATCH). **Step 7:** Commit: `feat(restaurant-ui): awning header + animated online toggle`.

### Task 2.2: Orders queue

**Files:**
- Modify: `app/src/screens/restaurant/ROrdersScreen.tsx`
- Modify: `app/src/styles/rshell.css`

- [ ] **Step 1:** Wrap root in `<Screen>`. Wrap the queue list in `<AnimatePresence>` + `<Reveal>`; each order card `<m.div layout variants={staggerChild} exit={{ opacity: 0, scale: 0.97 }}>` so cards animate as they arrive and as they leave a status bucket. Keep all order data, status filtering, and navigation identical.
- [ ] **Step 2:** Add the "action needed" pulse: for orders awaiting accept/reject, add `className="... attn-pulse"` to the card's primary action affordance (not the whole card, to avoid motion overload). Reuse the existing status check already in the component; add no new status logic.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS. **Step 5:** Commit: `feat(restaurant-ui): animated order queue with action-needed pulse`.

### Task 2.3: Incoming-order alert

**Files:**
- Modify: `app/src/screens/restaurant/IncomingOrderAlert.tsx`

- [ ] **Step 1:** The alert already fires a chime. Wrap its visible element in `<AnimatePresence>` with `<m.div variants={slideUp} initial="hidden" animate="show" exit="exit">` so it slides in synced with the chime. Keep the `NewOrderWatcher` polling/detection and chime logic identical.
- [ ] **Step 2:** Add `popIn` to the alert's icon. Keep dismiss/navigate handlers.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS. **Step 5:** Commit: `feat(restaurant-ui): animated incoming-order alert`.

### Task 2.4: Menu, menu-edit, search, profile, pending

**Files:**
- Modify: `app/src/screens/restaurant/RMenuScreen.tsx`, `RMenuItemEditScreen.tsx`, `RSearchScreen.tsx`, `RProfileScreen.tsx`, `PendingApprovalScreen.tsx`
- Modify: `app/src/styles/rshell.css`

- [ ] **Step 1:** For each screen: wrap root in `<Screen>`, add an `<AppHeader title="…" />` (Menu / Edit item / Search / Store / Pending), wrap any list in `<Reveal>`/`<RevealItem>`, add `whileTap={{ scale: 0.97 }}` to primary buttons. Keep every form field, validation, submit handler, and availability toggle identical.
- [ ] **Step 2:** `PendingApprovalScreen`: give the waiting state a gentle `attn-pulse`-free `revealUp` entrance and keep its copy/logic.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS (menu CRUD, search, profile edits unchanged). **Step 5:** Commit: `feat(restaurant-ui): animate menu, edit, search, profile, pending screens`.

### Task 2.5: Restaurant route transitions + visual pass

**Files:**
- Modify: `app/src/shells/RestaurantShell.tsx`

- [ ] **Step 1:** Apply the same `AnimatePresence`/`useLocation` route-transition wrapper as Task 1.7 to `RestaurantRoutes` (keep `RTopBar`, `OfflineBanner`, `NewOrderWatcher`, and `TabBar` outside the presence). Keep all routes identical.
- [ ] **Step 2:** Build → PASS. **Step 3:** e2e → PASS. **Step 4:** Launch via `run`; verify queue, alert, toggle, menu flows animate and function. **Step 5:** Commit: `feat(restaurant-ui): route transitions`.

---

## PHASE 3 — Delivery Shell

### Task 3.1: Delivery header + availability GO ONLINE

**Files:**
- Modify: `app/src/shells/DeliveryShell.tsx`, `app/src/screens/delivery/DAvailabilityScreen.tsx`
- Modify: `app/src/styles/delivery.css`

- [ ] **Step 1:** Add a high-contrast navy `<AppHeader>` to the delivery shell/screens. In `DAvailabilityScreen`, make the online toggle a large target with a live pulse ring when online: wrap the toggle in a `position: relative` element and add `className="... pulse-ring"` (colored basil) only while `availability_status` is online. Reuse the existing availability value; keep the PATCH handler and confirm logic identical.
- [ ] **Step 2:** `whileTap={{ scale: 0.96 }}` on the toggle. Add `delivery.css` rules for the enlarged toggle + ring color (`color: var(--basil)`).
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS (go online/offline still PATCHes). **Step 5:** Commit: `feat(delivery-ui): awning header + live GO ONLINE pulse`.

### Task 3.2: Assignment-offer modal

**Files:**
- Modify: `app/src/screens/delivery/AssignmentOfferModal.tsx`

- [ ] **Step 1:** Wrap the modal in `<AnimatePresence>` with a backdrop `<m.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>` and panel `<m.div variants={slideUp} initial="hidden" animate="show" exit="exit">`. Keep the countdown, accept/decline handlers, and time-window logic identical.
- [ ] **Step 2:** Visualize the existing countdown as a shrinking gold bar: `<m.div className="offer__timer" style={{ scaleX: remaining/total }} />` using the already-computed countdown values (no new timer logic). Add `.offer__timer { height: 4px; background: var(--gold); transform-origin: left; }` to `delivery.css`.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS. **Step 5:** Commit: `feat(delivery-ui): animated assignment offer with countdown bar`.

### Task 3.3: Active delivery + earnings + profile + pending

**Files:**
- Modify: `app/src/screens/delivery/DActiveDeliveryScreen.tsx`, `DEarningsScreen.tsx`, `DProfileScreen.tsx`, `DPendingApprovalScreen.tsx`
- Modify: `app/src/styles/delivery.css`

- [ ] **Step 1 (Active):** Wrap root in `<Screen>` + `<AppHeader>`. Animate the delivery status progression using the shared living-timeline treatment from Task 1.5 (reuse `OrderStatus` if used here; otherwise apply the same gold-pulse-on-active pattern). Keep pickup/deliver handlers and location logic identical.
- [ ] **Step 2 (Earnings):** Count-up the totals: `<m.span>` with an animated number. Use a small local count-up via `useEffect` + `requestAnimationFrame` OR motion's `animate(count, value)` — implement as:
```tsx
import { useMotionValue, useTransform, animate, m } from "motion/react";
const count = useMotionValue(0);
const rounded = useTransform(count, (v) => `Rs ${Math.round(v).toLocaleString()}`);
useEffect(() => { const c = animate(count, totalValue, { duration: 0.9, ease: [0.16,1,0.3,1] }); return () => c.stop(); }, [totalValue]);
// render: <m.span className="mono">{rounded}</m.span>
```
where `totalValue` is the existing numeric earnings already in the component. Keep the mono class and currency formatting consistent with the rest of the app.
- [ ] **Step 3 (Profile/Pending):** `<Screen>` + `<AppHeader>` + `revealUp` entrance; keep all logic.
- [ ] **Step 4:** Build → PASS. **Step 5:** e2e → PASS. **Step 6:** Commit: `feat(delivery-ui): animate active delivery, earnings count-up, profile, pending`.

### Task 3.4: Delivery route transitions + visual pass

**Files:**
- Modify: `app/src/shells/DeliveryShell.tsx`

- [ ] **Step 1:** Apply the Task 1.7 route-transition wrapper to `DeliveryRoutes` (keep `AssignmentOfferWatcher` and `TabBar` outside). Keep routes identical.
- [ ] **Step 2:** Build → PASS. **Step 3:** e2e → PASS. **Step 4:** Launch via `run`; verify online pulse, offer modal, earnings count-up. **Step 5:** Commit: `feat(delivery-ui): route transitions`.

---

## PHASE 4 — Admin Shell (keeps sidebar)

### Task 4.1: Richer sidebar + shell entrance

**Files:**
- Modify: `app/src/shells/AdminShell.tsx`
- Modify: `app/src/styles/admin.css`

- [ ] **Step 1:** Keep the full-width sidebar layout and all `NAV`/routes/logout logic. Animate the active nav item with a `layoutId` indicator: in the `NavLink` render, when active, render `<m.span className="admin-navlink__bar" layoutId="adminNav" />`. Keep `admin-navlink--active` for color. Add:
```css
.admin-navlink { position: relative; }
.admin-navlink__bar { position: absolute; inset: 0; border-radius: var(--r-sm); background: var(--navy); z-index: -1; }
.admin-navlink--active { color: var(--cream); }
```
Wait — `--active` currently sets its own navy background; replace that background with the animated `__bar` so the indicator slides. Set `.admin-navlink--active { background: none; color: var(--cream); }` and let `__bar` provide the fill.
- [ ] **Step 2:** Animate `admin-main` content on route change with `<m.main>` + a `key={location.pathname}` fade (add `useLocation`). Keep the `<Routes>` intact.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS (admin nav + routes unchanged). **Step 5:** Commit: `feat(admin-ui): animated sidebar indicator + content transitions`.

### Task 4.2: Dashboard metric count-ups

**Files:**
- Modify: `app/src/screens/admin/ADashboardScreen.tsx`
- Modify: `app/src/styles/admin.css`

- [ ] **Step 1:** Give each metric tile a colored accent and a count-up value using the same `useMotionValue`/`animate` pattern as Task 3.2 Step 2, reading the existing metric numbers (no new data). Wrap tiles in `<Reveal>`/`<RevealItem>`.
- [ ] **Step 2:** Add subtle per-tile tint (rotate through cream/butter/off-white/sky) in `admin.css` — no side-stripe borders, full-surface tints only.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS. **Step 5:** Commit: `feat(admin-ui): dashboard metric count-ups and tinted tiles`.

### Task 4.3: Approvals, Users, Moderation, Promotions

**Files:**
- Modify: `app/src/screens/admin/AApprovalsScreen.tsx`, `AUsersScreen.tsx`, `AModerationScreen.tsx`, `APromotionsScreen.tsx`
- Modify: `app/src/styles/admin.css`

- [ ] **Step 1:** For each: wrap the master list rows in `<Reveal>`/`<RevealItem>` (keep keys and click-to-select handlers), animate the detail panel on selection change with `<m.div key={selectedId} variants={revealUp} initial="hidden" animate="show">`, and add `whileTap={{ scale: 0.99 }}` to rows/buttons. Keep all approve/suspend/remove/promo-CRUD handlers, the Restaurants|Riders tab logic, and master/detail state identical.
- [ ] **Step 2:** Animate the existing `admin-tab` switch (Approvals) with a `layoutId="adminTab"` sliding indicator; keep tab state logic.
- [ ] **Step 3:** Build → PASS. **Step 4:** e2e → PASS (approve/suspend/remove/promo flows unchanged). **Step 5:** Commit: `feat(admin-ui): animate approvals/users/moderation/promotions lists and details`.

### Task 4.4: Admin visual pass

- [ ] Launch via `run`; walk dashboard → approvals (both tabs) → users → moderation → promotions. Confirm count-ups, sliding indicators, row reveals, and that every action still works. Fix + commit any issues.

---

## PHASE 5 — Docs + Polish + Verify

### Task 5.1: Update DESIGN.md

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1:** Retire the **Operator-Restraint Rule** (§3 Named Rules and the Do's referencing it). Replace with a note that all four shells share the full expressive language, tuned by density, and that low-end-Android performance remains a hard constraint.
- [ ] **Step 2:** Add a **Motion** section documenting: the `motion` library via `LazyMotion`, the shared variants in `lib/motion.ts`, the `Screen`/`AppHeader`/`TabBar`/`Reveal`/`PageTransition`/`BootIntro` components, the awning-header surface, the section-canvas rhythm, and the reduced-motion strategy (`MotionConfig reducedMotion="user"` + global CSS block).
- [ ] **Step 3:** Update §5 Navigation: Customer/Restaurant/Delivery = animated bottom `TabBar` with sliding gold indicator; Admin = animated navy sidebar.
- [ ] **Step 4:** Commit: `docs(design): codify maximal-everywhere animated system in DESIGN.md`.

### Task 5.2: Update PRODUCT.md

**Files:**
- Modify: `PRODUCT.md`

- [ ] **Step 1:** Adjust the Design Principles wording that reserved expressiveness for the Customer shell ("Appetite first for the customer, clarity first for the operators" and "Customer most expressive, operators most legible") to reflect the maximal-everywhere decision, while keeping "Works on the worst phone in the room" and the accessibility section intact.
- [ ] **Step 2:** Commit: `docs(product): reflect maximal-everywhere shell expressiveness`.

### Task 5.3: Full a11y + reduced-motion + contrast sweep

**Files:** as needed (fixes only).

- [ ] **Step 1:** With OS reduced-motion ON, launch each shell; confirm no motion, instant transitions, boot intro skipped.
- [ ] **Step 2:** Verify contrast on every navy `AppHeader` pairing (cream/gold text on navy), gold usage (never body text on cream), and status pills (color+icon+label present). Use the `impeccable audit` command or manual checks.
- [ ] **Step 3:** Fix any regressions; commit per fix.

### Task 5.4: Final verification

- [ ] **Step 1:** `npm run build` → PASS.
- [ ] **Step 2:** `npm run test:e2e` → PASS (full suite).
- [ ] **Step 3:** `npm run lint` (oxlint) → clean (or no new warnings).
- [ ] **Step 4:** Launch all four shells via `run`; final walkthrough.
- [ ] **Step 5:** Push to `main`: `git push origin main` (Vercel auto-deploys).

---

## Self-Review Notes

- **Spec coverage:** §3.1 motion lib → 0.1/0.3; §3.2 foundation → 0.2–0.8; §4 surfaces → 0.2/0.5 + per-screen; §5 boot intro → 0.8; §6.1 Customer → Phase 1; §6.2 Restaurant → Phase 2; §6.3 Delivery → Phase 3; §6.4 Admin → Phase 4; §7 docs → 5.1/5.2; §1 invariants → verification model + 5.3; §8 phasing → phase structure.
- **No new functionality:** every screen task explicitly says "keep handlers/effects/logic identical"; verification is build + existing e2e.
- **Type consistency:** shared names used consistently — `Screen`, `AppHeader`, `Reveal`/`RevealItem`, `screenVariants`/`staggerParent`/`staggerChild`/`revealUp`/`popIn`/`slideUp`, `domAnimation`, `m` from `motion/react`, `layoutId` values (`tabPill`, `adminNav`, `adminTab`).
- **Reduced motion:** handled globally (`MotionConfig reducedMotion="user"` + existing global.css block) and re-asserted in `motion.css` for the CSS-keyframe utilities.
