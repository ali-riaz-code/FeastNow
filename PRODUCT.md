# Product

## Register

product

## Users

FeastNow serves four distinct roles from one mobile codebase, each in a different physical and emotional context:

- **Customers** — ordinary people browsing for a meal, usually one-handed on their own phone, sometimes hungry and impatient. Their job: find something appetizing from nearby approved restaurants, order it, and know exactly when it will arrive.
- **Restaurant staff** — busy, non-technical operators working during a rush, often on a low-to-mid-range Android tablet or phone in a bright kitchen. Their job: see incoming orders instantly, accept/reject, and move each order through Preparing → Ready without hunting for controls.
- **Delivery partners** — on the move, outdoors, glare on screen, one hand on a scooter or bag. Their job: go online, accept an assignment, confirm pickup, share live location, mark delivered — with the fewest possible taps.
- **Admin** — back-office staff on a web/tablet portal (separately authenticated) approving restaurants, moderating reviews/users, managing promos, and watching metrics.

## Product Purpose

FeastNow is a **multi-restaurant food-ordering marketplace** (Foodpanda / Uber Eats category), not a single-restaurant app. One React Native codebase renders four role-based experiences selected by `User.role`, sharing one backend and one visual design system. This version is **cash / pay-on-pickup only — no in-app payments**, no multi-language.

The product exists to connect hungry customers with nearby restaurants and route a delivery partner to close the loop. Its backbone is a fixed order-lifecycle state machine (Placed → Accepted → Preparing → Ready → Assigned → Out for Delivery → Delivered, with a Rejected/Cancelled branch) that couples all three app roles. Success = a customer can browse, order, and track a delivery with confidence; a restaurant can run its queue during a rush without fumbling; a partner can complete a run one-handed; and the whole thing stays fast and legible on cheap Android hardware.

### Functional reference: Foodpanda

**Foodpanda is the functional/UX model** — it defines *what the app does and how flows work*, not how it looks. Mirror its proven marketplace patterns: address/location gate on entry, a home feed of nearby restaurants with cuisine-category tiles and search, restaurant detail with sectioned menu, item customization + cart, checkout with order note and (cash-only) confirmation, live order-tracking with a status timeline and map, order history + reorder, ratings after delivery, and the separate rider (delivery-partner) and vendor (restaurant) task flows. **Adopt Foodpanda's information architecture and interaction flows; do not adopt its visual identity** — the look comes from the Visual reference below, not from Foodpanda's pink.

### Visual reference: pizza-amici.nl

**The visual identity follows `pizza-amici.nl`** — a warm, rustic-premium Italian trattoria aesthetic: a layered cream canvas, deep navy structure/ink, brass-gold accent, and Italian-tricolore (tomato-red / basil-green) status pops; serif display + clean variable-sans body + monospace numerics. See `DESIGN.md` for the full system. In short: **Foodpanda flows, trattoria skin.**

## Brand Personality

**Appetizing, warm, hand-made.** The Customer experience should feel like a warm neighborhood trattoria — inviting, a little indulgent, food-forward — while the Restaurant and Delivery shells channel that same warmth into speed and calm during pressure. The visual identity is **rustic-premium Italian** (per `pizza-amici.nl`): a layered cream canvas hosts deep-navy structure, brass-gold accents, and Italian-tricolore status pops, with serif display, clean sans body, and monospace numerics. Warm and characterful, never cold-tech, never corporate, never a generic white-plus-one-accent app. The four shells must feel like one product: same color, type, motion, and component language, differing only in the tasks they surface (Customer most expressive, operators most legible).

## Anti-references

- **Foodpanda's visual identity** — we borrow Foodpanda's *functionality and flows*, NOT its look. No hot-pink/magenta brand skin. The visual identity is the warm trattoria system in `DESIGN.md`.
- **Generic template / stock look** — must not read as default Bootstrap or out-of-the-box Material. The cream canvas is a *committed* trattoria identity held up by navy + gold + tricolore; without them it collapses into the generic warm-near-white AI look. Warmth must be earned by the full palette, type, and imagery — not a bare beige page.
- **Cold enterprise/admin dashboards** — even the Admin and Restaurant shells should feel like the same appetizing product, not a database front-end.
- **Over-decorated / slow** — no gratuitous motion, glassmorphism, or heavy effects that stutter on a low-end Android phone. Craving-appeal, not visual noise.
- **Status-by-color-alone** — order states must never be distinguishable only by hue (color + icon + label always).

## Design Principles

- **One product, four shells.** A single shared design system (color, type, components, motion) makes Customer, Restaurant, Delivery, and Admin feel like one brand. Fork presentation per role, never the visual language and never the business logic (shared API layer, single order state machine).
- **Appetite first for the customer, clarity first for the operators.** The Customer shell earns extra polish and food-forward warmth; the Restaurant and Delivery shells spend that same brand equity on legibility, big targets, and the fewest taps to move an order.
- **Status you can trust.** The order lifecycle is the spine of the product. Every state must be unambiguous at a glance — communicated by color *and* icon *and* label — and consistent across all three roles watching the same order.
- **Works on the worst phone in the room.** Design for low-to-mid-range Android, outdoor glare, and one-handed use: large touch targets, high-contrast type, and cheap, purposeful motion that respects reduced-motion.
- **Honest and plain.** Cash-only, no hidden fees, plain-language copy. The interface should never overpromise (no payment UI, no features out of scope) or dress up a simple marketplace as something it isn't.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** contrast for all text and meaningful UI (body ≥4.5:1, large/bold ≥3:1); no light-gray-on-tint body text.
- **Color-blind safe:** order-status and availability states are always paired with an icon and text label, never conveyed by color alone.
- **Large touch targets** (min ~44–48px) and legible type sizing for one-handed, outdoor, and glare conditions — especially the Restaurant and Delivery shells.
- **Respect `prefers-reduced-motion`:** every animation has a crossfade/instant fallback; motion stays purposeful and inexpensive on low-end hardware.
