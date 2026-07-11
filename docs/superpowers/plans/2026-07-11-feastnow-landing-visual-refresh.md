# FeastNow Landing Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the shipped FeastNow landing page up to pizza-amici.nl visual fidelity: full hero collage, floating pill nav with ticket CTA, snappier scroll, colored seam dividers, animated kitchen, brown riders theme, real cuisine photos, and complete scroll-reveal coverage.

**Architecture:** Pure static site (no build step) in `landing/` — vanilla HTML + CSS + JS with vendored GSAP/ScrollTrigger/Lenis/Swiper. All changes are edits to `landing/index.html`, `landing/assets/css/main.css`, `landing/assets/js/main.js`, `landing/assets/js/intro.js`, `landing/assets/js/scroll.js`, plus 17 downloaded photos.

**Tech Stack:** HTML/CSS/JS, GSAP + ScrollTrigger, Lenis, Swiper. Deployed by Vercel on push to `main`.

**Spec:** `docs/superpowers/specs/2026-07-11-feastnow-landing-visual-refresh-design.md`

## Global Constraints

- No build step, no runtime CDN requests — every asset self-hosted under `landing/assets/`.
- WCAG 2.1 AA contrast; keyboard navigable; visible focus rings (`:focus-visible` already global).
- Every animation needs a `prefers-reduced-motion: reduce` fallback (add new animation selectors to the existing block at the end of `main.css`).
- Content must never be hidden if JS/IntersectionObserver never fires (reveals hide elements only at tween start — the existing `revealOnScroll` contract).
- Mono font (`.num`) for numerics only, never body copy.
- Hero stays fully illustrated — no photos of people, no stock photos in the hero.
- Test in a browser before every push. Vercel auto-deploys `main` — per repo rules, commit AND push after each verified task.
- There is no test framework; verification = local server + browser check + targeted grep/curl assertions. Serve with: `cd landing && python -m http.server 8080` (use `py -m http.server 8080` if `python` is missing on Windows).

**A note on verification:** most steps here are visual. Where a browser screenshot tool is unavailable, verify structurally (grep for the exact class/attribute in the file, load the URL with curl for a 200 + expected markup) and do one manual visual pass per task in a real browser before committing.

---

### Task 1: Snappier scroll (Lenis tuning)

**Files:**
- Modify: `landing/assets/js/main.js:20-24`

**Interfaces:**
- Produces: no API change — `lenis` export behaves identically, just faster settle.

- [ ] **Step 1: Change the Lenis config**

In `landing/assets/js/main.js`, replace:

```js
  lenis = new window.Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
```

with:

```js
  lenis = new window.Lenis({
    duration: 0.8,                               // was 1.15 — page felt laggy behind the wheel
    easing: (t) => 1 - Math.pow(1 - t, 4),       // ease-out-quart: settles sooner than expo
    smoothWheel: true,
    wheelMultiplier: 1.3,                        // more page-travel per wheel notch
  });
```

- [ ] **Step 2: Verify in the browser**

Run: `cd landing && python -m http.server 8080`, open `http://localhost:8080`.
Expected: wheel scrolling tracks input almost immediately (no long glide after you stop), still smooth, no jitter. Check DevTools console for zero errors. Also confirm reduced-motion still bypasses Lenis: in DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, reload — scrolling must be native.

- [ ] **Step 3: Commit and push**

```bash
git add landing/assets/js/main.js
git commit -m "fix(landing): snappier Lenis scroll — shorter duration, quart ease, wheel multiplier"
git push
```

---

### Task 2: Floating pill nav + ticket-shaped Get Started

**Files:**
- Modify: `landing/index.html:64-89` (nav markup)
- Modify: `landing/assets/css/main.css:186-219` (nav styles)

**Interfaces:**
- Consumes: existing `.btn`/`.btn--gold` button system, `#nav` scroll listener in `main.js` (`is-scrolled` class — unchanged JS).
- Produces: `.btn--ticket` modifier (notched ticket shape) and `.nav__dash` separator — Task 9 checks these exist on the page.

- [ ] **Step 1: Update the nav markup**

In `landing/index.html`, replace the desktop links block (lines 71-77):

```html
      <nav class="nav__links" aria-label="Primary">
        <a href="#cuisines">Cuisines</a>
        <a href="#how">How it works</a>
        <a href="#partner">For Restaurants</a>
        <a href="#riders">For Riders</a>
        <span class="nav__dash" aria-hidden="true"></span>
        <a class="btn btn--gold btn--ticket" href="login.html"><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
      </nav>
```

(The only changes: new `.nav__dash` span, and `btn--ticket` added to the nav CTA. Drawer CTA at line 87 stays a plain `btn--gold`.)

- [ ] **Step 2: Restyle the nav as a floating pill**

In `landing/assets/css/main.css`, replace the `.nav` block (lines 189-194) and drawer rule (line 218):

```css
.nav {
  position: sticky; top: 10px; z-index: var(--z-nav);
  padding-inline: clamp(10px, 2vw, 24px); /* inset: page bg shows around the pill */
}
.nav__row {
  background: var(--cream);
  border-radius: var(--r-pill);
  box-shadow: var(--sh-raised);
  padding-inline: clamp(1.1rem, 2.5vw, 1.9rem);
  transition: box-shadow var(--dur);
}
.nav.is-scrolled .nav__row { box-shadow: var(--sh-overlay); }
```

Note: `.nav__row` also carries `.container` (max-width + centering) — keep both classes; the pill just paints on top of it. Delete the old `.nav { background: transparent; transition: ... }` and `.nav.is-scrolled { background: var(--cream); ... }` rules entirely.

Replace the `.nav__drawer` rule (line 218) with a rounded card:

```css
.nav__drawer {
  display: flex; flex-direction: column; gap: .5rem;
  margin: 8px clamp(10px, 2vw, 24px) 0;
  padding: 1rem 1.25rem 1.5rem;
  background: var(--cream);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-overlay);
}
```

- [ ] **Step 3: Add the dash + ticket-notch styles**

Append to the nav section of `main.css` (after the drawer rules):

```css
/* dash separator before the nav CTA — echoes the reference's notch-dash */
.nav__dash { width: 20px; height: 3px; border-radius: 2px; background: var(--navy); flex: none; }

/* ticket-shaped CTA: straight corners + punched semicircle notches.
   Notches are bg-colored dots (same trick as .ticket perforations) so they
   only read correctly on the cream nav pill — nav-only modifier by design. */
.btn--ticket { border-radius: 10px; }
.btn--ticket:hover { box-shadow: none; } /* punched notches would expose a rectangular shadow */
.btn--ticket::before, .btn--ticket::after {
  content: ""; position: absolute; top: 50%; translate: 0 -50%;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--cream);
}
.btn--ticket::before { left: -7px; }
.btn--ticket::after { right: -7px; }
```

- [ ] **Step 4: Verify**

Reload `http://localhost:8080`. Expected:
- Nav renders as a rounded cream bar floating with visible page background on both sides and above (10px gap when stuck to top).
- Get Started in the nav has flat-ish corners with a half-circle bite on its left and right edges, and a short navy dash before it.
- Scroll down: bar stays floating, shadow deepens, links + burger still work; mobile width (<880px per existing media query) shows the burger and the drawer opens as a rounded card.
- `grep -c "btn--ticket" landing/index.html` → `1`.

- [ ] **Step 5: Commit and push**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): floating pill nav with dash + ticket-notched Get Started"
git push
```

---

### Task 3: Hero rebuild — big cart stage, hexagon badge, flanking cards

**Files:**
- Modify: `landing/index.html:92-222` (hero section)
- Modify: `landing/assets/css/main.css:231-313` (hero styles)
- Modify: `landing/assets/js/intro.js:34-51` (hero timeline selectors)

**Interfaces:**
- Consumes: `#feastnow-hat` SVG symbol, `.btn` system, `.script`/`.num` type helpers, `.cart__steam`/`.cart__bulb`/`.cart__wheel` animation classes.
- Produces: `.hero__stage`, `.hex` (replaces `.sticker` — intro.js updated in this task), `.hero__card--left`, `.hero__card--right`. Task 8/9 reference these names.

- [ ] **Step 1: Restructure the hero HTML**

In `landing/index.html`, replace the whole hero section (lines 93-222) with the following. Changes: copy block is now centered on its own row; the cart fills the width below it inside a new `.hero__stage`; the awning goes navy; a brass center pole + ORDER HERE placard and a checkered cloth are added to the SVG; the `.sticker` becomes the `.hex` badge; two flanking cards are added.

```html
    <section class="hero" id="hero">
      <div class="container">
        <div class="hero__copy">
          <p class="script hero__tag">the fastest way to eat in your city</p>
          <h1 class="hero__title">
            <span class="w">The</span>
            <span class="w">wh<span class="glyph-o">o</span>le</span>
            <span class="w">city,</span>
            <span class="w">on</span>
            <span class="w"><span class="glyph-o">o</span>ne</span>
            <span class="w">menu.</span>
          </h1>
          <p class="hero__sub">Browse every approved kitchen near you, build your order in a few taps, and track your rider live to the door. Pay cash when it arrives.</p>
          <div class="hero__cta">
            <a class="btn btn--gold btn--lg" href="login.html"><span class="btn__roll"><span>Get Started</span><span aria-hidden="true">Get Started</span></span></a>
            <a class="btn btn--ghost btn--lg" href="#cuisines"><span class="btn__roll"><span>Explore cuisines</span><span aria-hidden="true">Explore cuisines</span></span></a>
          </div>
        </div>

        <div class="hero__stage">
          <!-- FeastNow food cart illustration -->
          <svg class="cart" viewBox="0 0 680 470" role="img" aria-label="Illustration of the FeastNow food cart">
            <defs>
              <pattern id="checker" width="14" height="14" patternUnits="userSpaceOnUse">
                <rect width="14" height="14" fill="#FFFCF0"/>
                <rect width="7" height="7" fill="#33507E"/>
                <rect x="7" y="7" width="7" height="7" fill="#33507E"/>
              </pattern>
            </defs>
            <!-- ground shadow -->
            <ellipse cx="345" cy="442" rx="255" ry="15" fill="rgba(15,44,86,.10)"/>
            <!-- push handle -->
            <path d="M118 268 Q76 250 64 214" fill="none" stroke="#4F3C2C" stroke-width="9" stroke-linecap="round"/>
            <circle cx="64" cy="214" r="9" fill="#4F3C2C"/>
            <!-- awning poles -->
            <line x1="152" y1="112" x2="152" y2="240" stroke="#4F3C2C" stroke-width="7"/>
            <line x1="528" y1="112" x2="528" y2="240" stroke="#4F3C2C" stroke-width="7"/>
            <!-- brass center pole (drawn before the glass case so it shows through the glass) -->
            <line x1="340" y1="128" x2="340" y2="248" stroke="#D9A82E" stroke-width="6"/>
            <!-- roof sign -->
            <g class="cart__sign">
              <rect x="206" y="26" width="268" height="48" rx="12" fill="#ECE6E1" stroke="#0F2C56" stroke-width="3"/>
              <svg x="222" y="36" width="28" height="28" viewBox="0 0 64 64" style="color:#0F2C56"><use href="#feastnow-hat"></use></svg>
              <text x="352" y="60" text-anchor="middle" font-size="28" fill="#0F2C56" font-weight="640" style="font-family:var(--font-display)">FeastNow</text>
            </g>
            <!-- flag -->
            <line x1="536" y1="58" x2="536" y2="112" stroke="#4F3C2C" stroke-width="5" stroke-linecap="round"/>
            <path d="M536 58 L584 68 L536 82 Z" fill="#128643"/>
            <!-- awning: scalloped, striped — navy/white like the reference -->
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
            <!-- string lights -->
            <path d="M152 138 Q340 176 528 138" fill="none" stroke="#4F3C2C" stroke-width="2.5"/>
            <circle class="cart__bulb" cx="230" cy="152" r="5" fill="#E3AF04"/>
            <circle class="cart__bulb" cx="303" cy="161" r="5" fill="#E3AF04"/>
            <circle class="cart__bulb" cx="377" cy="161" r="5" fill="#E3AF04"/>
            <circle class="cart__bulb" cx="450" cy="152" r="5" fill="#E3AF04"/>
            <!-- ORDER HERE placard on the brass pole (in front of the lights) -->
            <g class="cart__placard">
              <rect x="279" y="132" width="122" height="27" rx="7" fill="#0F2C56" stroke="#E3AF04" stroke-width="2"/>
              <text x="340" y="150.5" text-anchor="middle" font-size="13" font-weight="700" fill="#E3AF04" letter-spacing="2.5" style="font-family:var(--font-sans)">ORDER HERE</text>
            </g>
            <!-- checkered cloth draped on the right pole -->
            <g class="cart__cloth">
              <path d="M504 150 q24 -12 48 0 l8 62 q-32 16 -64 0 Z" fill="url(#checker)" stroke="#0F2C56" stroke-width="2" stroke-opacity=".3"/>
            </g>
            <!-- steam above the cloches -->
            <g class="cart__steam" fill="none" stroke="#D4C29A" stroke-width="5" stroke-linecap="round">
              <path d="M232 158 q-8 -14 0 -26 q8 -12 0 -24"/>
              <path d="M262 166 q-8 -14 0 -26 q8 -12 0 -24"/>
            </g>
            <!-- glass display case with dishes -->
            <rect x="158" y="168" width="212" height="76" rx="10" fill="#C0DEEE" opacity=".5" stroke="#ECE6E1" stroke-width="4"/>
            <g>
              <path d="M198 232 a26 22 0 0 1 52 0 Z" fill="#E3AF04"/>
              <rect x="190" y="230" width="68" height="7" rx="3.5" fill="#ECE6E1"/>
              <path d="M282 232 a26 22 0 0 1 52 0 Z" fill="#E3AF04"/>
              <rect x="274" y="230" width="68" height="7" rx="3.5" fill="#ECE6E1"/>
            </g>
            <!-- chalkboard menu -->
            <g>
              <rect x="398" y="164" width="118" height="80" rx="9" fill="#2F241A" stroke="#ECE6E1" stroke-width="3"/>
              <text x="457" y="192" text-anchor="middle" font-size="20" fill="#ECE6E1" style="font-family:var(--font-script)">menu</text>
              <line x1="414" y1="208" x2="500" y2="208" stroke="#ECE6E1" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
              <line x1="414" y1="222" x2="482" y2="222" stroke="#ECE6E1" stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
            </g>
            <!-- cart body -->
            <rect x="120" y="248" width="440" height="126" rx="16" fill="#0F2C56"/>
            <rect x="102" y="248" width="476" height="16" rx="8" fill="#ECE6E1"/>
            <!-- body details: name + tricolore -->
            <text x="340" y="322" text-anchor="middle" font-size="30" fill="#FFFCF0" style="font-family:var(--font-script)">fresh &amp; fast</text>
            <g>
              <rect x="506" y="288" width="12" height="20" rx="2" fill="#128643"/>
              <rect x="518" y="288" width="12" height="20" rx="2" fill="#FFFCF0"/>
              <rect x="530" y="288" width="12" height="20" rx="2" fill="#C72531"/>
            </g>
            <!-- wheel fenders -->
            <path d="M154 374 a52 52 0 0 1 104 0 Z" fill="#1B2F5E"/>
            <path d="M434 374 a52 52 0 0 1 104 0 Z" fill="#1B2F5E"/>
            <!-- wheels -->
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
          </svg>

          <!-- hexagon reviews ticket (replaces the old round sticker) -->
          <a class="hex" href="#reviews" aria-label="Rated 4.6 stars — read reviews">
            <span class="hex__body">
              <span class="hex__inner">
                <span class="hex__reviews">Reviews <span class="hex__stars" aria-hidden="true">★★★★★</span> <span class="num">4.6</span></span>
                <span class="hex__line">The whole city&rsquo;s menu, in your pocket</span>
              </span>
            </span>
          </a>

          <!-- flanking cards (decorative duplicates of ticker/CTA content) -->
          <aside class="hero__card hero__card--left" aria-hidden="true">
            <svg class="hero__card-art" viewBox="0 0 64 64" style="color:var(--tomato)"><use href="#feastnow-hat"></use></svg>
            <p class="num hero__card-big">3,000+</p>
            <p class="hero__card-label">restaurants onboard</p>
            <p class="script hero__card-script">join the feast —</p>
          </aside>
          <aside class="hero__card hero__card--right">
            <p class="hero__card-copy">Every approved kitchen near you, one feed. Hot food, live rider tracking, cash at the door.</p>
            <a class="btn btn--gold hero__card-btn" href="login.html">Get Started</a>
          </aside>
        </div>
      </div>
      <a class="hero__scroll" href="#cuisines" aria-label="Scroll to explore cuisines">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16m0 0l-6-6m6 6l6-6"/></svg>
      </a>
    </section>
```

- [ ] **Step 2: Replace the hero CSS**

In `landing/assets/css/main.css`, replace the hero block (the `.hero` … `.sticker` … media-query rules, lines 231-313) with:

```css
/* ==========================================================================
   Hero — centered copy over a full-width cart stage with badge + side cards
   ========================================================================== */
.hero { padding-block: clamp(24px, 4vw, 48px) clamp(88px, 11vw, 150px); }
.hero__copy { text-align: center; max-width: 780px; margin-inline: auto; }
.hero__tag { font-size: clamp(1.4rem, 2.5vw, 1.8rem); margin-bottom: .6rem; }
.hero__title {
  font-size: clamp(2.75rem, 6.2vw, 5rem);
  font-weight: 750;
  line-height: .98;
  letter-spacing: -0.03em;
  font-variation-settings: "SOFT" 90, "WONK" 1;
}
.hero__title .w { display: inline-block; }
.glyph-o {
  display: inline-block; color: var(--tomato);
  transform: rotate(-8deg);
  transition: transform .6s var(--ease-out-expo);
}
.hero__title:hover .glyph-o { transform: rotate(352deg); }
.hero__sub { max-width: 50ch; margin: 1.2rem auto 0; color: var(--brown); font-size: 1.125rem; }
.hero__cta { display: flex; flex-wrap: wrap; justify-content: center; gap: .8rem; margin-top: 1.8rem; }

/* the stage: big cart with overlapping hexagon + side cards */
.hero__stage { position: relative; margin-top: clamp(1.5rem, 4vw, 3rem); }
.hero__stage .cart { width: min(100%, 960px); height: auto; display: block; margin-inline: auto; }
.cart__wheel { transform-box: fill-box; transform-origin: center; }
.cart__bulb { animation: bulb 2.4s ease-in-out infinite; }
.cart__bulb:nth-of-type(2) { animation-delay: .6s; }
.cart__bulb:nth-of-type(3) { animation-delay: 1.2s; }
.cart__bulb:nth-of-type(4) { animation-delay: 1.8s; }
@keyframes bulb { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.cart__steam path { animation: steam 3s ease-in-out infinite; }
.cart__steam path + path { animation-delay: 1.5s; }
@keyframes steam {
  0% { opacity: 0; transform: translateY(6px); }
  35% { opacity: .9; }
  100% { opacity: 0; transform: translateY(-10px); }
}
.cart__cloth {
  transform-box: fill-box; transform-origin: 50% 8%;
  animation: cloth-sway 4s ease-in-out infinite alternate;
}
@keyframes cloth-sway { from { transform: rotate(-2.5deg); } to { transform: rotate(2.5deg); } }

/* hexagon reviews ticket — layered clip-paths fake the navy border line */
.hex {
  position: absolute; left: 50%; bottom: -7%;
  translate: -50% 0; /* CSS translate, not transform — GSAP scale/rotate tweens won't clobber it */
  width: clamp(280px, 42vw, 440px);
  filter: drop-shadow(0 12px 26px rgba(15, 44, 86, .22));
  z-index: 3;
  transition: scale .35s var(--ease-out-expo);
}
.hex:hover { scale: 1.04; }
.hex__body {
  display: block;
  background: var(--navy);
  clip-path: polygon(0 50%, 9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%);
  padding: 5px;
}
.hex__inner {
  display: grid; gap: .3rem; justify-items: center; text-align: center;
  background: var(--cream); color: var(--navy);
  clip-path: polygon(0 50%, 9% 0, 91% 0, 100% 50%, 91% 100%, 9% 100%);
  padding: clamp(1.1rem, 2.5vw, 1.5rem) clamp(2rem, 5vw, 3rem);
}
.hex__reviews { font-size: .82rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.hex__stars { color: var(--gold-deep); letter-spacing: .12em; }
.hex__line {
  font-family: var(--font-display);
  font-weight: 800; font-variation-settings: "SOFT" 60, "WONK" 1;
  font-size: clamp(1.05rem, 2.1vw, 1.45rem);
  line-height: 1.1; text-transform: uppercase; letter-spacing: .01em;
}

/* flanking cards */
.hero__card {
  position: absolute; z-index: 2;
  width: clamp(150px, 17vw, 215px);
  background: var(--cream);
  border-radius: 12px;
  padding: 1.1rem 1rem 1.3rem;
  box-shadow: var(--sh-overlay);
  text-align: center;
  transition: transform .35s var(--ease-out-expo);
}
.hero__card--left {
  left: 0; bottom: 16%;
  border: 6px solid #fff; /* polaroid frame */
  transform: rotate(-7deg);
}
.hero__card--left:hover { transform: rotate(-4deg) translateY(-6px); }
.hero__card-art { width: 44px; height: 44px; margin-bottom: .3rem; }
.hero__card-big { font-size: 1.7rem; font-weight: 600; line-height: 1.1; }
.hero__card-label { font-size: .82rem; font-weight: 600; color: var(--brown); }
.hero__card-script { font-size: 1.15rem; margin-top: .35rem; }
.hero__card--right {
  right: 0; bottom: 12%;
  background: var(--sky); color: var(--navy);
  transform: rotate(3deg);
  font-size: .85rem; font-weight: 500; line-height: 1.45;
  text-align: left;
  padding-bottom: 2rem; /* room for the peeking button */
}
.hero__card--right:hover { transform: rotate(1deg) translateY(-6px); }
.hero__card-btn {
  position: absolute; left: 50%; bottom: -20px;
  transform: translateX(-50%) rotate(-2deg);
  min-height: 40px; padding: 0 1.2rem; font-size: .88rem;
}
.hero__card-btn:hover { transform: translateX(-50%) rotate(0deg) translateY(-2px); }

.hero__scroll {
  display: grid; place-items: center;
  width: 48px; height: 48px; margin: clamp(2.5rem, 6vw, 4rem) auto 0;
  color: var(--navy); border: 2px solid var(--beige); border-radius: 50%;
  transition: border-color var(--dur), transform var(--dur);
  animation: nudge 2.6s ease-in-out infinite;
}
.hero__scroll:hover { border-color: var(--gold); }
@keyframes nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }

@media (max-width: 640px) {
  .hero__card { display: none; } /* keep the small-screen stage uncluttered */
  .hex { bottom: -9%; }
}
```

- [ ] **Step 3: Update the intro timeline**

In `landing/assets/js/intro.js`, replace the sticker tween (lines 46-50) with hex + cards:

```js
    // fromTo + clearProps: these carry CSS hover transitions, so the tween
    // must own the inline transform and then remove it. .hex is positioned
    // with the CSS `translate` property, which GSAP transforms leave alone.
    tl.fromTo(".hex",
      { scale: 0, rotation: -8, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", clearProps: "all" }, "-=0.35");
    tl.from(".hero__card", { y: 34, opacity: 0, duration: 0.45, stagger: 0.12, clearProps: "all" }, "-=0.3");
```

Also update the cart entrance selector on line 43-44: `.hero__art .cart__wheel` no longer exists — change to `.hero__stage .cart__wheel`:

```js
    const wheels = qa(".hero__stage .cart__wheel");
```

- [ ] **Step 4: Add reduced-motion coverage**

In the `@media (prefers-reduced-motion: reduce)` block at the end of `main.css`, update the two hero-related lines:

```css
  .cart__bulb, .cart__steam path, .scooter__whoosh line, .cart__cloth,
  .phone__route, .phone__pulse, .is-live .phone__dot,
  .hero__scroll { animation: none; }
```

and in the transition-suppression list replace `.sticker` with the new pieces:

```css
  .glyph-o, .ticket, .ticket__icon, .env, .env__seal, .quote,
  .hex, .hero__card, .btn, .footer__col a, .footer__social a { transition: none; }
```

- [ ] **Step 5: Verify**

Reload the page (normal motion): intro plays, cart rolls in, hexagon pops with a back-out bounce, side cards rise in. Expected layout: centered headline block; cart ~960px wide; hexagon overlapping the cart's bottom center with an "OK-looking" navy border line; polaroid stat card overlapping the left edge (tilted), sky info card on the right with a gold button hanging off its bottom edge. Check:
- Hexagon link goes to `#reviews`; card button goes to `login.html`; both keyboard-focusable with visible focus ring.
- 375px-wide viewport: side cards hidden, hexagon still fits, no horizontal scrollbar.
- Reduced-motion emulation: no intro, everything visible and static.
- `grep -c "sticker" landing/index.html landing/assets/js/intro.js` → 0 in both.
- Console: zero errors.

- [ ] **Step 6: Commit and push**

```bash
git add landing/index.html landing/assets/css/main.css landing/assets/js/intro.js
git commit -m "feat(landing): hero collage — full-width cart stage, ORDER HERE placard, checkered cloth, hexagon reviews ticket, flanking cards"
git push
```

---

### Task 4: Section-seam ribbon dividers

**Files:**
- Modify: `landing/assets/css/main.css:101-105` (`.sec-cap`)

**Interfaces:**
- Consumes: existing `.sec-cap` sections: `#cuisines`, `#how`, `#reviews`, `#partner`, `#riders`, `.footer`.
- Produces: `--seam-base` / `--seam-dash` custom-property contract per section.

- [ ] **Step 1: Add the seam ribbon**

After the `.sec-cap` rule in `main.css`, add:

```css
/* seam ribbon: two offset rows of dashes on a colored band, one per section
   boundary (reference: pizza-amici's navy/cream brick divider). Static, cheap. */
.sec-cap::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 18px;
  border-radius: inherit;
  background-color: var(--seam-base, var(--navy));
  background-image:
    repeating-linear-gradient(90deg, var(--seam-dash, var(--cream)) 0 42px, transparent 42px 100px),
    repeating-linear-gradient(90deg, var(--seam-dash, var(--cream)) 0 42px, transparent 42px 100px);
  background-size: 100% 5px, 100% 5px;
  background-position: 0 3px, 50px 10px;
  background-repeat: repeat-x, repeat-x;
  pointer-events: none;
}

/* per-boundary colors — every partition gets its own pair */
#cuisines { --seam-base: var(--navy);       --seam-dash: var(--cream); }
#how      { --seam-base: var(--gold);       --seam-dash: var(--navy); }
#reviews  { --seam-base: var(--brown);      --seam-dash: var(--cream); } /* the requested brown crevice */
#partner  { --seam-base: var(--tomato);     --seam-dash: var(--cream); }
#riders   { --seam-base: var(--brown-deep); --seam-dash: var(--gold); }
.footer.sec-cap { --seam-base: var(--cream); --seam-dash: var(--navy); }
```

- [ ] **Step 2: Verify**

Scroll the full page. Expected: at each rounded section seam a thin banded ribbon with two offset dash rows, colors differing per boundary — navy/cream into Cuisines, gold/navy into How-it-works, **brown/cream into Reviews**, tomato/cream into Restaurants, deep-brown/gold into Riders, cream/navy into the footer. Ribbon follows the rounded corners (border-radius inherit). No layout shift (sections already have ≥64px top padding).

- [ ] **Step 3: Commit and push**

```bash
git add landing/assets/css/main.css
git commit -m "feat(landing): colored seam ribbons at every section boundary, brown crevice into reviews"
git push
```

---

### Task 5: Riders section — brown theme + scale texture

**Files:**
- Modify: `landing/index.html:399` (section class)
- Modify: `landing/assets/css/main.css:91-95` (themes) and `560-579` (riders)

**Interfaces:**
- Consumes: `--brown` / `--brown-deep` tokens, `.perks` list, `.btn--gold`.
- Produces: `.theme-brown` (reusable section theme).

- [ ] **Step 1: Switch the section theme in HTML**

Line 399 of `index.html`:

```html
    <section class="riders section sec-cap theme-brown" id="riders">
```

- [ ] **Step 2: Define the theme + texture in CSS**

Add after `.theme-gold` (line 95):

```css
.theme-brown  { --bg: var(--brown);  --ink: var(--cream); --muted: rgba(255, 252, 240, .85); --script-ink: var(--gold); }
```

Add in the riders CSS section (after `.riders__grid`):

```css
/* maroon fish-scale wallpaper, echoing the reference's back wall */
.riders.theme-brown {
  background-image:
    radial-gradient(circle at 50% 0, transparent 23px, rgba(47, 36, 26, .3) 24px 26px, transparent 27px),
    radial-gradient(circle at 50% 0, transparent 23px, rgba(47, 36, 26, .3) 24px 26px, transparent 27px);
  background-size: 56px 28px, 56px 28px;
  background-position: 0 14px, 28px 0;
}
```

- [ ] **Step 3: Verify**

Expected: Riders section is warm brown with a subtle darker fish-scale pattern; heading/copy cream and clearly readable (cream `#FFFCF0` on brown `#4F3C2C` is ~7:1 — AA ✓); script kicker gold; "Start riding" gold button unchanged and legible; scooter illustration still reads well (sky whooshes, red frame visible). Tune the two `radial-gradient` alpha values down (e.g. `.3` → `.22`) if the pattern competes with text — judge visually.

- [ ] **Step 4: Commit and push**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): riders section goes trattoria brown with fish-scale texture"
git push
```

---

### Task 6: Partner section — animated kitchen illustration

**Files:**
- Modify: `landing/index.html:388-394` (`.partner__media`)
- Modify: `landing/assets/css/main.css:536-542` (media styles) + reduced-motion block

**Interfaces:**
- Consumes: `.cart__steam` animation class (reused for pot steam), `.partner__stamp` (kept).
- Produces: `.kitchen-frame` / `.kitchen` and `kitchen__flame` / `kitchen__pot` animation classes.

- [ ] **Step 1: Replace the photo with an inline SVG kitchen**

In `index.html`, replace the `.partner__media` block (lines 388-394) with:

```html
        <div class="partner__media" data-reveal>
          <div class="kitchen-frame">
            <svg class="kitchen" viewBox="0 0 500 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a partner kitchen — pots steaming on a busy stove">
              <!-- tiled wall -->
              <rect width="500" height="600" fill="#F6F0E8"/>
              <g stroke="#E5DACC" stroke-width="2.5">
                <path d="M0 90 H500 M0 160 H500 M0 230 H500 M0 300 H500"/>
                <path d="M60 20 V300 M170 20 V300 M280 20 V300 M390 20 V300" opacity=".55"/>
              </g>
              <!-- extractor hood -->
              <rect x="150" y="0" width="200" height="34" fill="#2F241A"/>
              <path d="M120 118 L150 30 H350 L380 118 Z" fill="#0F2C56"/>
              <rect x="120" y="118" width="260" height="14" rx="7" fill="#E3AF04"/>
              <!-- shelf with jars and plates -->
              <rect x="60" y="208" width="380" height="10" rx="5" fill="#4F3C2C"/>
              <rect x="84" y="170" width="34" height="38" rx="6" fill="#C0DEEE"/>
              <rect x="84" y="162" width="34" height="10" rx="4" fill="#4F3C2C"/>
              <rect x="132" y="178" width="30" height="30" rx="5" fill="#E3AF04"/>
              <circle cx="392" cy="188" r="20" fill="#FFFCF0" stroke="#C72531" stroke-width="4"/>
              <circle cx="350" cy="193" r="15" fill="#FFFCF0" stroke="#128643" stroke-width="4"/>
              <!-- hanging utensils -->
              <g stroke="#2F241A" stroke-width="5" stroke-linecap="round">
                <line x1="210" y1="218" x2="210" y2="250"/>
                <line x1="250" y1="218" x2="250" y2="256"/>
                <line x1="290" y1="218" x2="290" y2="248"/>
              </g>
              <circle cx="210" cy="260" r="11" fill="none" stroke="#2F241A" stroke-width="5"/>
              <path d="M244 256 h12 l-2 20 h-8 Z" fill="#2F241A"/>
              <path d="M282 248 a8 10 0 1 0 16 0 Z" fill="#2F241A"/>
              <!-- steam (reuses the cart steam loop) -->
              <g class="cart__steam" fill="none" stroke="#D4C29A" stroke-width="6" stroke-linecap="round">
                <path d="M180 350 q-10 -18 0 -34 q10 -16 0 -32"/>
                <path d="M220 344 q-10 -18 0 -34 q10 -16 0 -32"/>
                <path d="M352 356 q-8 -16 0 -30 q8 -14 0 -28"/>
              </g>
              <!-- big pot -->
              <g class="kitchen__pot">
                <path d="M150 356 q52 -20 104 0 Z" fill="#A31F2A"/>
                <circle cx="202" cy="342" r="8" fill="#E3AF04"/>
                <rect x="142" y="356" width="120" height="13" rx="6.5" fill="#8E1B24"/>
                <rect x="150" y="366" width="104" height="70" rx="12" fill="#C72531"/>
              </g>
              <!-- pan -->
              <g class="kitchen__pan">
                <ellipse cx="352" cy="392" rx="52" ry="14" fill="#2F241A"/>
                <ellipse cx="352" cy="386" rx="52" ry="13" fill="#4F3C2C"/>
                <ellipse cx="352" cy="386" rx="38" ry="8" fill="#E3AF04"/>
                <line x1="404" y1="386" x2="452" y2="376" stroke="#2F241A" stroke-width="9" stroke-linecap="round"/>
              </g>
              <!-- stove top + flames peeking under the pot -->
              <g class="kitchen__flame">
                <path d="M182 430 q-8 -16 6 -24 q-2 12 10 14 q10 2 5 10 Z" fill="#E3AF04"/>
                <path d="M206 430 q-6 -12 5 -18 q0 10 8 12 q5 2 1 6 Z" fill="#C72531"/>
                <path d="M336 430 q-8 -14 5 -21 q-1 11 9 13 q8 2 4 8 Z" fill="#E3AF04"/>
              </g>
              <rect x="90" y="430" width="320" height="26" rx="10" fill="#2F241A"/>
              <!-- oven -->
              <rect x="90" y="456" width="320" height="120" rx="14" fill="#0F2C56"/>
              <rect x="126" y="478" width="180" height="76" rx="10" fill="#1B2F5E" stroke="#FFFCF0" stroke-width="4"/>
              <circle cx="348" cy="492" r="9" fill="#E3AF04"/>
              <circle cx="376" cy="492" r="9" fill="#E3AF04"/>
              <circle cx="348" cy="520" r="9" fill="#E3AF04"/>
              <circle cx="376" cy="520" r="9" fill="#E3AF04"/>
              <!-- pizza visible through the oven window -->
              <circle cx="216" cy="516" r="26" fill="#E3AF04"/>
              <circle cx="216" cy="516" r="20" fill="#C72531" opacity=".85"/>
              <circle cx="208" cy="510" r="4.5" fill="#FFFCF0"/><circle cx="224" cy="520" r="4.5" fill="#FFFCF0"/><circle cx="214" cy="526" r="4.5" fill="#128643"/>
            </svg>
          </div>
          <span class="partner__stamp">
            <span class="num">500</span>+
            <small>partner kitchens</small>
          </span>
        </div>
```

- [ ] **Step 2: Swap the media CSS**

In `main.css`, replace the `.partner__media img` rule (lines 537-542) with:

```css
.kitchen-frame {
  aspect-ratio: 5 / 6;
  border-radius: 46% 46% 16px 16px / 34% 34% 16px 16px; /* trattoria arch */
  border: 7px solid var(--cream);
  box-shadow: var(--sh-overlay);
  overflow: hidden;
}
.kitchen { width: 100%; height: 100%; display: block; }
.kitchen__flame {
  transform-box: fill-box; transform-origin: 50% 100%;
  animation: flame .55s ease-in-out infinite alternate;
}
@keyframes flame { from { transform: scaleY(.82); } to { transform: scaleY(1.12); } }
.kitchen__pot {
  transform-box: fill-box; transform-origin: 50% 100%;
  animation: pot-jiggle 2.8s ease-in-out infinite;
}
@keyframes pot-jiggle { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(.9deg) translateY(-1.5px); } }
```

Add `.kitchen__flame, .kitchen__pot` to the reduced-motion `animation: none` list (the `.cart__steam path` selector already covers the steam).

- [ ] **Step 3: Verify**

Expected: Restaurants section shows the arched illustrated kitchen (no photo), flames flicker, pot jiggles gently, steam rises; the red "500+ partner kitchens" stamp still overlaps the bottom-left; gold section background unchanged. Reduced-motion: fully static. `grep -c "hero.jpg" landing/index.html` → 0.

- [ ] **Step 4: Commit and push**

```bash
git add landing/index.html landing/assets/css/main.css
git commit -m "feat(landing): replace partner photo with animated kitchen illustration"
git push
```

---

### Task 7: Cuisine tickets — real photos, richer color, scattered layout

**Files:**
- Create: `landing/assets/img/cuisine/*.jpg` (17 photos)
- Modify: `landing/index.html:225-262` (cuisine section)
- Modify: `landing/assets/css/main.css:315-382` (ticket styles)
- Modify: `landing/assets/css/tokens.css` (one new token)

**Interfaces:**
- Consumes: Swiper carousel init in `scroll.js` (unchanged), `.ticket` reveal fan-in (unchanged selectors).
- Produces: `.ticket__imgwrap`/`.ticket__img` markup pattern, `--butter` token.

- [ ] **Step 1: Download candidate photos**

Unsplash CDN URLs (license-clean). These IDs are **candidates from memory — every one must be visually verified in Step 2**. Run from repo root (Git Bash):

```bash
mkdir -p landing/assets/img/cuisine && cd landing/assets/img/cuisine
P="?auto=format&fit=crop&w=480&h=360&q=60"
curl -sL -o pakistani.jpg  "https://images.unsplash.com/photo-1589302168068-964664d93dc0$P"
curl -sL -o fastfood.jpg   "https://images.unsplash.com/photo-1573080496219-bb080dd4f877$P"
curl -sL -o pizza.jpg      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38$P"
curl -sL -o burgers.jpg    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd$P"
curl -sL -o shawarma.jpg   "https://images.unsplash.com/photo-1529006557810-274b9b2fc783$P"
curl -sL -o bbq.jpg        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1$P"
curl -sL -o nihari.jpg     "https://images.unsplash.com/photo-1545247181-516773cae754$P"
curl -sL -o pulao.jpg      "https://images.unsplash.com/photo-1512058564366-18510be2db19$P"
curl -sL -o halwapuri.jpg  "https://images.unsplash.com/photo-1601050690597-df0568f70950$P"
curl -sL -o paratha.jpg    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445$P"
curl -sL -o chinese.jpg    "https://images.unsplash.com/photo-1585032226651-759b368d7246$P"
curl -sL -o pasta.jpg      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9$P"
curl -sL -o roast.jpg      "https://images.unsplash.com/photo-1598103442097-8b74394b95c6$P"
curl -sL -o seafood.jpg    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b$P"
curl -sL -o desserts.jpg   "https://images.unsplash.com/photo-1551024506-0bccd828d307$P"
curl -sL -o icecream.jpg   "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f$P"
curl -sL -o pudding.jpg    "https://images.unsplash.com/photo-1488477181946-6428a0291777$P"
ls -la
```

Expected: 17 files, each roughly 15–60 KB. Any 0-byte or HTML-content file = dead ID, needs a replacement.

- [ ] **Step 2: Visually verify every photo (mandatory)**

View each of the 17 images with the Read tool. For each, confirm it plausibly matches its label (biryani-ish rice dish for `pakistani.jpg`, a burger for `burgers.jpg`, a wrap for `shawarma.jpg`, etc.). For any mismatch or dead file, find a replacement: try a different Unsplash photo ID (search unsplash.com if browsing is available; otherwise pick the closest visual substitute among known-good IDs) and re-verify. Do not proceed while any of the 17 is wrong or broken — a burger photo above "Nihari" is exactly the failure mode the user flagged. Log which IDs were swapped in the commit message body.

- [ ] **Step 3: Replace the emoji slides with photo slides**

In `index.html`, replace the 17 `swiper-slide` divs (lines 234-250) with (note: emoji span → `figure.ticket__imgwrap` + `img`, plus a `ticket__tear` strip):

```html
          <!-- PLACEHOLDER counts: swap for live marketplace data -->
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/pakistani.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Pakistani</h3><p class="ticket__meta"><span class="num">140</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/fastfood.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Fast Food</h3><p class="ticket__meta"><span class="num">120</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/pizza.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Pizza</h3><p class="ticket__meta"><span class="num">60</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/burgers.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Burgers</h3><p class="ticket__meta"><span class="num">75</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/shawarma.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Shawarma</h3><p class="ticket__meta"><span class="num">90</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/bbq.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">BBQ</h3><p class="ticket__meta"><span class="num">85</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/nihari.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Nihari</h3><p class="ticket__meta"><span class="num">30</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/pulao.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Pulao</h3><p class="ticket__meta"><span class="num">50</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/halwapuri.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Halwa Puri</h3><p class="ticket__meta"><span class="num">35</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/paratha.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Paratha</h3><p class="ticket__meta"><span class="num">40</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/chinese.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Chinese</h3><p class="ticket__meta"><span class="num">65</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/pasta.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Pasta</h3><p class="ticket__meta"><span class="num">40</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/roast.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Roast</h3><p class="ticket__meta"><span class="num">30</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/seafood.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Seafood</h3><p class="ticket__meta"><span class="num">25</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/desserts.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Desserts</h3><p class="ticket__meta"><span class="num">80</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/icecream.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Ice Cream</h3><p class="ticket__meta"><span class="num">45</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
          <div class="swiper-slide ticket"><figure class="ticket__imgwrap"><img class="ticket__img" src="assets/img/cuisine/pudding.jpg" alt="" width="480" height="360" loading="lazy"></figure><h3 class="ticket__name">Pudding</h3><p class="ticket__meta"><span class="num">20</span>+ spots</p><span class="ticket__tear" aria-hidden="true"></span></div>
```

Also change the section's theme class (line 225) from `theme-dough` to the new butter tone:

```html
    <section class="cuisines section sec-cap theme-butter" id="cuisines">
```

- [ ] **Step 4: Add the butter token + theme**

In `tokens.css`, add below `--beige`:

```css
  --butter: #F7EED2; /* warm gold-tinted section canvas */
```

In `main.css` themes block, add after `.theme-dough`:

```css
.theme-butter { --bg: var(--butter); --ink: var(--navy); --muted: var(--brown); --script-ink: var(--tomato); }
```

- [ ] **Step 5: Restyle the tickets**

In `main.css`, replace the ticket styles (lines 321-361) with:

```css
.ticket {
  --t-bg: var(--cream);
  position: relative;
  width: clamp(168px, 42vw, 210px);
  background: var(--t-bg);
  border-radius: 14px 14px 0 0;
  padding: .7rem .7rem 0;
  text-align: center;
  height: auto;
  box-shadow: var(--sh-raised);
  transform: rotate(var(--tilt, 0deg)) translateY(var(--drop, 0px));
  transition: transform .35s var(--ease-out-expo), box-shadow .35s;
  cursor: grab;
}
/* scattered, not planned: 5-step tilt cycle + 3-step vertical drift */
.ticket:nth-child(5n+1) { --tilt: -2.2deg; }
.ticket:nth-child(5n+2) { --tilt: 1.4deg; }
.ticket:nth-child(5n+3) { --tilt: -0.8deg; }
.ticket:nth-child(5n+4) { --tilt: 2.4deg; }
.ticket:nth-child(5n)   { --tilt: -1.5deg; }
.ticket:nth-child(3n)   { --drop: 8px; }
.ticket:nth-child(3n+2) { --drop: -4px; }
/* tricolore-tinted paper cycle */
.ticket:nth-child(6n+1) { --t-bg: #F6E3B4; } /* gold tint */
.ticket:nth-child(6n+2) { --t-bg: var(--cream); }
.ticket:nth-child(6n+3) { --t-bg: #F5D8D8; } /* tomato tint */
.ticket:nth-child(6n+4) { --t-bg: var(--sky); }
.ticket:nth-child(6n+5) { --t-bg: #DCEBD6; } /* basil tint */
.ticket:nth-child(6n)   { --t-bg: var(--beige); }
.ticket:hover { transform: rotate(0deg) translateY(calc(var(--drop, 0px) - 10px)) scale(1.04); box-shadow: var(--sh-overlay); }

.ticket__imgwrap {
  overflow: hidden; border-radius: 10px;
  aspect-ratio: 4 / 3; margin: 0;
}
.ticket__img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform .45s var(--ease-out-expo);
}
.ticket:hover .ticket__img { transform: scale(1.09) rotate(1deg); }
.ticket__name { font-size: 1.18rem; margin-top: .65rem; color: var(--navy); }
.ticket__meta {
  margin-top: .7rem; padding-block: .65rem 1rem;
  border-top: 2px dashed rgba(79, 60, 44, .35);
  color: var(--brown); font-size: .88rem;
}
/* perforation notches where the dashed tear line meets the edges */
.ticket::before, .ticket::after {
  content: ""; position: absolute; bottom: 2.7rem;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--bg);
}
.ticket::before { left: -9px; }
.ticket::after { right: -9px; }
/* torn scalloped bottom edge — punched dots in the section background color */
.ticket__tear {
  position: absolute; left: 0; right: 0; bottom: -5px; height: 10px;
  background: radial-gradient(circle at 50% 100%, var(--bg) 5px, transparent 5.5px) 0 0 / 20px 10px repeat-x;
  pointer-events: none;
}
```

(The old `.ticket__icon` rules — lines 343-347 — are deleted; nothing else references them.)

- [ ] **Step 6: Verify**

Expected: butter-toned section; 17 tickets each showing a real matching food photo above the name; card papers cycle through gold/cream/tomato/sky/basil/beige tints; tilts and vertical offsets vary card-to-card (no obvious 2-step alternation); each card has a torn scalloped bottom edge and side perforations; hover lifts + straightens the card and gently zooms the photo. Swipe/drag and arrows still work; no-JS fallback still shows a horizontal scroll row. `prefers-reduced-motion`: `.ticket` transitions already disabled by the existing rule; add `.ticket__img` to that transition-suppression list in the reduced-motion block:

```css
  .glyph-o, .ticket, .ticket__icon, .env, .env__seal, .quote,
  .hex, .hero__card, .btn, .footer__col a, .footer__social a, .ticket__img { transition: none; }
```

(`.ticket__icon` in that list is now inert but harmless — remove it while editing.)

- [ ] **Step 7: Commit and push**

```bash
git add landing/assets/img/cuisine landing/index.html landing/assets/css/main.css landing/assets/css/tokens.css
git commit -m "feat(landing): cuisine tickets get real food photos, tinted paper cycle, scattered tilt, torn edges"
git push
```

---

### Task 8: Scroll-reveal coverage everywhere

**Files:**
- Modify: `landing/assets/js/scroll.js:37-49, 82-89`
- Modify: `landing/index.html` (add `data-reveal` to `.how__head` and `.how__phone` wrappers — optional; selectors below target classes directly, so **no HTML change needed**)

**Interfaces:**
- Consumes: `revealOnScroll(selector, vars)` from `scroll.js` (unchanged signature).
- Produces: reveals on every major section head/body.

- [ ] **Step 1: Trigger reveals as elements enter (not 15% in)**

In `scroll.js`, change the `IntersectionObserver` options in `revealOnScroll` (line 47) from `{ threshold: 0.15 }` to:

```js
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
```

(Fires as soon as the element's top crosses 10% above the viewport bottom — animating in *while* entering, per the spec.) Make the same change in `revealTickets` (line 64): `{ threshold: 0.2 }` → `{ threshold: 0, rootMargin: "0px 0px -10% 0px" }`.

- [ ] **Step 2: Extend coverage in `initScroll`**

Replace the body of `initScroll` (lines 82-89) with:

```js
export function initScroll() {
  countUp();
  revealTickets();
  revealOnScroll(".cuisines__head", { y: 30 });
  revealOnScroll(".how__head, .how__phone", { y: 34 });
  revealOnScroll("#how [data-reveal]", { y: 44, rotation: -2 });
  revealOnScroll(".reviews__head", { y: 30 });
  revealOnScroll(".reviews__marquee", { y: 20 });
  revealOnScroll("#partner [data-reveal]", { y: 34 });
  revealOnScroll("#riders [data-reveal]", { y: 34 });
  revealOnScroll(".footer__top", { y: 26 });
  initCarousel();
}
```

- [ ] **Step 3: Verify**

Reload and scroll slowly top to bottom. Expected: every section's heading/content group animates in as it enters the viewport — cuisines head, tickets fan-in, how-it-works head + phone + envelopes, reviews head + quote marquee, partner copy + kitchen, riders art + copy, footer mega-wordmark. Nothing pops in "already there". Then the two safety checks:
- Reduced-motion emulation: no reveals, everything visible immediately.
- Disable JS (DevTools → Ctrl+Shift+P → "Disable JavaScript"), reload: all content visible.

- [ ] **Step 4: Commit and push**

```bash
git add landing/assets/js/scroll.js
git commit -m "feat(landing): scroll reveals on every section, trigger on viewport entry"
git push
```

---

### Task 9: Full-page QA, cleanup, deploy check

**Files:**
- Delete: `landing/assets/img/hero.jpg`, `landing/assets/img/cuisine-*.jpg` (6 old unused files)
- Modify: none expected (fix anything QA surfaces)

- [ ] **Step 1: Remove dead image assets**

```bash
grep -rn "hero.jpg\|cuisine-burgers\|cuisine-desi\|cuisine-pasta\|cuisine-pizza\|cuisine-sushi\|cuisine-wraps" landing/ --include="*.html" --include="*.css" --include="*.js"
```

Expected: no matches (Task 6 removed the last `hero.jpg` reference; the `cuisine-*.jpg` files were already orphaned). Then:

```bash
git rm landing/assets/img/hero.jpg landing/assets/img/cuisine-*.jpg
```

If the grep DOES match anything, fix that reference first — do not delete a file still in use.

- [ ] **Step 2: Full manual pass (desktop + mobile widths)**

With the local server running, walk the whole page at 1440px, 900px, 640px, 375px:
- No horizontal overflow at any width (`document.documentElement.scrollWidth === window.innerWidth` in console).
- Intro → hero collage → each section → footer: all render, all links work (`#`-links scroll, Get Started → `login.html` loads styled).
- Keyboard-only pass: tab through nav → hero CTAs → hexagon → card button → carousel controls; focus ring visible everywhere.
- Reduced-motion pass: no intro, no loops, page fully usable.
- Console clean on every page.

- [ ] **Step 3: Commit, push, verify production**

```bash
git add -A
git commit -m "chore(landing): QA pass — remove orphaned images"
git push
```

Wait ~90s for Vercel, then:

```bash
curl -s https://feast-now.vercel.app/ | grep -c "hero__stage\|btn--ticket\|theme-brown\|kitchen-frame\|ticket__img"
```

Expected: ≥5 (all new class names present in production HTML). Spot-check one cuisine image: `curl -s -o /dev/null -w "%{http_code}" https://feast-now.vercel.app/assets/img/cuisine/burgers.jpg` → `200`.
