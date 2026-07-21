<!-- SEED: palette & type are locked from the reference (pizza-amici.nl). Re-run /impeccable document once there's code to capture real component tokens, spacing scale, and states. -->
---
name: FeastNow
description: A warm rustic-Italian food-ordering marketplace — cream canvas, deep navy, gold, and tricolore accents across four role shells.
colors:
  navy: "#0F2C56"
  navy-deep: "#1B2F5E"
  brown-deep: "#2F241A"
  brown: "#4F3C2C"
  cream: "#FFFCF0"
  off-white: "#F2EDE9"
  dough: "#ECE6E1"
  beige: "#EAE1DA"
  gold: "#E3AF04"
  tomato: "#C72531"
  basil: "#128643"
  sky-tint: "#C0DEEE"
typography:
  display:
    fontFamily: "Awesome Serif, 'Playfair Display', Georgia, serif"
    fontSize: "clamp(1.75rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "salo-variable, 'Space Grotesk', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "salo-variable, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "salo-variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  numeric:
    fontFamily: "Azeret Mono, 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  script:
    fontFamily: "La Belle Aurore, 'Caveat', cursive"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
---

# Design System: FeastNow

## 1. Overview

**Creative North Star: "The Neighborhood Trattoria, in your pocket."**

FeastNow borrows the soul of a warm, family-run Italian pizzeria — cream tablecloths, a deep-navy awning, brass-gold signage, and the red-and-green of the tricolore — and rebuilds it as a fast, four-shell product app. The mood is *appetizing and hand-made*, never sterile-tech. A layered warm-cream canvas does the hosting; deep navy carries every piece of structure (headers, nav, primary actions, body ink); gold is the brass accent that marks what matters (prices, ratings, the current step); and tomato-red / basil-green appear as deliberate tricolore signals, most importantly across the order lifecycle. Reference DNA: [pizza-amici.nl](https://www.pizza-amici.nl/) — Webflow-editorial warmth, serif-and-mono type mixing, pill buttons, smooth motion.

This is a **product**, not a marketing page, so the trattoria warmth is adapted, not transplanted whole. All four shells share the same expressive language — awning headers, serif display, gold accents, and motion — tuned by *density* rather than reserved for one shell: operator screens pack more per view but wear the same warmth. Warmth is carried by **color, type, and imagery** — not by decoration that stutters on a cheap Android phone.

What this system explicitly rejects: the generic AI food-app look (flat white + one hot-pink accent + rounded-everything), cold enterprise-dashboard chrome even in the operator shells, and monospace-everywhere body text that runs wide and tires the eye on dense menus. Cream here is a *committed identity choice* (navy + gold + tricolore make it read as trattoria, not as the default warm-near-white AI canvas), not a reflex.

**Key Characteristics:**
- Layered warm-cream surfaces, deep-navy ink and structure, brass-gold accent.
- Tricolore (tomato / basil) reserved for meaning — above all, order status.
- Expressive serif + variable-sans headings; clean sans body; **mono for numerics only**.
- Pill buttons, softly-rounded cards, warm and mostly-flat elevation.
- One product across four shells: the same expressive, animated language everywhere, tuned by density.

## 2. Colors

A warm, layered palette: cream neutrals ranging from bright to biscuit, anchored by deep navy, sparked by brass gold and the Italian tricolore.

### Primary
- **Trattoria Navy** (`#0F2C56`, ~oklch 28% 0.08 260): The workhorse. Body ink, headings, top/side navigation, primary button fills, icons. Its ~12:1 contrast on cream is the accessibility backbone and reads cleanly in outdoor glare.
- **Awning Navy** (`#1B2F5E`): A slightly lifted navy for large filled surfaces (nav bars, headers) where flat `#0F2C56` would feel heavy.

### Secondary
- **Brass Gold** (`#E3AF04`, ~oklch 76% 0.15 90): The one true accent. Price emphasis, rating stars, the active step in an order timeline, selected chips, focus rings. **Gold is a fill/decoration color, not a text color** — text on gold sits in navy; gold never carries body text on cream.

### Tertiary (semantic — the tricolore)
- **Tomato Red** (`#C72531`, ~oklch 55% 0.21 25): Errors, rejected/cancelled orders, destructive actions, urgency. Always paired with an icon and text label.
- **Basil Green** (`#128643`, ~oklch 54% 0.14 155): Success, delivered, "online/available", confirmations. Always paired with an icon and text label.
- **Sky Tint** (`#C0DEEE`): Low-priority info backgrounds and subtle map/route tints only.

### Neutral
- **Cream** (`#FFFCF0`): The primary app canvas.
- **Off-White** (`#F2EDE9`): Card and panel surfaces raised off the cream.
- **Dough** (`#ECE6E1`): Secondary panels, input fills, pressed states.
- **Beige** (`#EAE1DA`): Dividers, hairlines, disabled surfaces.
- **Deep Brown** (`#2F241A`) / **Brown** (`#4F3C2C`): Warmest dark tones for secondary text and warm detail where pure navy would feel cold.

### Named Rules
**The Tricolore-Means-Status Rule.** Red and green are never decorative. They belong to the order-lifecycle and availability states, and every use is backed by an icon *and* a text label — never color alone (color-blind safe, per PRODUCT.md). Tomato has one sanctioned use outside status: destructive/irreversible actions (Log Out, Clear recents) — always with a clear text label (an icon is not required there). Basil stays status-only.

**The Gold-Is-Rare Rule.** Brass gold marks *the one thing that matters* on a screen (the price, the rating, the current step). If two things are gold, one is wrong. Review stars render in navy ink, not gold — gold stays reserved for the header rating badge and prices.

## 3. Typography

**Display Font:** Fraunces (fallback: Playfair Display, Georgia) — expressive, high-contrast serif.
**Heading/UI Font:** salo-variable (fallback: Space Grotesk, system-ui) — a warm variable sans.
**Body Font:** salo-variable / system-ui stack.
**Numeric/Mono Font:** Azeret Mono (fallback: JetBrains Mono, ui-monospace).
**Signature Script:** La Belle Aurore (fallback: Caveat) — used *rarely*.

**Character:** An editorial mix — a warm serif for expressive moments, a clean variable sans doing the daily work, and a monospace that shows up only for numbers, where it reads like a printed receipt. The script is a garnish, not an ingredient.

### Hierarchy
- **Display** (Fraunces, 600, `clamp(1.75rem, 5vw, 3rem)`, lh 1.05): Display headings generally — restaurant names, screen and section headings (e.g. "Most Popular Near You", "Reviews", "Recent searches"), the boot wordmark, and other Customer-shell hero moments. Sparing in operator shells.
- **Headline** (salo-variable, 600, ~1.5rem, lh 1.15): Screen titles, card headers across all shells.
- **Title** (salo-variable, 600, ~1.125rem, lh 1.2): List-row titles, dialog titles, section headers.
- **Body** (salo-variable, 400, 1rem, lh 1.5): All running UI text and prose. Cap prose at 65–75ch.
- **Label** (salo-variable, 600, 0.8125rem, `letter-spacing 0.06em`, often uppercase): Tabs, chips, meta labels, buttons.
- **Numeric** (Azeret Mono, 500, tabular): Prices, totals, order numbers, ETAs, countdown timers, order-summary "receipts". **Body text is never mono.**
- **Script** (La Belle Aurore): The wordmark and the occasional signature flourish (a "grazie" on an order-complete screen). Never for anything functional.

### Named Rules
**The Mono-for-Numbers Rule.** Monospace is reserved for numerals and receipt-like summaries where alignment and the printed-ticket feel earn it. Never set paragraphs, labels, or navigation in mono — it runs wide and tires the eye on dense menus and cheap screens.

**The One-Language-Tuned-By-Density Rule.** All four shells share the full expressive language — serif display, awning headers, gold accents, and motion — rather than reserving expressiveness for Customer. Shells differ by *density*, not vocabulary: operator screens pack more per view and lean on the same system to stay scannable during a rush. Script stays a rare garnish everywhere. Low-end-Android performance remains a hard constraint (transform/opacity/filter only, `LazyMotion` bundle, reduced-motion fallbacks) — expressiveness never buys itself with jank.

## 4. Elevation

Warm and mostly flat. Surfaces are layered by tone (cream → off-white → dough), not by heavy shadow. Depth appears as a *response to state* — a raised card, an open sheet, a focused input — using soft, low, slightly-warm shadows. Nothing on the "2014 app" end of the spectrum: no dark, tight drop-shadows; no decorative glassmorphism.

### Shadow Vocabulary (targets; finalize in scan mode)
- **Rest** (`box-shadow: none`): Cards and rows sit flat on their tonal surface.
- **Raised** (`box-shadow: 0 2px 12px rgba(15,44,86,0.08)`): Menu-item cards, restaurant cards, the active order card.
- **Overlay** (`box-shadow: 0 8px 32px rgba(15,44,86,0.14)`): Bottom sheets, dialogs, the cart drawer.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest and layered by cream-tone. Shadow is earned by elevation or interaction, never sprinkled for looks.

## 5. Components

*Seed-stage: these are the intended primitives derived from the reference, to be built and re-captured in scan mode.*

### Buttons
- **Shape:** Pill (`border-radius: 100px`), generous — min height ~48px for low-end touch.
- **Primary:** Navy fill (`#0F2C56`), cream text; the main commit action (Place Order, Accept, Mark Delivered).
- **Gold accent button:** Gold fill (`#E3AF04`) with **navy** text — reserved for the single highest-intent moment on a screen.
- **Secondary / Ghost:** Navy outline on transparent, navy text; navy tint on press.
- **Hover/Press/Focus:** ~150–200ms; press = slight tonal darken + scale 0.98; focus-visible = 2px gold ring offset from the fill.

### Chips (categories, filters)
- **Style:** Pill, dough (`#ECE6E1`) fill with navy text at rest; **selected** = navy fill with cream text, or gold ring. Filter and cuisine chips scroll horizontally on the Customer browse screen.

### Cards / Containers (restaurant & menu-item cards)
- **Corner:** `rounded.md` (12px) to `rounded.lg` (20px) for hero/food cards.
- **Background:** Off-white (`#F2EDE9`) on the cream canvas; food imagery bleeds to the card edge.
- **Shadow:** Rest flat → Raised on the active/selected card (see Elevation).
- **No nested cards.**

### Inputs / Fields
- **Style:** Dough (`#ECE6E1`) fill, no or hairline beige border, `rounded.sm`.
- **Focus:** Gold 2px ring + navy text; label lifts.
- **Error:** Tomato hairline + tomato helper text with an alert icon.

### Status Pill (signature component)
- The order-lifecycle indicator shared by Customer, Restaurant, and Delivery. Each state = a fixed **color + icon + label** triple (e.g. Preparing = gold + skillet icon + "Preparing"; Delivered = basil + check icon + "Delivered"; Rejected = tomato + x icon + "Rejected"). One source of truth, identical across all three shells watching the same order.

### Navigation
- **Customer / Restaurant / Delivery:** Animated bottom `TabBar` — navy icons on cream with a **sliding gold indicator** (`layoutId="tabPill"` spring) that glides between tabs, plus an icon pop on activation. Serif screen titles allowed on all three.
- **Admin:** Animated navy **side nav** — the active item is marked by a sliding navy indicator (`layoutId="adminNav"` spring) rather than a static fill; content fades on route change. Full-width back-office layout.

## 5b. Motion

Motion is a first-class part of the system, shared across all four shells and implemented with the **`motion`** library (Framer Motion's successor). It is loaded via **`LazyMotion` + `domAnimation`** with `strict` mode, so only the `m.*` components ship and the bundle stays small for low-end Android. Reduced motion is handled globally by `<MotionConfig reducedMotion="user">` plus the CSS keyframe block in `motion.css` — every animation degrades to instant/crossfade under `prefers-reduced-motion`.

### Shared variants (`app/src/lib/motion.ts`)
- `screenVariants` — whole-screen fade + rise that orchestrates staggered children (`when: "beforeChildren"`).
- `staggerParent` / `staggerChild` — list/row stagger reveal.
- `revealUp` — single-element reveal-up (detail panels, empty states).
- `popIn` — spring pop for badges, avatars, modal icons.
- `slideUp` — bottom-sheet / offer / banner slide-up with an `exit`.
- Presets: `easeExpo` (`cubic-bezier(0.16,1,0.3,1)`), `spring`, `springSoft`.

### Shared components
- **`Screen`** — animated `<m.main className="screen">`; drop-in for the old `<main>`, adds the fade+rise entrance and orchestrates children.
- **`AppHeader`** — the navy "awning" top bar (see below) with an animated entrance; `children` slot houses a search bar or extras.
- **`TabBar`** — bottom nav with the sliding gold indicator (`layoutId="tabPill"`) + icon pop.
- **`Reveal` / `RevealItem`** — in-view stagger primitive for sections/lists (content visible by default; motion only enhances).
- **`BootIntro`** — one-time-per-session intro curtain echoing the landing site; self-removes, skipped under reduced motion.
- Route transitions: each shell wraps `<Routes>` in `AnimatePresence mode="wait"` keyed on `location.pathname` for a clean cross-fade between screens (Admin fades its `<m.main>` content on route change).

### Awning-header surface
The navy gradient header (`--awning-grad`, cream `--awning-ink` on navy, AA) is the shared top surface across shells, replacing per-shell cream headers. A search bar placed inside it adapts to the dark surface (translucent fill, gold focus ring).

### Section-canvas rhythm
Screens layer warm bands (`--canvas-warm`/`--butter`, `--canvas-plain`) behind sections for vertical rhythm, so a long feed reads as grouped movements rather than one flat scroll.

### Signature motion moments
- **Living order timeline** — the active status step carries a gold `pulse-ring`; the connector fills via an animated `scaleX` (color + icon + label triple unchanged).
- **Count-ups** — earnings and admin metrics animate 0 → value via `useMotionValue` + `animate` (mono, formatting preserved).
- **Countdown bars** — the delivery offer window shrinks as a gold `scaleX` bar (compositor-only, no layout thrash).
- **Attention pulse** — `attn-pulse` (a gentle 1.035 scale loop) marks "action needed" affordances (e.g. restaurant accept/reject), never whole cards.

All motion obeys the reduced-motion, contrast, color-blind-safe, and low-end-Android rules in §6.

## 6. Do's and Don'ts

### Do:
- **Do** let deep navy (`#0F2C56`) carry structure and body ink; it's the ~12:1-on-cream contrast backbone and the reason the app stays legible in glare.
- **Do** reserve mono (`Azeret Mono`) for prices, order numbers, timers, and receipt-style summaries — never body, labels, or nav (**The Mono-for-Numbers Rule**).
- **Do** pair every red/green status with an icon *and* a text label (**The Tricolore-Means-Status Rule**; color-blind safe per PRODUCT.md).
- **Do** give all four shells the same expressive language (serif, awning headers, gold, motion), tuned by density rather than restraint; keep script a rare garnish everywhere (**The One-Language-Tuned-By-Density Rule**).
- **Do** use gold for the single most important thing on a screen, with navy text on any gold fill (**The Gold-Is-Rare Rule**).
- **Do** use pill buttons ≥48px tall and large touch targets for one-handed, outdoor, cheap-screen use.

### Don't:
- **Don't** treat the cream canvas as a soft, decorative default — it's a committed trattoria identity, held up by navy + gold + tricolore. Without them it collapses into the generic warm-near-white AI look.
- **Don't** set body text, labels, or navigation in monospace, however tempting the receipt aesthetic.
- **Don't** put text (body or button) in gold on cream — gold is a fill/accent, not a text color.
- **Don't** convey order status by color alone; never a bare red or green dot.
- **Don't** import brand-site motion wholesale (heavy Locomotive-style scroll choreography). Motion is responsive (150–250ms), conveys state, and has a reduced-motion fallback — it must never stutter on a low-end Android phone. Exemption: continuous ambient loops (e.g. skeleton shimmer, ~1.4s) aren't interaction motion and may run longer than the 150–250ms bound, provided they respect `prefers-reduced-motion`.
- **Don't** ship a cold enterprise-dashboard look in the Restaurant/Delivery/Admin shells; they wear the same warm palette, just quieter.
- **Don't** use `border-left`/`border-right` colored stripes, gradient text, or decorative glassmorphism.
