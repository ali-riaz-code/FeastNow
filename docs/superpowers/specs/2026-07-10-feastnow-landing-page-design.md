# FeastNow Landing Page — Design Spec

**Date:** 2026-07-10
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)

## 1. Summary

A standalone marketing/intro **web page** for FeastNow, modeled section-for-section on
[pizza-amici.nl](https://www.pizza-amici.nl/). It opens with a **curtain roll-up intro
animation** revealing the FeastNow wordmark, then presents a full single-page scrolling
introduction to the app, ending in a `Get Started` call-to-action that will later lead to a
(not-yet-built) login page.

The page borrows pizza-amici.nl's **structure, motion, and editorial feel**, rendered in
FeastNow's own **trattoria visual identity** (cream / navy / gold) per `DESIGN.md`, and
introduces the app whose functionality is modeled on Foodpanda (per `PRODUCT.md`).

**Non-goals (explicitly out of scope for this task):**
- The login page itself (later task). `Get Started` links to a placeholder route.
- Any app functionality, backend, or auth.
- The React Native app or admin portal.

## 2. Context & constraints

- **Register:** brand/marketing surface (design leads here), even though the product it
  introduces is a `product`-register app. This is the one marketing surface FeastNow has.
- **Visual identity:** `DESIGN.md` — cream `#FFFCF0` canvas, navy `#0F2C56` structure/ink,
  brass gold `#E3AF04` accent, tomato `#C72531` / basil `#128643` used sparingly.
- **Reference DNA:** pizza-amici.nl (Webflow + GSAP + Locomotive smooth-scroll + Swiper).
  We reproduce the feel with an equivalent, license-clean, self-hosted toolchain.
- **Deploy:** static files served by Vercel; auto-deploys on push to `main`. No build step.
- **Performance target:** must stay smooth on low-to-mid-range devices (per `PRODUCT.md`
  "works on the worst phone in the room"). Self-hosted assets, lazy images, cheap motion.
- **Accessibility:** WCAG 2.1 AA contrast, keyboard-navigable, visible focus rings, full
  `prefers-reduced-motion` fallbacks, respects no-JS (content still readable).

## 3. Stack (approach A — approved)

Vanilla **HTML + CSS + JavaScript**, no framework. Animation/interaction libraries,
**self-hosted** (vendored into `assets/js/vendor/`), no CDN dependency:

- **GSAP + ScrollTrigger** — curtain intro timeline + scroll-triggered section reveals.
- **Lenis** — smooth scrolling (modern successor to the reference's Locomotive Scroll).
- **Swiper** — the "Explore by cuisine" carousel.

Rationale: the reference is a static site + GSAP + smooth-scroll + carousels; matching that
1:1 (minus Webflow) is the highest-fidelity, lightest-to-deploy reproduction. If the web
surface later grows past landing + login, migrating to Astro/Next is straightforward.

**Fonts** (all free/self-hostable; the reference's Adobe fonts are not licensable for us):
- **Fraunces** (variable high-contrast serif) → display + FeastNow wordmark (stands in for
  Awesome Serif; matches DESIGN.md display role).
- **Space Grotesk** → sans UI/body (DESIGN.md sans fallback).
- **Azeret Mono** → numerics (stats, prices, step numbers) — same family as the reference.
- **La Belle Aurore** → rare script flourish — same family as the reference.

All served as self-hosted `woff2` with `font-display: swap`.

## 4. File structure

```
landing/
├── index.html
├── login.html             # minimal in-brand "coming soon" stub (NOT the real login)
├── assets/
│   ├── css/
│   │   ├── reset.css       # minimal modern reset
│   │   ├── tokens.css      # CSS custom properties from DESIGN.md (color, type, radius, spacing, z-scale, motion)
│   │   └── main.css        # all section + component styles
│   ├── js/
│   │   ├── main.js         # entry: init Lenis, register plugins, wire nav + Get Started
│   │   ├── intro.js        # curtain roll-up intro timeline
│   │   ├── scroll.js       # ScrollTrigger section reveals + Swiper init
│   │   └── vendor/         # gsap.min.js, ScrollTrigger.min.js, lenis.min.js, swiper.min.js (+css)
│   ├── fonts/              # self-hosted woff2
│   └── img/                # food photography (royalty-free placeholders) + og image
└── favicon.svg / favicon.ico
```

Logo is an **inline SVG** in `index.html` (so it can be recolored/animated), not an image file.

## 5. Intro animation (centerpiece)

- Full-viewport **navy `#0F2C56`** overlay panel, z-index above all content (semantic z-scale, not `9999`).
- Centered lockup: recolored **gold/navy chef-hat SVG** above the **FeastNow** wordmark (Fraunces,
  rendered as the single word "FeastNow" — the brand name — not "Feast Now").
- Timeline (GSAP): wordmark + hat fade/slide in (~0.5s, ease-out-expo) → hold ~0.9s → whole
  panel translates up and off (`translateY(-100%)`, ~0.8s ease-out-expo) revealing the hero,
  which settles in (subtle rise/opacity) as the panel clears.
- Runs **once per load** (no session-storage gating required for a single landing page; keep simple).
- **Reduced-motion / no-JS:** overlay hidden (`display:none` when `prefers-reduced-motion` or no JS);
  hero is visible immediately. Content is **never** gated behind the animation firing.

## 6. Sections (pizza-amici.nl → FeastNow)

Order top-to-bottom:

1. **Nav bar** (sticky, becomes solid navy-on-cream after scroll): hat+FeastNow logo · links
   *How it works · For Restaurants · For Riders* · **Get Started** button. Mobile: hamburger → sheet.
2. **Hero:** serif headline (e.g. "Your city's kitchens, delivered."), sans subcopy (browse
   nearby restaurants, order in a few taps, track live, cash on delivery), **Get Started**
   (primary) + *How it works* (secondary, scrolls). Appetizing hero food image. Scroll-down cue.
3. **Trust ribbon / stats:** marquee band + animated **mono** counters — Restaurants · Cuisines ·
   Orders delivered · Avg rating. *(placeholder numbers, see §8)*
4. **How FeastNow works:** 4 steps — **Browse → Build your order → Track live → Pay & enjoy** —
   each with a navy/gold icon, **mono** step number, short copy.
5. **Explore by cuisine:** Swiper carousel of cuisine / featured-restaurant cards (food image,
   name, rating stars in gold). Mirrors the reference's Pizza/Pasta tabbed menu. *(placeholder content)*
6. **Testimonials:** 2–3 customer quotes + gold star ratings. *(placeholder content, see §8)*
7. **Grow with FeastNow (partner CTA):** dual CTA reflecting the multi-role model — *List your
   restaurant* and *Deliver with us*.
8. **Footer:** brand + tagline · link columns (Company / Product / Legal) · social icons ·
   repeat **Get Started** · note "Cash on delivery — no online payment (this version)" · © line.

## 7. Design system application

Pulled from `DESIGN.md` into `tokens.css`:

- **Color:** cream canvas; navy ink, structure, primary pill buttons; gold accent for prices,
  rating stars, active states, focus rings; tomato/basil only for tiny accents. Warm neutral
  surfaces (`#F2EDE9`, `#ECE6E1`, `#EAE1DA`) for cards/dividers.
- **Type:** Fraunces (display/wordmark), Space Grotesk (UI/body, prose ≤65–75ch), Azeret Mono
  (numerics only — never body), La Belle Aurore (rare flourish, e.g. a "grazie"/"buon appetito"
  moment). Uppercase tracked micro-labels allowed as small labels, not as an eyebrow above every section.
- **Shape/elevation:** pill buttons (`border-radius:100px`, min-height ~48px), cards 12–20px,
  flat-by-default with soft warm shadows on raised/hovered cards.
- **Buttons:** primary = navy fill + cream text; gold accent button = gold fill + **navy** text
  (gold never carries text on cream); ghost = navy outline. Hover/press ~150–200ms; visible
  gold focus-visible ring.

## 8. Placeholder content policy

FeastNow is pre-launch, so:
- **Imagery:** curated **royalty-free food photos** (Unsplash/Pexels, license-clean), stored in
  `assets/img/`, each clearly earmarked in comments for swap with real brand photography.
- **Stats & testimonials:** realistic **placeholder** numbers and quotes. Copy is written so it
  reads as marketing, and the sections are structured to drop in real data later. Marked with
  `<!-- PLACEHOLDER -->` comments.

## 9. Get Started behavior

All `Get Started` triggers (nav, hero, footer) link to **`login.html`** — a **minimal in-brand
placeholder stub** ("Login — coming soon", cream/navy, FeastNow logo) that lives in `landing/`
so the link never dead-ends or 404s. This stub is **not** the real login page (a separate later
task); it exists only to keep the flow demonstrable. `List your restaurant` / `Deliver with us`
point to the same stub for now (or `#partner`), clearly commented as placeholder destinations.

## 10. Motion / a11y / performance details

- ScrollTrigger reveals are **per-section appropriate** (staggered lists, rising cards, counter
  tweens), not one uniform entrance on every block.
- Reveal animations enhance an **already-visible** default (no visibility gated on JS classes),
  so headless/hidden-tab renders still show content.
- Lenis smooth-scroll disabled when `prefers-reduced-motion: reduce`; native scroll used.
- Every animation has a reduced-motion fallback (crossfade or instant).
- Semantic HTML (`header/nav/main/section/footer`, headings in order), `alt` on all images,
  keyboard focus order, visible focus rings, `aria-label`s on icon-only controls.
- Perf: self-hosted fonts (`swap`), `loading="lazy"` + width/height on images, vendored minified
  JS, no render-blocking external requests.

## 11. Success criteria

- Intro plays the curtain roll-up on first load and reveals the hero; under reduced-motion the
  hero is shown instantly with no broken state.
- All eight sections render, populated with FeastNow content, faithful in structure/feel to
  pizza-amici.nl, skinned in the DESIGN.md trattoria palette.
- Fully responsive (mobile → desktop), no horizontal overflow at any breakpoint, headings never
  overflow their container.
- WCAG AA contrast holds; keyboard and screen-reader navigable; reduced-motion honored.
- `Get Started` is wired to its placeholder destination.
- Deploys to Vercel as static files and loads acceptably on a low-end device.

## 12. Open items / future

- Real brand photography, real stats, real testimonials swap in later.
- Login page is the immediate next task after this.
- If web surface grows, revisit stack (Astro/Next).
