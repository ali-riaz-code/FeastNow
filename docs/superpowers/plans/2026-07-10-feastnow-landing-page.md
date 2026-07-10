# FeastNow Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, static, single-page FeastNow marketing/intro website with a curtain roll-up intro animation, modeled section-for-section on pizza-amici.nl and skinned in FeastNow's trattoria palette, deployed static on Vercel.

**Architecture:** One static `index.html` (plus a `login.html` stub) served from `landing/`. Styling via three CSS files (reset, tokens, main). Behavior via vanilla ES modules (`main.js` bootstraps Lenis smooth-scroll + GSAP, `intro.js` runs the curtain, `scroll.js` wires per-section reveals + Swiper). All third-party libraries and fonts are **self-hosted** — no CDN, no build step.

**Tech Stack:** HTML5, CSS3 (custom properties), vanilla JS (ES modules), GSAP + ScrollTrigger, Lenis, Swiper. Self-hosted fonts: Fraunces, Space Grotesk, Azeret Mono, La Belle Aurore.

**Reference spec:** `docs/superpowers/specs/2026-07-10-feastnow-landing-page-design.md`
**Design system:** `DESIGN.md` (root). **Product context:** `PRODUCT.md` (root).

## Global Constraints

Every task's requirements implicitly include these:

- **Self-hosted only.** No CDN/external requests for fonts, JS, CSS, or images. Vendored into `landing/assets/`.
- **Palette (from DESIGN.md):** cream `#FFFCF0` canvas · navy `#0F2C56` ink/structure/primary · brass gold `#E3AF04` accent · tomato `#C72531` / basil `#128643` sparingly · surfaces `#F2EDE9` / `#ECE6E1` / `#EAE1DA` · deep brown `#2F241A`.
- **Type:** Fraunces = display/wordmark; Space Grotesk = UI/body (prose ≤65–75ch); Azeret Mono = **numerics only, never body**; La Belle Aurore = rare flourish only.
- **Contrast:** WCAG 2.1 AA (body ≥4.5:1, large ≥3:1). Navy-on-cream is the backbone. Gold is a fill/accent — **never carries text on cream**; text on a gold fill is navy.
- **Motion:** every animation has a `@media (prefers-reduced-motion: reduce)` fallback (crossfade/instant). Reveal animations enhance an **already-visible** default — never gate content visibility on a JS class. No single uniform entrance on every section.
- **Buttons:** pill (`border-radius:100px`), min-height ≥48px. Primary = navy fill + cream text; gold accent button = gold fill + navy text; ghost = navy outline.
- **Z-index:** semantic scale (see tokens), never arbitrary `999`/`9999`.
- **No horizontal overflow at any breakpoint.** Headings must never overflow their container — test copy at 360px, 768px, 1440px.
- **Absolute bans:** no `border-left/right` colored stripes >1px; no gradient text (`background-clip:text`); no decorative glassmorphism; no numbered/eyebrow scaffolding on every section.
- **Wordmark** is the single word **"FeastNow"** (not "Feast Now").
- **Copy fact:** "Cash on delivery — no online payment (this version)." No payment UI anywhere.
- **Placeholders:** food images are royalty-free (Unsplash/Pexels), each tagged `<!-- PLACEHOLDER: swap for brand photo -->`; stats/testimonials are realistic placeholders tagged `<!-- PLACEHOLDER -->`.
- **Deploy:** static, served from `landing/`. `vercel.json` sets output; no build command.

## File Structure

```
landing/
├── index.html              # the page: intro overlay + 8 sections, inline SVG logo
├── login.html              # minimal in-brand "coming soon" stub (NOT the real login)
├── vercel.json             # static config, output dir = landing/
├── favicon.svg
├── assets/
│   ├── css/
│   │   ├── reset.css        # minimal modern reset
│   │   ├── tokens.css       # :root custom properties from DESIGN.md
│   │   └── main.css         # @font-face + all section/component styles
│   ├── js/
│   │   ├── main.js          # entry module: reduced-motion flag, Lenis, GSAP register, nav
│   │   ├── intro.js         # curtain roll-up timeline
│   │   ├── scroll.js        # ScrollTrigger reveals + counters + Swiper init
│   │   └── vendor/          # gsap.min.js, ScrollTrigger.min.js, lenis.min.js, swiper-bundle.min.js, swiper-bundle.min.css
│   ├── fonts/               # self-hosted woff2 (+ @font-face lives in main.css)
│   └── img/                 # hero + cuisine + og placeholder images
```

**Responsibilities:** `tokens.css` is the single source of design values; `main.css` consumes them. `main.js` owns global setup and exports the `prefersReducedMotion` flag + `lenis` instance; `intro.js` and `scroll.js` import from it. Each section is a `<section>` in `index.html` with a stable `id`.

## Local verification server

Several tasks require a server (ES modules + `fetch` won't run from `file://`). Use Python's built-in server from the repo root:

```bash
# from repo root, in landing/
cd landing && python -m http.server 8123
# then open http://localhost:8123/  (index.html) and http://localhost:8123/login.html
```

If a browser-automation tool is available, screenshot at widths **360px, 768px, 1440px** for each visual task and confirm: no horizontal scrollbar, headings inside their box, palette correct. Otherwise verify manually in a browser and resize.

---

### Task 1: Scaffold, tokens, fonts, reset, base styles

**Files:**
- Create: `landing/index.html`, `landing/assets/css/reset.css`, `landing/assets/css/tokens.css`, `landing/assets/css/main.css`, `landing/favicon.svg`, `landing/vercel.json`
- Create: `landing/assets/fonts/` (self-hosted woff2)

**Interfaces:**
- Produces: CSS custom properties (`--cream`, `--navy`, `--gold`, `--tomato`, `--basil`, surface/brown vars, `--font-display`, `--font-sans`, `--font-mono`, `--font-script`, radius/space/z-scale/ease tokens) consumed by every later task. HTML skeleton with `<head>` linking the three CSS files and `main.js` as `<script type="module">`.

- [ ] **Step 1: Create the folder structure and download self-hosted fonts**

Download variable/static `woff2` for the four families into `landing/assets/fonts/` (use google-webfonts-helper or the Google Fonts CSS2 API `woff2` URLs — pick weights: Fraunces opsz 9-144 wght 300-700; Space Grotesk wght 300-700; Azeret Mono wght 400-600; La Belle Aurore 400). Name them e.g. `fraunces-var.woff2`, `space-grotesk-var.woff2`, `azeret-mono-500.woff2`, `la-belle-aurore-400.woff2`.

- [ ] **Step 2: Write `reset.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; }
body { min-height: 100vh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, svg, video { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; color: inherit; }
p, h1, h2, h3, h4 { overflow-wrap: break-word; }
h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; }
ul[role="list"] { list-style: none; padding: 0; }
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
}
```

- [ ] **Step 3: Write `tokens.css` (values verbatim from DESIGN.md)**

```css
:root {
  /* color */
  --cream:#FFFCF0; --off-white:#F2EDE9; --dough:#ECE6E1; --beige:#EAE1DA;
  --navy:#0F2C56; --navy-deep:#1B2F5E; --brown:#4F3C2C; --brown-deep:#2F241A;
  --gold:#E3AF04; --tomato:#C72531; --basil:#128643; --sky:#C0DEEE;
  --ink:var(--navy); --bg:var(--cream); --muted:#4F3C2C;
  /* type */
  --font-display:"Fraunces","Playfair Display",Georgia,serif;
  --font-sans:"Space Grotesk",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"Azeret Mono","JetBrains Mono",ui-monospace,monospace;
  --font-script:"La Belle Aurore","Caveat",cursive;
  /* radius */
  --r-sm:8px; --r-md:12px; --r-lg:20px; --r-pill:100px;
  /* space */
  --s-xs:4px; --s-sm:8px; --s-md:16px; --s-lg:24px; --s-xl:40px; --s-2xl:72px; --s-3xl:120px;
  /* elevation */
  --sh-raised:0 2px 12px rgba(15,44,86,.08);
  --sh-overlay:0 8px 32px rgba(15,44,86,.14);
  /* z-scale (semantic) */
  --z-base:0; --z-sticky:100; --z-nav:200; --z-drawer:300; --z-intro:400;
  /* motion */
  --ease-out-expo:cubic-bezier(0.16,1,0.3,1);
  --ease-out-quart:cubic-bezier(0.25,1,0.5,1);
  --dur-fast:160ms; --dur:220ms; --dur-slow:800ms;
  /* layout */
  --maxw:1200px; --gutter:clamp(20px,5vw,64px);
}
```

- [ ] **Step 4: Write `@font-face` + base typography in `main.css`**

```css
@font-face { font-family:"Fraunces"; src:url("../fonts/fraunces-var.woff2") format("woff2"); font-weight:300 700; font-display:swap; }
@font-face { font-family:"Space Grotesk"; src:url("../fonts/space-grotesk-var.woff2") format("woff2"); font-weight:300 700; font-display:swap; }
@font-face { font-family:"Azeret Mono"; src:url("../fonts/azeret-mono-500.woff2") format("woff2"); font-weight:500; font-display:swap; }
@font-face { font-family:"La Belle Aurore"; src:url("../fonts/la-belle-aurore-400.woff2") format("woff2"); font-weight:400; font-display:swap; }

html { scroll-behavior:smooth; }
body { background:var(--bg); color:var(--ink); font-family:var(--font-sans); font-size:clamp(1rem,1rem + 0.1vw,1.0625rem); }
h1,h2,h3 { font-family:var(--font-display); font-weight:600; line-height:1.05; letter-spacing:-0.02em; }
.num { font-family:var(--font-mono); font-weight:500; font-variant-numeric:tabular-nums; letter-spacing:-0.01em; }
.container { width:100%; max-width:var(--maxw); margin-inline:auto; padding-inline:var(--gutter); }
.section { padding-block:clamp(56px,10vw,120px); }
```

- [ ] **Step 5: Write `index.html` skeleton**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Your city's kitchens, delivered</title>
  <meta name="description" content="FeastNow is a food-ordering marketplace. Browse nearby restaurants, order in a few taps, track your delivery live. Cash on delivery.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preload" href="assets/fonts/fraunces-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/space-grotesk-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/vendor/swiper-bundle.min.css">
  <link rel="stylesheet" href="assets/css/main.css">
</head>
<body>
  <!-- intro overlay injected/controlled by intro.js (Task 4) -->
  <main id="top">
    <h1 class="container">FeastNow scaffold OK</h1>
  </main>
  <script type="module" src="assets/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Write `favicon.svg` (simple gold hat glyph on cream) and `vercel.json`**

`vercel.json`:
```json
{ "cleanUrls": true, "trailingSlash": false }
```
(Vercel project "Root Directory" is set to `landing`; no build command, output is the folder itself. Note this in the deploy task.)

- [ ] **Step 7: Create a placeholder `main.js` so the module loads**

```js
// landing/assets/js/main.js
export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
console.info("FeastNow landing booted. reduced-motion:", prefersReducedMotion);
```

- [ ] **Step 8: Verify in browser**

Run: `cd landing && python -m http.server 8123` → open `http://localhost:8123/`.
Expected: cream background, "FeastNow scaffold OK" heading rendered in **Fraunces serif**, navy text, no console errors, all four fonts load (check DevTools Network → fonts 200). No horizontal scrollbar at 360/768/1440px.

- [ ] **Step 9: Commit**

```bash
git add landing/
git commit -m "feat(landing): scaffold, design tokens, self-hosted fonts, base styles"
```

---

### Task 2: Vendor the JS libraries + motion bootstrap

**Files:**
- Create: `landing/assets/js/vendor/gsap.min.js`, `ScrollTrigger.min.js`, `lenis.min.js`, `swiper-bundle.min.js`, `swiper-bundle.min.css`
- Modify: `landing/assets/js/main.js`

**Interfaces:**
- Produces: `main.js` exports `prefersReducedMotion` (boolean) and `lenis` (Lenis instance or `null` under reduced motion); registers `gsap` + `ScrollTrigger` globally; exports `gsap`, `ScrollTrigger`. Consumed by `intro.js` and `scroll.js`.

- [ ] **Step 1: Download the libraries into `assets/js/vendor/`**

Fetch the minified UMD/ESM builds (pin versions): GSAP 3.x `gsap.min.js` + `ScrollTrigger.min.js`, Lenis `lenis.min.js` + its default CSS (inline the tiny CSS into `main.css`), Swiper 11 `swiper-bundle.min.js` + `swiper-bundle.min.css`. Save locally (no CDN at runtime).

- [ ] **Step 2: Rewrite `main.js` to bootstrap motion**

```js
import { gsap } from "./vendor/gsap.min.js";
import { ScrollTrigger } from "./vendor/ScrollTrigger.min.js";
import Lenis from "./vendor/lenis.min.js";

export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export { gsap, ScrollTrigger };

gsap.registerPlugin(ScrollTrigger);

export let lenis = null;
if (!prefersReducedMotion) {
  lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  lenis.on("scroll", ScrollTrigger.update);
}

// smooth in-page anchor scrolling (works with or without Lenis)
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  const el = document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(el, { offset: -72 });
  else el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
});
```

If the vendored builds are UMD (not ESM), instead load them via `<script>` tags in `index.html` before `main.js` and read `window.gsap` etc. Choose one approach and keep it consistent; ESM imports preferred.

- [ ] **Step 3: Verify**

Reload `http://localhost:8123/`. Expected: no console errors; typing `window` shows no CDN calls in Network (all vendor files served from localhost, 200). Smooth scroll active on mousewheel (unless OS reduced-motion is on).

- [ ] **Step 4: Commit**

```bash
git add landing/assets
git commit -m "feat(landing): vendor GSAP/ScrollTrigger/Lenis/Swiper + motion bootstrap"
```

---

### Task 3: Logo — inline SVG chef-hat lockup

**Files:**
- Modify: `landing/index.html` (add reusable logo markup), `landing/assets/css/main.css`

**Interfaces:**
- Produces: an inline `<svg class="logo-mark">` chef-hat (navy outline, gold star) and a `.wordmark` ("FeastNow" in Fraunces). A `.logo-lockup` combining both (used large in intro, small in nav/footer). Reused by Tasks 4, 5, 12, 13.

- [ ] **Step 1: Build the chef-hat SVG**

Recreate the reference hat mark (a soft puffy chef's toque with a small star badge) as a compact inline SVG, ~0 external deps. Use `currentColor` for the hat stroke/fill so it inherits `--navy`, and a `.star` sub-path filled `--gold`. Target a clean 1:1 viewBox (e.g. `0 0 64 64`). Provide `role="img"` + `<title>FeastNow</title>`.

```html
<a class="logo-lockup" href="#top" aria-label="FeastNow home">
  <svg class="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
    <title>FeastNow chef hat</title>
    <!-- hat body: rounded toque; use fill:none stroke:currentColor for outline style -->
    <path class="hat" d="M20 40 q-11 0 -11 -10 q0 -9 9 -10 q1 -9 13 -9 q12 0 13 9 q9 1 9 10 q0 10 -11 10 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path class="hat-band" d="M20 40 h24 v7 q0 3 -3 3 h-18 q-3 0 -3 -3 z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
    <path class="star" d="M32 41 l1.6 3.4 3.7.4 -2.8 2.5.8 3.6 -3.3 -1.9 -3.3 1.9.8 -3.6 -2.8 -2.5 3.7 -.4z" fill="var(--gold)"/>
  </svg>
  <span class="wordmark">FeastNow</span>
</a>
```
Refine the path data during implementation until the hat reads cleanly at 32px and 96px (verify by eye). The exact `d` above is a starting geometry, not sacred — adjust curves so it looks like the reference toque.

- [ ] **Step 2: Style the lockup**

```css
.logo-lockup { display:inline-flex; align-items:center; gap:.5rem; color:var(--navy); }
.logo-mark { width:2rem; height:2rem; }
.wordmark { font-family:var(--font-display); font-weight:600; font-size:1.35rem; letter-spacing:-0.02em; color:var(--navy); }
.logo-lockup--lg .logo-mark { width:clamp(3.5rem,10vw,6rem); height:auto; }
.logo-lockup--lg .wordmark { font-size:clamp(2.5rem,9vw,5rem); }
```

- [ ] **Step 3: Verify**

Temporarily place `<div class="container"><div class="logo-lockup logo-lockup--lg">…</div></div>` in `<main>`. Reload. Expected: hat renders navy with a gold star, "FeastNow" in Fraunces beside it, crisp at both small and large sizes; recolors correctly (navy hat, gold star, on cream). Remove the temporary placement after checking (the lockup lives in intro/nav next).

- [ ] **Step 4: Commit**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): inline SVG chef-hat logo lockup in navy/gold"
```

---

### Task 4: Intro curtain roll-up animation

**Files:**
- Modify: `landing/index.html` (intro overlay markup), `landing/assets/css/main.css`, create `landing/assets/js/intro.js`, modify `landing/assets/js/main.js` (import intro)

**Interfaces:**
- Consumes: `gsap`, `prefersReducedMotion` from `main.js`.
- Produces: `initIntro()` exported from `intro.js`; called by `main.js` on DOM ready. Adds/removes body class `intro-active`.

- [ ] **Step 1: Add the intro overlay markup** (first child of `<body>`, before `<main>`)

```html
<div class="intro" id="intro" aria-hidden="true">
  <div class="intro__inner">
    <div class="logo-lockup logo-lockup--lg intro__logo">
      <!-- same SVG hat + wordmark as Task 3, stacked vertically -->
    </div>
  </div>
</div>
```

- [ ] **Step 2: Style the overlay** (navy panel, centered, above everything, stacked lockup)

```css
.intro { position:fixed; inset:0; z-index:var(--z-intro); background:var(--navy);
  display:grid; place-items:center; }
.intro__logo { flex-direction:column; text-align:center; color:var(--cream); }
.intro__logo .wordmark { color:var(--cream); }
.intro__logo .logo-mark { color:var(--cream); }            /* hat outline cream on navy */
.intro__logo .star { fill:var(--gold); }                   /* star stays gold */
body.intro-active { overflow:hidden; }                     /* lock scroll during intro */
/* no-JS / reduced-motion: never show the curtain */
.no-js .intro { display:none; }
@media (prefers-reduced-motion: reduce) { .intro { display:none; } }
```
Add `class="no-js"` to `<html>` and a one-liner in `<head>` that removes it when JS runs: `<script>document.documentElement.classList.remove('no-js')</script>` — so the curtain only exists when JS can animate it away.

- [ ] **Step 3: Write `intro.js`**

```js
import { gsap, prefersReducedMotion } from "./main.js";

export function initIntro() {
  const intro = document.getElementById("intro");
  if (!intro || prefersReducedMotion) { intro?.remove(); document.body.classList.remove("intro-active"); return; }
  document.body.classList.add("intro-active");
  const logo = intro.querySelector(".intro__logo");
  const tl = gsap.timeline({ defaults: { ease: "expo.out" },
    onComplete: () => { intro.remove(); document.body.classList.remove("intro-active"); }});
  tl.from(logo, { y: 24, opacity: 0, duration: 0.6 })
    .to(logo, { opacity: 1, duration: 0.9 })                 // hold
    .to(intro, { yPercent: -100, duration: 0.8 }, ">-0.1")   // curtain rolls up
    .from("main", { y: 20, opacity: 0, duration: 0.6 }, "<0.1"); // hero settles in
}
```

- [ ] **Step 4: Call it from `main.js`**

Append to `main.js`:
```js
import { initIntro } from "./intro.js";
if (document.readyState !== "loading") initIntro();
else document.addEventListener("DOMContentLoaded", initIntro);
```

- [ ] **Step 5: Verify (both modes)**

Reload with normal motion: navy panel with cream FeastNow lockup appears, holds ~0.9s, rolls up to reveal the page; scroll unlocks; `#intro` removed from DOM. Then enable OS "reduce motion" (or DevTools rendering emulation → prefers-reduced-motion: reduce) and reload: **no curtain**, page visible instantly, no locked scroll, no console error. Disable JS: page content still visible (no-js hides curtain).

- [ ] **Step 6: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/intro.js landing/assets/js/main.js
git commit -m "feat(landing): curtain roll-up intro with reduced-motion + no-js fallback"
```

---

### Task 5: Sticky navigation bar

**Files:**
- Modify: `landing/index.html` (header/nav), `landing/assets/css/main.css`, `landing/assets/js/main.js` (mobile toggle + scrolled state)

**Interfaces:**
- Consumes: logo lockup (Task 3), `prefersReducedMotion`.
- Produces: `<header class="nav">` with `id`-anchored links (`#how`, `#partner`, etc.) and Get Started → `login.html`. Mobile drawer toggle. Consumed visually by all sections (anchor targets).

- [ ] **Step 1: Add nav markup** (inside `<body>`, after intro, before/above `<main>`)

```html
<header class="nav" id="nav">
  <div class="container nav__row">
    <!-- small logo lockup (Task 3) -->
    <nav class="nav__links" aria-label="Primary">
      <a href="#how">How it works</a>
      <a href="#partner">For Restaurants</a>
      <a href="#partner">For Riders</a>
      <a class="btn btn--primary" href="login.html">Get Started</a>
    </nav>
    <button class="nav__burger" aria-label="Open menu" aria-expanded="false" aria-controls="nav-drawer">☰</button>
  </div>
  <div class="nav__drawer" id="nav-drawer" hidden><!-- same links stacked --></div>
</header>
```

- [ ] **Step 2: Style nav + buttons** (sticky, translucent→solid on scroll; define reusable `.btn` variants)

```css
.nav { position:sticky; top:0; z-index:var(--z-nav); background:color-mix(in srgb, var(--cream) 82%, transparent); transition:background var(--dur), box-shadow var(--dur); }
.nav.is-scrolled { background:var(--cream); box-shadow:var(--sh-raised); }
.nav__row { display:flex; align-items:center; justify-content:space-between; min-height:64px; }
.nav__links { display:flex; align-items:center; gap:clamp(1rem,3vw,2rem); }
.nav__links > a:not(.btn) { font-weight:500; }
.nav__burger { display:none; background:none; border:0; font-size:1.5rem; min-height:48px; min-width:48px; }
.btn { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 1.5rem; border-radius:var(--r-pill); font-weight:600; cursor:pointer; border:2px solid transparent; transition:transform var(--dur-fast), background var(--dur), color var(--dur); }
.btn:active { transform:scale(.97); }
.btn--primary { background:var(--navy); color:var(--cream); }
.btn--primary:hover { background:var(--navy-deep); }
.btn--gold { background:var(--gold); color:var(--navy); }
.btn--ghost { background:transparent; color:var(--navy); border-color:var(--navy); }
.btn--ghost:hover { background:var(--navy); color:var(--cream); }
@media (max-width:768px){ .nav__links{ display:none; } .nav__burger{ display:inline-flex; } .nav__drawer[hidden]{ display:none; } .nav__drawer{ display:flex; flex-direction:column; gap:1rem; padding:1rem var(--gutter) 1.5rem; background:var(--cream); box-shadow:var(--sh-overlay); } }
```

- [ ] **Step 3: Wire scrolled-state + mobile toggle in `main.js`**

```js
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll(); window.addEventListener("scroll", onScroll, { passive:true });
const burger = document.querySelector(".nav__burger");
const drawer = document.getElementById("nav-drawer");
burger?.addEventListener("click", () => {
  const open = drawer.hasAttribute("hidden");
  if (open) drawer.removeAttribute("hidden"); else drawer.setAttribute("hidden","");
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
});
```

- [ ] **Step 4: Verify**

Desktop: nav sticky, links + gold-free navy Get Started button; background solidifies after scrolling 8px. `Get Started` navigates to `login.html`. Tab through: visible gold focus rings, logical order. Mobile (≤768px): burger shows, links hide; tapping burger opens drawer, `aria-expanded` flips. No overflow at 360px.

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/main.js
git commit -m "feat(landing): sticky nav with reusable button system and mobile drawer"
```

---

### Task 6: Hero section

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`, add hero image to `landing/assets/img/`

**Interfaces:**
- Consumes: `.btn` styles (Task 5). Produces: `<section id="hero">` and the `#top` anchor already present.

- [ ] **Step 1: Source a royalty-free hero food image** into `assets/img/hero.jpg` (tagged placeholder). Provide explicit `width`/`height` and `alt`.

- [ ] **Step 2: Add hero markup**

```html
<section class="hero section" id="hero">
  <div class="container hero__grid">
    <div class="hero__copy">
      <p class="script hero__kicker">buon appetito</p>
      <h1 class="hero__title">Your city's kitchens, delivered.</h1>
      <p class="hero__sub">Browse nearby restaurants, build your order in a few taps, and track it live to your door. Cash on delivery — no online payment needed.</p>
      <div class="hero__cta">
        <a class="btn btn--gold" href="login.html">Get Started</a>
        <a class="btn btn--ghost" href="#how">How it works</a>
      </div>
    </div>
    <div class="hero__media">
      <!-- PLACEHOLDER: swap for brand photo -->
      <img src="assets/img/hero.jpg" alt="A spread of dishes from local restaurants" width="1200" height="1400" loading="eager" fetchpriority="high">
    </div>
  </div>
  <a class="hero__scroll" href="#stats" aria-label="Scroll to learn more">↓</a>
</section>
```

- [ ] **Step 3: Style hero** (two-column desktop → stacked mobile; script kicker used ONCE here, not per section)

```css
.script { font-family:var(--font-script); color:var(--gold); font-size:1.6rem; line-height:1; }
.hero__grid { display:grid; grid-template-columns:1.1fr .9fr; gap:clamp(1.5rem,5vw,4rem); align-items:center; }
.hero__title { font-size:clamp(2.5rem,6vw,4.5rem); }
.hero__sub { max-width:52ch; margin-top:1rem; color:var(--brown); font-size:1.125rem; }
.hero__cta { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:1.75rem; }
.hero__media img { border-radius:var(--r-lg); box-shadow:var(--sh-raised); width:100%; height:auto; object-fit:cover; }
.hero__scroll { display:grid; place-items:center; width:44px; height:44px; margin:1.5rem auto 0; color:var(--navy); }
@media (max-width:768px){ .hero__grid{ grid-template-columns:1fr; } .hero__media{ order:-1; } }
```

- [ ] **Step 4: Verify** — headline in Fraunces, never overflowing at 360/768/1440; gold Get Started has **navy** text; image lazy/priority set; on mobile image stacks above copy; prose ≤~52ch. Reduced-motion unaffected (static section).

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/img/hero.jpg
git commit -m "feat(landing): hero section with headline, CTAs, food imagery"
```

---

### Task 7: Trust ribbon + animated stat counters

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`, create `landing/assets/js/scroll.js`, modify `main.js` (import scroll)

**Interfaces:**
- Consumes: `gsap`, `ScrollTrigger`, `prefersReducedMotion` from `main.js`.
- Produces: `initScroll()` exported by `scroll.js` (also hosts reveals in Task 8+ and Swiper in Task 9). Stat markup with `.num[data-count="500"]`.

- [ ] **Step 1: Add markup** (`#stats` — a marquee band of trust phrases + four counters)

```html
<section class="stats section" id="stats">
  <div class="marquee" aria-hidden="true"><div class="marquee__track">
    <span>Fresh from local kitchens</span><span>•</span><span>Live delivery tracking</span><span>•</span><span>Cash on delivery</span><span>•</span><span>Rate every order</span><span>•</span>
    <!-- duplicate the set once for seamless loop -->
  </div></div>
  <div class="container stats__grid">
    <!-- PLACEHOLDER numbers -->
    <div class="stat"><span class="num stat__n" data-count="500">0</span><span class="stat__suffix">+</span><p class="stat__label">Restaurants</p></div>
    <div class="stat"><span class="num stat__n" data-count="40">0</span><span class="stat__suffix">+</span><p class="stat__label">Cuisines</p></div>
    <div class="stat"><span class="num stat__n" data-count="20">0</span><span class="stat__suffix">k+</span><p class="stat__label">Orders delivered</p></div>
    <div class="stat"><span class="num stat__n" data-count="4.8" data-decimals="1">0</span><span class="stat__suffix">★</span><p class="stat__label">Avg rating</p></div>
  </div>
</section>
```

- [ ] **Step 2: Style** (marquee band navy, counters big mono)

```css
.stats { padding-top:0; }
.marquee { overflow:hidden; background:var(--navy); color:var(--cream); padding-block:.75rem; }
.marquee__track { display:flex; gap:2rem; width:max-content; white-space:nowrap; animation:marquee 26s linear infinite; }
.marquee__track span { font-weight:500; letter-spacing:.02em; }
@keyframes marquee { to { transform:translateX(-50%); } }
@media (prefers-reduced-motion: reduce){ .marquee__track{ animation:none; } }
.stats__grid { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--s-lg); margin-top:clamp(2rem,6vw,4rem); text-align:center; }
.stat__n, .stat__suffix { font-family:var(--font-mono); font-size:clamp(2rem,5vw,3.25rem); color:var(--navy); font-weight:600; }
.stat__label { margin-top:.25rem; color:var(--brown); font-size:.95rem; }
@media (max-width:560px){ .stats__grid{ grid-template-columns:repeat(2,1fr); } }
```

- [ ] **Step 3: Write `scroll.js` with the counter tween**

```js
import { gsap, ScrollTrigger, prefersReducedMotion } from "./main.js";

function countUp() {
  document.querySelectorAll(".stat__n").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    if (prefersReducedMotion) { el.textContent = target.toFixed(decimals); return; }
    const obj = { v: 0 };
    gsap.to(obj, { v: target, duration: 1.4, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
      onUpdate: () => { el.textContent = obj.v.toFixed(decimals); } });
  });
}

export function initScroll() {
  countUp();
  // reveals (Task 8) and Swiper (Task 9) will be added here
}
```

- [ ] **Step 4: Import in `main.js`**

```js
import { initScroll } from "./scroll.js";
if (document.readyState !== "loading") initScroll();
else document.addEventListener("DOMContentLoaded", initScroll);
```

- [ ] **Step 5: Verify** — marquee scrolls seamlessly (paused under reduced-motion); scrolling `#stats` into view animates counters 0→500/40/20/4.8; under reduced-motion the final numbers show immediately (no zeros stuck). 2-col on narrow screens, no overflow.

- [ ] **Step 6: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/scroll.js landing/assets/js/main.js
git commit -m "feat(landing): trust marquee + scroll-triggered stat counters"
```

---

### Task 8: "How FeastNow works" steps + reusable reveal helper

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`, `landing/assets/js/scroll.js`

**Interfaces:**
- Produces: a reusable `revealOnScroll(selector, opts)` helper in `scroll.js` used by this and later sections. Section `#how` with four `.step` items.

- [ ] **Step 1: Add markup** (`#how` — 4 steps, mono numbers, inline SVG icons)

```html
<section class="how section" id="how">
  <div class="container">
    <h2 class="how__title">How FeastNow works</h2>
    <ol class="how__grid" role="list">
      <li class="step" data-reveal><span class="num step__n">01</span><h3 class="step__h">Browse nearby restaurants</h3><p>Discover approved kitchens around you, filter by cuisine, search what you crave.</p></li>
      <li class="step" data-reveal><span class="num step__n">02</span><h3 class="step__h">Build your order</h3><p>Add dishes to your cart, customise, leave a note for the kitchen.</p></li>
      <li class="step" data-reveal><span class="num step__n">03</span><h3 class="step__h">Track it live</h3><p>Watch your order move from kitchen to doorstep with live status and map.</p></li>
      <li class="step" data-reveal><span class="num step__n">04</span><h3 class="step__h">Pay &amp; enjoy</h3><p>Pay cash on delivery, then rate the restaurant and your rider.</p></li>
    </ol>
  </div>
</section>
```

- [ ] **Step 2: Style steps** (cards on off-white surface, gold step numbers; NOT identical-card-grid monotony — vary with a leading oversized mono numeral)

```css
.how__title { font-size:clamp(2rem,4.5vw,3rem); margin-bottom:clamp(1.5rem,4vw,2.5rem); }
.how__grid { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--s-md); counter-reset:step; }
.step { background:var(--off-white); border-radius:var(--r-md); padding:var(--s-lg); }
.step__n { color:var(--gold); font-size:1.5rem; font-weight:600; }
.step__h { font-family:var(--font-display); font-size:1.15rem; margin:.5rem 0 .35rem; }
.step p { color:var(--brown); font-size:.95rem; }
@media (max-width:900px){ .how__grid{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:520px){ .how__grid{ grid-template-columns:1fr; } }
```

- [ ] **Step 3: Add the reveal helper to `scroll.js`** and call it

```js
export function revealOnScroll(selector = "[data-reveal]") {
  const els = document.querySelectorAll(selector);
  if (prefersReducedMotion) return; // elements are already visible by default
  els.forEach((el, i) => {
    gsap.from(el, { y: 24, opacity: 0, duration: 0.6, ease: "power3.out", delay: (i % 4) * 0.08,
      scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });
}
// inside initScroll(): revealOnScroll("#how [data-reveal]");
```
CSS default keeps `[data-reveal]` fully visible (opacity:1); GSAP only animates *from* hidden when it runs, so no-JS/reduced-motion shows content normally.

- [ ] **Step 4: Verify** — four steps render with gold mono numerals; on scroll they rise/stagger in (max 4-stagger); reduced-motion shows them static and visible; responsive 4→2→1 columns; headings don't overflow.

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/scroll.js
git commit -m "feat(landing): how-it-works steps + reusable scroll reveal helper"
```

---

### Task 9: "Explore by cuisine" Swiper carousel

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`, `landing/assets/js/scroll.js`; add cuisine images to `landing/assets/img/`

**Interfaces:**
- Consumes: Swiper (vendored, Task 2). Produces: `#explore` with `.swiper` and cards; Swiper initialised in `initScroll()`.

- [ ] **Step 1: Source 6 royalty-free cuisine images** (`assets/img/cuisine-1..6.jpg`, tagged placeholders), each with `alt`, `width`, `height`, `loading="lazy"`.

- [ ] **Step 2: Add markup** (`#explore` — heading + Swiper of cuisine/restaurant cards with gold star ratings)

```html
<section class="explore section" id="explore">
  <div class="container explore__head">
    <h2>Explore by cuisine</h2>
    <p>From wood-fired pizza to biryani — the best kitchens near you.</p>
  </div>
  <div class="swiper explore__swiper">
    <div class="swiper-wrapper">
      <!-- repeat 6x, PLACEHOLDER content -->
      <div class="swiper-slide card">
        <img src="assets/img/cuisine-1.jpg" alt="Wood-fired pizza" width="600" height="420" loading="lazy">
        <div class="card__body"><h3>Italian</h3><p class="card__meta"><span class="num">4.8</span> ★ · 60+ places</p></div>
      </div>
    </div>
    <div class="swiper-pagination"></div>
    <button class="swiper-button-prev" aria-label="Previous"></button>
    <button class="swiper-button-next" aria-label="Next"></button>
  </div>
</section>
```

- [ ] **Step 3: Style cards** (image-forward, rounded, gold rating star; no nested cards)

```css
.explore__head { display:flex; flex-direction:column; gap:.5rem; margin-bottom:clamp(1.5rem,4vw,2.5rem); }
.explore__head h2 { font-size:clamp(2rem,4.5vw,3rem); }
.explore__swiper { padding-inline:var(--gutter); }
.card { background:var(--off-white); border-radius:var(--r-lg); overflow:hidden; box-shadow:var(--sh-raised); width:clamp(240px,70vw,320px); }
.card img { aspect-ratio:4/3; object-fit:cover; width:100%; }
.card__body { padding:var(--s-md); }
.card__meta { color:var(--brown); font-size:.9rem; margin-top:.25rem; }
.card__meta .num { color:var(--gold); font-weight:600; }
.swiper-button-prev, .swiper-button-next { color:var(--navy); }
.swiper-pagination-bullet-active { background:var(--gold); }
```

- [ ] **Step 4: Init Swiper in `scroll.js`**

```js
import Swiper from "./vendor/swiper-bundle.min.js";
// inside initScroll():
new Swiper(".explore__swiper", {
  slidesPerView: "auto", spaceBetween: 16, grabCursor: true,
  navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
  pagination: { el: ".swiper-pagination", clickable: true },
  a11y: { enabled: true },
});
```

- [ ] **Step 5: Verify** — carousel scrolls/drags horizontally, next/prev + pagination work and are keyboard-focusable; cards show food image + name + gold rating; no vertical/horizontal page overflow; touch-drag works on mobile emulation; reduced-motion still allows manual paging (no autoplay used).

- [ ] **Step 6: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/scroll.js landing/assets/img
git commit -m "feat(landing): explore-by-cuisine Swiper carousel"
```

---

### Task 10: Testimonials

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`

**Interfaces:**
- Consumes: reveal helper (Task 8). Produces: `#reviews` section.

- [ ] **Step 1: Add markup** (`#reviews` — 3 quote cards, gold stars, PLACEHOLDER quotes)

```html
<section class="reviews section" id="reviews">
  <div class="container">
    <h2>Loved by hungry people</h2>
    <div class="reviews__grid">
      <!-- PLACEHOLDER -->
      <figure class="review" data-reveal>
        <div class="review__stars" aria-label="5 out of 5 stars">★★★★★</div>
        <blockquote>Ordered dinner for the family and tracked the rider the whole way. So easy.</blockquote>
        <figcaption>— Ayesha K.</figcaption>
      </figure>
      <!-- repeat x3 with varied quotes -->
    </div>
  </div>
</section>
```

- [ ] **Step 2: Style** (quote cards on cream with subtle surface, gold stars, serif not required for quotes)

```css
.reviews h2 { font-size:clamp(2rem,4.5vw,3rem); margin-bottom:clamp(1.5rem,4vw,2.5rem); }
.reviews__grid { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s-md); }
.review { background:var(--off-white); border-radius:var(--r-md); padding:var(--s-lg); display:flex; flex-direction:column; gap:.75rem; }
.review__stars { color:var(--gold); letter-spacing:.1em; }
.review blockquote { font-size:1.05rem; }
.review figcaption { color:var(--brown); font-weight:600; }
@media (max-width:820px){ .reviews__grid{ grid-template-columns:1fr; } }
```

- [ ] **Step 3: Call reveal** — add `revealOnScroll("#reviews [data-reveal]")` in `initScroll()`.

- [ ] **Step 4: Verify** — 3 testimonials, gold stars, accessible star `aria-label`; reveals on scroll (static under reduced-motion); 3→1 column; no overflow.

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/scroll.js
git commit -m "feat(landing): testimonials section"
```

---

### Task 11: "Grow with FeastNow" partner CTA

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`

**Interfaces:**
- Consumes: `.btn` styles. Produces: `#partner` section (anchor target of nav "For Restaurants / For Riders").

- [ ] **Step 1: Add markup** (`#partner` — dual CTA reflecting the multi-role model; drenched navy panel for contrast)

```html
<section class="partner section" id="partner">
  <div class="container partner__panel">
    <div class="partner__col">
      <h2>List your restaurant</h2>
      <p>Reach more customers in your city. Manage your menu and orders from one app.</p>
      <a class="btn btn--gold" href="login.html">Partner with us</a>
    </div>
    <div class="partner__col">
      <h2>Deliver with us</h2>
      <p>Go online when you want, accept nearby orders, get paid per delivery.</p>
      <a class="btn btn--gold" href="login.html">Start delivering</a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Style** (navy drenched panel, cream text, gold CTAs — a deliberate committed-color moment)

```css
.partner__panel { background:var(--navy); color:var(--cream); border-radius:var(--r-lg); padding:clamp(2rem,6vw,4rem); display:grid; grid-template-columns:1fr 1fr; gap:clamp(1.5rem,5vw,4rem); }
.partner__col h2 { color:var(--cream); font-size:clamp(1.75rem,3.5vw,2.5rem); }
.partner__col p { color:color-mix(in srgb, var(--cream) 82%, transparent); margin:.75rem 0 1.5rem; max-width:38ch; }
@media (max-width:760px){ .partner__panel{ grid-template-columns:1fr; } }
```

- [ ] **Step 3: Verify** — navy panel, two columns of dual CTA, gold buttons with navy text readable on navy panel; cream body text ≥4.5:1 on navy; stacks on mobile; no overflow.

- [ ] **Step 4: Commit**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): grow-with-FeastNow partner CTA"
```

---

### Task 12: Footer

**Files:**
- Modify: `landing/index.html`, `landing/assets/css/main.css`

**Interfaces:**
- Consumes: logo lockup (Task 3), `.btn`. Produces: site `<footer>`.

- [ ] **Step 1: Add markup** (brand + tagline, 3 link columns, social, repeat Get Started, cash-only note, ©)

```html
<footer class="footer">
  <div class="container footer__grid">
    <div class="footer__brand">
      <!-- small logo lockup -->
      <p class="footer__tag">Your city's kitchens, delivered.</p>
      <a class="btn btn--primary" href="login.html">Get Started</a>
    </div>
    <nav class="footer__col" aria-label="Company"><h3>Company</h3><a href="#">About</a><a href="#">Contact</a></nav>
    <nav class="footer__col" aria-label="Product"><h3>Product</h3><a href="#how">How it works</a><a href="#partner">For Restaurants</a><a href="#partner">For Riders</a></nav>
    <nav class="footer__col" aria-label="Legal"><h3>Legal</h3><a href="#">Privacy</a><a href="#">Terms</a></nav>
  </div>
  <div class="container footer__bar">
    <p class="footer__note">Cash on delivery — no online payment (this version).</p>
    <p class="footer__copy">© <span class="num">2026</span> FeastNow</p>
    <div class="footer__social"><!-- inline SVG Instagram/LinkedIn, aria-labels --></div>
  </div>
</footer>
```

- [ ] **Step 2: Style** (navy footer, cream text, gold link hovers)

```css
.footer { background:var(--navy); color:var(--cream); padding-block:clamp(2.5rem,6vw,4rem); margin-top:clamp(2rem,6vw,4rem); }
.footer .wordmark, .footer h3 { color:var(--cream); }
.footer__grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:var(--s-lg); }
.footer__col { display:flex; flex-direction:column; gap:.5rem; }
.footer__col h3 { font-family:var(--font-display); font-size:1rem; margin-bottom:.25rem; }
.footer__col a:hover { color:var(--gold); }
.footer__tag { color:color-mix(in srgb,var(--cream) 82%, transparent); margin:.5rem 0 1rem; }
.footer__bar { display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem; margin-top:clamp(2rem,5vw,3rem); padding-top:1.5rem; border-top:1px solid color-mix(in srgb,var(--cream) 20%, transparent); color:color-mix(in srgb,var(--cream) 75%, transparent); }
@media (max-width:760px){ .footer__grid{ grid-template-columns:1fr 1fr; } .footer__brand{ grid-column:1/-1; } }
```

- [ ] **Step 3: Verify** — footer navy, columns render, links hover gold, cash-only note present, © year in mono, social icons have aria-labels; 4→2 columns on mobile; cream-on-navy contrast passes; no overflow.

- [ ] **Step 4: Commit**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): footer with links, social, cash-on-delivery note"
```

---

### Task 13: `login.html` "coming soon" stub

**Files:**
- Create: `landing/login.html`
- Modify: `landing/assets/css/main.css` (small stub styles, or inline in the file)

**Interfaces:**
- Consumes: tokens.css, main.css, logo lockup. Produces: a non-404 destination for every `Get Started` / partner CTA.

- [ ] **Step 1: Write `login.html`** (minimal, in-brand, NOT the real login)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FeastNow — Login coming soon</title>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/reset.css">
  <link rel="stylesheet" href="assets/css/tokens.css">
  <link rel="stylesheet" href="assets/css/main.css">
</head>
<body>
  <main class="stub">
    <div class="logo-lockup logo-lockup--lg"><!-- hat + FeastNow, stacked --></div>
    <p class="stub__msg">Login is coming soon. We're still setting the table.</p>
    <a class="btn btn--primary" href="index.html">← Back to home</a>
  </main>
</body>
</html>
```

- [ ] **Step 2: Style the stub**

```css
.stub { min-height:100dvh; display:grid; place-content:center; justify-items:center; gap:1.25rem; text-align:center; padding:var(--gutter); background:var(--cream); }
.stub__msg { color:var(--brown); font-size:1.125rem; max-width:32ch; }
```

- [ ] **Step 3: Verify** — visiting `http://localhost:8123/login.html` shows the branded stub; "Back to home" returns to `index.html`; every `Get Started` on the landing page reaches it (no 404). Responsive, centered.

- [ ] **Step 4: Commit**

```bash
git add landing/login.html landing/assets/css/main.css
git commit -m "feat(landing): in-brand login coming-soon stub"
```

---

### Task 14: Final QA pass — responsive, a11y, reduced-motion, deploy config

**Files:**
- Modify: any file needing fixes found during QA; confirm `landing/vercel.json`

**Interfaces:** none new — this is the integration gate.

- [ ] **Step 1: Full responsive sweep** — at 360/390/768/1024/1440px confirm: no horizontal scrollbar anywhere; every heading inside its box (test the hero and section titles specifically); nav collapses correctly; carousel and grids reflow; images never overflow.

- [ ] **Step 2: Accessibility pass** — keyboard-tab the whole page top to bottom: visible gold focus rings, logical order, burger/drawer operable, Swiper controls reachable. Check color contrast on: navy-on-cream body, cream-on-navy (footer/partner), gold buttons' navy text, `.stat__label`/`.hero__sub` brown-on-cream (must be ≥4.5:1 — if not, darken toward `--brown-deep`). All images have `alt`; icon-only controls have `aria-label`.

- [ ] **Step 3: Reduced-motion pass** — with `prefers-reduced-motion: reduce`: no curtain (page instant), marquee static, counters show final values, section reveals absent but all content visible, Lenis off (native scroll). No stuck-hidden elements.

- [ ] **Step 4: No-JS pass** — disable JS: intro hidden, all content visible and readable, links work (nav is plain anchors, Get Started → login.html). Confirm no CDN/external network requests in the Network panel (self-hosted requirement).

- [ ] **Step 5: Lighthouse-style sanity** — run a quick perf/a11y check (browser Lighthouse if available); fix any AA contrast or large-image regressions. Confirm fonts use `swap`, images have dimensions + lazy where appropriate.

- [ ] **Step 6: Confirm Vercel config** — `landing/vercel.json` present; document that the Vercel project's **Root Directory = `landing`**, Framework Preset = "Other", no build command, output = the directory. (README note optional.)

- [ ] **Step 7: Commit + push**

```bash
git add -A landing/
git commit -m "chore(landing): final responsive/a11y/reduced-motion QA pass + vercel config"
git push origin main
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- §3 stack (vanilla + GSAP/ScrollTrigger/Lenis/Swiper, self-hosted, fonts) → Tasks 1–2 ✓
- §4 file structure → Tasks 1–2, 13 ✓
- §5 intro curtain (+ reduced-motion/no-js) → Task 4 ✓
- §6 all 8 sections: nav→T5, hero→T6, ribbon/stats→T7, steps→T8, cuisine carousel→T9, testimonials→T10, partner→T11, footer→T12 ✓
- §7 design system application (tokens, buttons, type roles) → Tasks 1, 3, 5 (+ used throughout) ✓
- §8 placeholder policy (images + stats/testimonials tagged) → Tasks 6, 7, 9, 10 ✓
- §9 Get Started → login.html stub → Tasks 5, 13 ✓
- §10 motion/a11y/perf details → Tasks 4, 7, 8, 14 ✓
- §11 success criteria → Task 14 gate ✓
- Logo recolor (spec §5/§7) → Task 3 ✓

**Placeholder scan:** All code steps contain real code. Placeholder *content* (images/stats/testimonials) is an explicit, tagged product decision per spec §8, not a plan gap. No "TBD/handle edge cases/similar to Task N".

**Type/name consistency:** `main.js` exports `prefersReducedMotion`, `gsap`, `ScrollTrigger`, `lenis`; `intro.js` imports them and exports `initIntro`; `scroll.js` imports them, exports `initScroll` + `revealOnScroll`, and hosts the counter + Swiper init. CSS classes reused consistently (`.btn`/`--primary`/`--gold`/`--ghost`, `.logo-lockup`, `.num`, `[data-reveal]`, `.container`, `.section`). Anchor ids (`#how`, `#partner`, `#stats`, `#explore`, `#reviews`, `#top`) match nav/footer links.

No gaps found.
