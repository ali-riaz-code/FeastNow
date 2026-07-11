# FeastNow Landing — Scroll-Reveal Motion Unification

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)
**Independent of Specs A/B** (backend auth service, auth flow frontend) —
touches only `landing/assets/js/scroll.js`.

## 1. Problem

The hero section's motion (`scrubChoreography`, `heroDepthParallax` in
`scroll.js`) is continuous and scroll/mouse-position-tied — no overshoot,
smooth by construction. The rest of the page's reveals (`revealOnScroll`,
`revealTickets`) use a different mechanism: a one-shot `gsap.from()` tween
with `back.out(1.4–1.7)` easing, fired once by an `IntersectionObserver`
threshold crossing. That's a springy overshoot disconnected from scroll
position/speed — confirmed by the user as reading "weird" next to the hero,
which they confirmed is "perfect."

## 2. Fix

Convert the one-shot reveals to scrub-tied `ScrollTrigger` tweens — the same
mechanism already used for the hero's card drift — instead of independent
triggered animations:

- Each element (or staggered group, e.g. ticket cards) gets a `ScrollTrigger`
  with a short scroll range (e.g. `start: "top 85%", end: "top 55%"`,
  `scrub: 0.4–0.6`) over which opacity and rise animate, instead of firing a
  fixed-duration tween on trigger.
- Drop `back.out()` entirely for these — no overshoot, matching the hero's
  smooth-by-construction feel. Use `ease: "none"` (scrub already provides the
  smoothing) or a gentle `power1.out` where a non-linear feel is wanted.
- Sibling stagger (e.g. cuisine tickets) becomes a slight offset between each
  element's own scroll range (each starts its "top 85%" trigger a little
  later than the previous) rather than a fixed time-delay — so the fan-in
  still reads as sequential, but stays scroll-position-driven like everything
  else.
- Sections affected: `.cuisines__swiper .ticket` (via `revealTickets`),
  `.cuisines__head`, `.how__head`, `.how__phone`, `#how [data-reveal]` (mobile
  path), `.reviews__head`, `.reviews__marquee`, `#partner [data-reveal]`,
  `#riders [data-reveal]`, `.footer__top`.
- The existing scrub-driven elements (`.hero__card--left/right`, `.hex`,
  `.kicker`, `.how__steps .env`, `.partner__stamp`, `.scooter`,
  `.footer__mega`) are untouched — they already work this way.

## 3. Safety property preserved

The current code's guarantee — "content is fully visible by default; nothing
is hidden if JS/the observer never fires" — is preserved and actually
strengthened: with `scrub`, GSAP sets the "from" state once per element based
on the *actual current scroll position* at `ScrollTrigger` creation, not on an
observer callback that could fail to fire. If JS never runs, CSS defaults
keep every element visible (unchanged). `prefers-reduced-motion` continues to
skip all of this, same as today.

## 4. Out of scope

- `navHideShow`, `countUp`, `initCarousel`, `heroDepthParallax` — unaffected.
- Any new sections/content — this is a motion-mechanism swap only, no visual
  redesign.
