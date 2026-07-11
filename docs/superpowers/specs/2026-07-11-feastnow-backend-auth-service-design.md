# FeastNow Backend Auth Service — Design Spec

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Author:** Claude (brainstormed with user)
**Depends on:** none (first backend code in this repo).
**Feeds into:** `docs/superpowers/specs/2026-07-11-feastnow-auth-flow-frontend-design.md` (Spec B) — the frontend calls the API this spec defines.

## 1. Summary

This repo has no backend yet — only the static `landing/` site. This spec stands
up the first real backend service: account creation (with real email OTP
verification) and login for the **Customer** role only. Restaurant, delivery
partner, and admin auth are out of scope (those roles are paused per
`CLAUDE.md`).

This also fixes the two undecided items in `CLAUDE.md`'s tech-stack section:
backend framework and hosting.

## 2. Architecture

- **New top-level `backend/` directory**, separate from `landing/`. Node.js +
  TypeScript, **Express**.
- **Database:** PostgreSQL, hosted on **Supabase** (user already has an
  account). Accessed via **Prisma** ORM using a `DATABASE_URL` connection
  string (SSL required).
- **Hosting:** **Railway**, connected to this GitHub repo, root directory
  `backend/`, auto-deploys on push to `main` — mirrors the existing "push to
  main → Vercel deploys the landing site" workflow described in `CLAUDE.md`,
  just on a second service.
- **CORS:** restricted to the known frontend origin(s) (the Vercel landing
  domain(s) + `http://localhost:*` for local dev).
- Chosen over Vercel Serverless Functions because this backend is meant to
  grow into the full FeastNow API (mobile app, all four roles, live delivery
  tracking, background assignment jobs) per `CLAUDE.md` — a long-running
  server fits that shape better than stateless functions.

## 3. Data model (Prisma schema)

Only what this flow needs now. Additional SRS §7 entities (`Restaurant
Profile`, `Menu Item`, `Order`, etc.) are added when those features are built.

```prisma
enum UserRole {
  customer
  restaurant
  delivery_partner
  admin
}

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  phone        String   @unique
  passwordHash String
  role         UserRole @default(customer)
  createdAt    DateTime @default(now())
}

model OtpChallenge {
  id         String    @id @default(uuid())
  email      String
  otpHash    String
  attempts   Int       @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([email])
}
```

- Only `role: customer` is ever created by this flow. The enum's other values
  are reserved so the column doesn't need a migration when those roles are
  built.
- `OtpChallenge` never stores the raw code — only a hash (bcrypt or
  SHA-256+pepper) — and never stores the pending signup's name/phone/password.
  Those stay client-side in the sign-up form until OTP verification succeeds
  (see §4), so a half-completed signup never leaves a partial `User` row or a
  server-side pending-account record to clean up.
- A new OTP request for an email invalidates any prior unconsumed challenge
  for that email (at most one active challenge per email at a time).

## 4. API contract

All routes under `/api/auth/*`, plus `/api/me`.

### `POST /api/auth/signup/request-otp`
Body: `{ email }`
- 409 if `email` already belongs to a `User`.
- Generates a 6-digit numeric OTP, hashes it, stores an `OtpChallenge` with a
  10-minute expiry, emails it via nodemailer/Gmail SMTP.
- Rate-limited per email/IP (see §6).
- Response: `{ ok: true }`.

### `POST /api/auth/signup/verify-otp`
Body: `{ name, email, phone, password, otp }`
- Looks up the most recent unconsumed, unexpired `OtpChallenge` for `email`.
- Compares `otp` against `otpHash`; on mismatch increments `attempts` (max 5,
  then the challenge is invalidated and the user must request a new code).
- On match: re-checks email/phone uniqueness, bcrypt-hashes `password`
  (cost 12), creates the `User`, marks the challenge consumed, issues a JWT.
- Response: `{ token, user: { id, name, email, phone } }`.

### `POST /api/auth/login`
Body: `{ identifier, password }` — `identifier` is email or phone.
- Looks up `User` by email or phone, `bcrypt.compare` against `passwordHash`.
- Response: `{ token, user }` (200) or `{ error }` (401). Same generic error
  message whether the identifier doesn't exist or the password is wrong (no
  user enumeration).

### `GET /api/me`
- Requires `Authorization: Bearer <token>`.
- Verifies the JWT, returns `{ id, name, email, phone }` for the caller.
- Used by the frontend's `welcome.html` to greet the user by name.

Forgot-password has **no backend route** in this spec — Spec B's
forgot-password UI is fully built but calls a mocked/stubbed response, per the
earlier scoping decision. A real reset-password endpoint is future work.

## 5. Auth model

- No session table. Login/signup-verify return a signed JWT (short-lived,
  e.g. 7 days), which the frontend stores (see Spec B) and sends back as a
  Bearer token.
- `JWT_SECRET` is an env var, never committed.

## 6. Security

- Passwords: bcrypt, cost factor 12. Never logged, never stored in plaintext,
  satisfies NFR-3 (salted hashes).
- OTPs: 6-digit numeric, hashed at rest, 10-minute expiry, max 5 verify
  attempts, at most one active challenge per email.
- Rate limiting (`express-rate-limit` or equivalent) on `request-otp` and
  `login` per IP and per email, to blunt spam/brute-force.
- TLS in transit via Railway's and Supabase's defaults (NFR-3); Prisma
  connects to Supabase over SSL.
- CORS restricted to known frontend origins.
- Env vars required, all secret, none committed: `DATABASE_URL`, `JWT_SECRET`,
  `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FRONTEND_ORIGIN`.

## 7. Email delivery

- `nodemailer` using Gmail SMTP (`smtp.gmail.com`, port 465/587) with the
  user's Gmail address + a 16-character **App Password** (requires 2FA
  enabled on that Google account — user has confirmed this is ready).
- OTP email is plain, on-brand in tone (not HTML-heavy): states the 6-digit
  code and its 10-minute expiry.

## 8. Testing / verification

- Unit-test the OTP hash/expiry/attempt logic and the password hashing in
  isolation (no real network calls).
- Manual end-to-end verification once deployed: real sign-up through to a
  real inbox receiving the OTP, real login against the created account,
  `/api/me` returning the right profile. This is the actual "up and running"
  bar the user asked for — verified against Spec B's frontend once both are
  implemented, not mocked.

## 9. Out of scope (this spec)

- Restaurant/delivery partner/admin auth.
- Password reset (real backend) — UI-only mock in Spec B.
- Refresh tokens / logout / token revocation — a single short-lived JWT is
  sufficient for this scope.
- Any of the wider SRS §7 schema (orders, menus, ratings, etc.).
