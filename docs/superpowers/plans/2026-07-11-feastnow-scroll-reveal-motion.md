# FeastNow Scroll-Reveal Motion Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rest of the landing page's scroll-reveal motion feel like the hero's already-approved motion — continuous and scroll-position-tied — instead of the current one-shot `back.out()` bounce.

**Architecture:** Convert `revealOnScroll`/`revealTickets` in `landing/assets/js/scroll.js` from `IntersectionObserver` + one-shot `gsap.from()` tweens to `ScrollTrigger`-scrubbed `gsap.to()` tweens (the same mechanism already used for the hero's card drift), with GSAP's built-in `stagger` replacing the current time-delay stagger.

**Tech Stack:** Vanilla JS, GSAP + ScrollTrigger (already a dependency via `assets/js/main.js`/`vendor`). No new dependencies, no build step — this is a plain static site.

## Global Constraints

- `prefers-reduced-motion` must continue to disable all of this (existing guard, do not remove).
- Content must remain fully visible if JS/GSAP/ScrollTrigger never load — no CSS pre-hiding (existing safety property, do not break it).
- No new libraries. Only `landing/assets/js/scroll.js` changes.
- No overshoot/bounce easing (`back.out(...)`) anywhere in the converted functions.

---

### Task 1: Rewrite `revealOnScroll` as a scrubbed, staggered reveal

**Files:**
- Modify: `landing/assets/js/scroll.js:46-62` (the `revealOnScroll` function)

**Interfaces:**
- Produces: `revealOnScroll(selector, from, opts)` — same public signature as before (`from: { y?, rotation? }`, `opts: { trigger?, start?, end?, scrub?, stagger?, ease? }`), so every existing call site in `initScroll()` keeps working once Task 2 removes the now-obsolete `ease: "back.out(...)"` overrides.
- Consumed by: `revealTickets` (Task 2) and every `revealOnScroll(...)` call in `initScroll()` (Task 2).

- [ ] **Step 1: Replace the function body**

Replace the existing `revealOnScroll` function (currently `landing/assets/js/scroll.js:46-62`):

```js
export function revealOnScroll(selector, from = {}, opts = {}) {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.from(entry.target, {
        y: "+=34", opacity: 0, ...from,
        duration: opts.duration ?? 0.7,
        ease: opts.ease ?? "back.out(1.4)",
        delay: (i % 4) * (opts.stagger ?? 0.09),
        clearProps: "all",
      });
    });
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}
```

with:

```js
/* ---- scrub-tied reveal (matches the hero's card-drift feel: continuous,
   scroll-position-driven, no independent pop/bounce) ----
   Captures each element's own resting y/rotation first, then scrubs from
   "resting + offset, hidden" to "resting, visible" across a short scroll
   range on a shared trigger, with GSAP's stagger sequencing siblings. */
export function revealOnScroll(selector, from = {}, opts = {}) {
  if (prefersReducedMotion || !gsap || !ScrollTrigger) return;
  const els = gsap.utils.toArray(selector);
  if (!els.length) return;

  const riseBy = from.y ? parseFloat(String(from.y).replace("+=", "")) : 0;
  const rotateBy = from.rotation ? parseFloat(String(from.rotation).replace("+=", "")) : 0;
  const trigger = opts.trigger
    ? document.querySelector(opts.trigger)
    : (els[0].closest("section") || els[0]);

  const rest = els.map((el) => ({
    y: gsap.getProperty(el, "y"),
    rotation: gsap.getProperty(el, "rotation"),
  }));

  els.forEach((el, i) => {
    gsap.set(el, { y: rest[i].y + riseBy, rotation: rest[i].rotation + rotateBy, opacity: 0 });
  });

  gsap.to(els, {
    y: (i) => rest[i].y,
    rotation: (i) => rest[i].rotation,
    opacity: 1,
    ease: opts.ease ?? "none",
    stagger: opts.stagger ?? 0.06,
    scrollTrigger: {
      trigger,
      start: opts.start ?? "top 85%",
      end: opts.end ?? "top 55%",
      scrub: opts.scrub ?? 0.5,
    },
  });
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run: `node --check landing/assets/js/scroll.js`
Expected: no output, exit code 0. (This file uses ES module `import`/`export` syntax, so `node --check` validates syntax only — it won't execute the module-resolution imports, which is fine; we're only checking for typos.)

- [ ] **Step 3: Commit**

```bash
git add landing/assets/js/scroll.js
git commit -m "feat(landing): convert revealOnScroll to a scrub-tied, non-bouncy reveal"
```

---

### Task 2: Simplify `revealTickets` and update call sites

**Files:**
- Modify: `landing/assets/js/scroll.js:64-81` (the `revealTickets` function)
- Modify: `landing/assets/js/scroll.js` inside `initScroll()` (the block of `revealOnScroll(...)` calls, currently around lines 279-289)

**Interfaces:**
- Consumes: `revealOnScroll` (Task 1).
- Produces: nothing new exported — `revealTickets` keeps its existing no-argument signature, still called from `initScroll()`.

- [ ] **Step 1: Replace `revealTickets`**

Replace the existing function (currently `landing/assets/js/scroll.js:64-81`):

```js
/* ---- staggered ticket fan-in for the cuisine carousel ---- */
function revealTickets() {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const wrap = document.querySelector(".cuisines__swiper");
  if (!wrap) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.from(".cuisines__swiper .ticket", {
        y: "+=46", rotation: "+=5", opacity: 0,
        duration: 0.65, ease: "back.out(1.6)", stagger: 0.05,
        clearProps: "transform,opacity",
      });
    });
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
  io.observe(wrap);
}
```

with:

```js
/* ---- staggered ticket fan-in for the cuisine carousel (now a thin
   wrapper over the shared scrub-tied reveal) ---- */
function revealTickets() {
  revealOnScroll(".cuisines__swiper .ticket", { y: "+=46", rotation: "+=5" }, {
    trigger: ".cuisines__swiper", stagger: 0.05, start: "top 90%", end: "top 65%",
  });
}
```

- [ ] **Step 2: Remove the now-obsolete `back.out` ease overrides in `initScroll()`**

Find this block inside `initScroll()` (currently around `landing/assets/js/scroll.js:279-289`):

```js
  // one-shot pops (back.out family, rotation scatter on card-like elements)
  revealTickets();
  revealOnScroll(".cuisines__head", { y: "+=30" });
  revealOnScroll(".how__head", { y: "+=30" });
  revealOnScroll(".how__phone", { y: "+=40", rotation: "+=3" }, { ease: "back.out(1.7)" });
  if (!wide) revealOnScroll("#how [data-reveal]", { y: "+=44", rotation: "+=4" }, { ease: "back.out(1.7)" });
  revealOnScroll(".reviews__head", { y: "+=30" });
  revealOnScroll(".reviews__marquee", { y: "+=20" });
  revealOnScroll("#partner [data-reveal]", { y: "+=36", rotation: "+=2" }, { ease: "back.out(1.5)" });
  revealOnScroll("#riders [data-reveal]", { y: "+=36" });
  revealOnScroll(".footer__top", { y: "+=26" });
```

Replace it with:

```js
  // scrub-tied reveals (same continuous, non-bouncy feel as the hero)
  revealTickets();
  revealOnScroll(".cuisines__head", { y: "+=30" });
  revealOnScroll(".how__head", { y: "+=30" });
  revealOnScroll(".how__phone", { y: "+=40", rotation: "+=3" });
  if (!wide) revealOnScroll("#how [data-reveal]", { y: "+=44", rotation: "+=4" });
  revealOnScroll(".reviews__head", { y: "+=30" });
  revealOnScroll(".reviews__marquee", { y: "+=20" });
  revealOnScroll("#partner [data-reveal]", { y: "+=36", rotation: "+=2" });
  revealOnScroll("#riders [data-reveal]", { y: "+=36" });
  revealOnScroll(".footer__top", { y: "+=26" }, { trigger: ".footer" });
```

(`.footer__top` gets an explicit `trigger: ".footer"` because the footer is a `<footer>` element, not a `<section>` — `closest("section")` would fail to find one, same reason the existing `.footer__mega` scrub tween already targets `trigger: ".footer"` a few lines below this block.)

- [ ] **Step 3: Verify the file has no syntax errors**

Run: `node --check landing/assets/js/scroll.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add landing/assets/js/scroll.js
git commit -m "refactor(landing): simplify revealTickets and drop back.out overrides"
```

---

### Task 3: Manual verification against the hero's feel

**Files:** none (verification only).

- [ ] **Step 1: Serve the landing site locally**

Run (from the repo root): `npx --yes serve landing -l 5500`
Expected: prints a local URL, e.g. `http://localhost:5500`.

- [ ] **Step 2: Visually verify each converted section**

Open `http://localhost:5500` in a desktop browser and scroll slowly through the page, pausing mid-scroll in each section. For the cuisine tickets, "How it works," reviews, partner, riders, and footer sections, confirm:
- Elements fade/rise into place smoothly as you scroll — pausing mid-scroll shows a partially-revealed element (partial opacity/offset), not an element that's already snapped fully in or still fully hidden.
- No springy overshoot: elements never move past their final resting position and settle back.
- The ticket cards in the cuisine carousel fan in sequentially, not all at once, matching the previous stagger feel.
- Scrolling back up smoothly reverses the reveal (a natural consequence of `scrub`, unlike the old one-shot version which never re-hid content on scroll-up — confirm this reversal doesn't look jarring; it shouldn't, since it's the same mechanism already used for the hero cards).
- The motion reads consistent with the hero section's card-drift and mouse-parallax feel.

- [ ] **Step 3: Verify the reduced-motion fallback still works**

Enable "reduce motion" in your OS accessibility settings (Windows: Settings → Accessibility → Visual effects → Animation effects → off), reload the page, and confirm every section's content is immediately fully visible with no animation.

- [ ] **Step 4: Stop the local server**

Press `Ctrl+C` in the terminal running `serve`.

- [ ] **Step 5: Report the result**

If all checks in Steps 2–3 pass, this plan is complete — no further commits needed (Tasks 1–2 already committed the code). If something looks off (e.g. a section's `closest("section")` trigger resolves unexpectedly because that section isn't actually a `<section>` tag), fix the specific `revealOnScroll(...)` call in `initScroll()` to pass an explicit `{ trigger: "#id-or-.class" }`, matching the pattern already used for `.footer__top`, then re-run Steps 1–3.
