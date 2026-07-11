# FeastNow Landing Page — Visual Refresh Design Spec

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)
**Builds on:** `docs/superpowers/specs/2026-07-10-feastnow-landing-page-design.md` (original build).
This spec only covers the deltas below — everything not mentioned here (intro
curtain, general section order, footer, fonts, a11y/perf posture) is unchanged.

## 1. Summary

A visual-fidelity pass on the already-shipped FeastNow landing page, driven by
side-by-side comparison against [pizza-amici.nl](https://www.pizza-amici.nl/)
(confirmed to be a pizza **food-truck rental** service — explains its
polaroid/booking-card, ticket, and hexagon-badge visual language). The current
page has the right bones (sections, palette, motion library, ticket carousel)
but reads as too sparse/static in several places relative to the reference.
This pass makes the hero feel "full," fixes a scroll-reveal coverage gap, and
adds richer color/texture/photography in specific sections — all while
staying **fully illustrated** in the hero (no stock photos of people; the
reference's crew photo is deliberately not reproduced).

## 2. Reference images (source of truth for this pass)

Three screenshots supplied by the user, from pizza-amici.nl:
1. **Nav bar** — a floating, stadium-shaped (fully rounded) cream/white bar,
   inset from the viewport edges with the page background visible as a margin
   around it, soft shadow. Logo left, text links center, a gold ticket-shaped
   "Book a truck" button on the right (scalloped/notched left+right edges),
   with a short dash before it.
2. **Hero** — one large photo panel (crew under a blue/white scalloped
   awning, string lights, "ORDER HERE" hanging sign, a checkered cloth
   draped over a pole) with an elongated scalloped hexagon "ticket" badge
   overlapping its bottom edge (Reviews ★★★★★ 4.6 + bold headline), small
   tilted polaroid cards overlapping the left edge, and a light-blue info
   card + peeking CTA overlapping the right edge. Maroon/brown scalloped
   wallpaper texture visible behind the crew.
3. **Divider** — a navy/cream repeating dashed-block ribbon used as a
   section-boundary seam.

## 3. Changes

### 3.1 Hero — full "big card" rebuild

- Enlarge the existing illustrated food-cart SVG (`.cart`) to dominate the
  section — near full container width, not a 50/50 copy/art grid column.
  Headline / subcopy / CTAs stay above it, unchanged in content.
- Add a small "ORDER HERE" hanging placard on the cart's existing gold pole,
  alongside the current FeastNow roof sign.
- Add a draped blue-and-white checkerboard cloth on the second awning pole,
  with a slow CSS sway (rotate ±3deg loop), reduced-motion-safe.
- Redesign `.sticker` (currently a circular starburst) into an elongated
  **scalloped hexagon ticket badge** — same perforation-dot technique already
  used on `.ticket` (small circles cut from the edge, background-matched to
  the surface behind), containing the existing Reviews/4.6 content plus a
  short bold supporting line. Overlaps the bottom-center of the enlarged cart.
- Add two new small tilted flanking cards overlapping the cart's left/right
  edges (illustrated, not photographic):
  - **Left:** mini stat card (reuse a ticker stat, e.g. "3,000+ restaurants"),
    Polaroid-style, tilted, thick cream border, soft shadow.
  - **Right:** sky-blue (`--sky`) info card with one short marketing line and
    a small gold button peeking at its bottom edge (echoes the reference's
    light-blue card + peeking CTA).
- Responsive: flanking cards hide below ~640px to avoid clutter; cart +
  hexagon badge remain, stacked, headline above.

### 3.2 Nav — floating pill bar

- Nav wrapper becomes an inset, fully-rounded (`border-radius: var(--r-pill)`)
  floating bar: margin on all sides so the page's cream background shows
  around it, soft shadow (`--sh-raised`), background always cream/off-white
  (replaces the current transparent→solid-on-scroll toggle).
- Get Started button inside the nav gets scalloped notch cutouts on its
  left/right edges (same perforation-dot trick as `.ticket`), reading as a
  torn ticket — **nav instance only**; hero/footer Get Started buttons keep
  the current plain pill.
- Mobile drawer becomes a matching rounded card anchored under the pill bar
  rather than a full-width sheet.

### 3.3 Scroll speed

- Lenis `duration` reduced from `1.15` to `~0.8`; easing swapped for a
  snappier curve; add a modest `wheelMultiplier` bump. Goal: scroll response
  feels immediate, not laggy. (No change to reduced-motion behavior — Lenis
  is already skipped entirely in that case.)

### 3.4 Scroll-reveal coverage (consistency fix)

Currently `revealOnScroll` / `data-reveal` is only wired to `#how`,
`#partner`, `#riders`, and the cuisine-ticket fan-in — every other section
(cuisines heading, reviews heading, footer, the new hero flanking cards)
renders at full opacity immediately, which reads as "already loaded" the
moment the user scrolls to it. Fix: extend the same reveal treatment to
every remaining section heading/card group for a consistent feel, and adjust
the `IntersectionObserver` trigger (`rootMargin`) so elements animate in
*as they cross into view* rather than only once fully visible. Still governed
by the existing rule: content is visible by default, JS only enhances with
motion, nothing is ever gated on the animation firing.

### 3.5 Section-boundary "crevice" dividers

Add a thin repeating dashed/block ribbon (`repeating-linear-gradient`, cheap,
crisp — same spirit as reference image 3, not a pixel clone) at every
section seam (`.sec-cap`), each boundary getting its own two-tone color pair
rather than one repeated tone:
- hero → cuisines: gold/cream
- cuisines → how: navy/cream
- how → reviews: **brown/cream** (explicitly requested)
- reviews → partner: tomato/cream
- partner → riders: **brown/cream** (ties into the riders brown theme)
- riders → footer: navy/cream

### 3.6 Partner section — animated kitchen illustration

Replace the static `assets/img/hero.jpg` photo in `.partner__media` with an
inline SVG stovetop illustration (flame flicker via opacity/scale keyframes,
rising steam reusing the existing `.cart__steam` animation) in the same
navy-linework illustration style as the cart/scooter. Keeps the existing
arch-shaped frame and `.partner__stamp` badge.

### 3.7 Riders section — brown theme

New `.theme-brown` section theme using the already-defined `--brown` /
`--brown-deep` tokens (`--bg: var(--brown); --ink: var(--cream); --muted:
var(--sky);`), replacing the current `theme-cream` on `#riders`. Add a
subtle low-opacity scalloped-texture background (repeating radial-gradient,
same maroon family) echoing the wallpaper visible behind the crew in
reference image 2. Existing gold "Start riding" CTA is kept — it already
reads well against brown.

### 3.8 Explore by cuisine — photos, color, hover

- Replace each cuisine ticket's emoji icon with a real, cuisine-matched food
  photo (curated royalty-free source, per the original spec's existing
  placeholder-imagery policy — §8 of the 2026-07-10 spec). All 17 cuisines
  get a matching photo (e.g. biryani for Pakistani, a burger for Burgers,
  shawarma for Shawarma).
  - **Risk flag:** sourcing and verifying 17 correctly-matched, license-clean
    photos is a real content task, not a styling tweak — done during
    implementation with a licensed stock source, each image spot-checked
    that it actually matches its cuisine label before wiring in.
- Broaden the ticket background color set beyond the current 4 neutral tones
  to include gold/tomato/basil tints, for a more vibrant row.
- Keep the existing scroll fan-in (`revealTickets`); upgrade the hover
  micro-interaction: photo zooms slightly, card lifts and un-tilts to 0°,
  shadow blooms — more tactile than the current flat tilt-reset.
- Vary tilt/vertical-offset per card across more than 2 angles (not just
  odd/even alternation) plus slight scale variance, and give each ticket a
  torn/scalloped bottom edge instead of a plain rounded rect, so the row
  reads as scattered tickets rather than a uniform grid.

## 4. Non-goals (unchanged from original spec)

Still out of scope: real login/auth, app functionality, backend, React
Native app, admin portal, in-app payments.

## 5. Success criteria

- Hero reads as visually "full" (no large empty areas) at common viewport
  widths, still fully illustrated (no photos of people).
- Nav renders as a floating rounded bar with the ticket-notched Get Started
  button, functionally unchanged (all links, mobile drawer, sticky behavior).
- Scrolling feels immediately responsive; no perceptible lag between wheel
  input and page movement.
- Every major section has a working scroll-triggered entrance animation;
  content is never hidden if JS/observer never fires.
- Section seams show a colored ribbon divider, varied per boundary, including
  a brown one between How-it-works/Reviews and again into Riders.
- Partner section's kitchen visual is an animated illustration, not a photo.
- Riders section uses the brown theme with legible AA-contrast text/buttons.
- All 17 cuisine tickets show a real, correctly-matched food photo.
- No regressions to existing a11y posture (WCAG AA contrast, keyboard nav,
  reduced-motion fallbacks, no-JS readability) or Vercel static deploy.

## 6. Open items / future

- Real photography for hero/partner sections (still illustration-only per
  this spec) remains a possible future swap, unchanged from the original
  spec's "Open items."
- If stock-photo sourcing for cuisine tickets hits licensing/availability
  issues on a specific cuisine, substitute the nearest reasonable match and
  flag it rather than blocking the rest of the pass.
