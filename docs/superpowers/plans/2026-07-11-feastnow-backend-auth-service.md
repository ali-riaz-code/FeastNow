# FeastNow Backend Auth Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the first real backend in this repo — a Node+TypeScript/Express API that handles Customer sign-up (with real Gmail-SMTP email OTP verification) and login, backed by PostgreSQL (Supabase) via Prisma, deployed on Railway.

**Architecture:** A small Express app assembled from dependency-injected pieces — pure library functions (password hashing, OTP generation/hashing, JWT sign/verify, email sending) wrapped by two thin Prisma-backed repositories (`User`, `OtpChallenge`), consumed by two route factories (`authRouter`, `meRouter`) that take their dependencies as constructor arguments. This makes every route testable with in-memory fake repositories — no test ever needs a live database.

**Tech Stack:** Node.js, TypeScript, Express, Prisma + PostgreSQL (Supabase), bcryptjs, jsonwebtoken, nodemailer (Gmail SMTP), express-rate-limit, vitest + supertest for testing, Railway for hosting.

## Global Constraints

- Passwords: bcryptjs, cost factor 12 (salted hashes — NFR-3).
- OTP: 6-digit numeric, hashed at rest (never stored/logged in plaintext), 10-minute expiry, max 5 verify attempts, at most one active challenge per email.
- JWT: short-lived (7 days), `JWT_SECRET` from env, never committed.
- CORS restricted to known frontend origins (env-configured), not `*`.
- Env vars required, never committed: `DATABASE_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FRONTEND_ORIGIN`.
- No user-enumeration: login returns the same generic error for "no such account" and "wrong password."
- No forgot-password backend route in this plan (frontend mocks it — separate spec).
- Only `role: customer` is ever created by this flow (`restaurant`/`delivery_partner`/`admin` enum values reserved, unused).

---

### Task 1: Backend project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/.env` (local only — gitignored by the root `.gitignore`'s `.env` rule)
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/repositories/prismaClient.ts`

**Interfaces:**
- Produces: `prisma` — a `PrismaClient` singleton, imported by every later repository task.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "feastnow-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc && prisma generate",
    "start": "prisma migrate deploy && node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.13"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.12.12",
    "@types/nodemailer": "^6.4.15",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 5: Create `backend/.env.example`**

```
DATABASE_URL="postgresql://user:password@host:5432/postgres?sslmode=require"
JWT_SECRET="replace-with-a-long-random-string"
GMAIL_USER="you@gmail.com"
GMAIL_APP_PASSWORD="16-char-app-password"
FRONTEND_ORIGIN="https://feast-now.vercel.app,http://localhost:5500"
PORT=3000
```

- [ ] **Step 6: Create `backend/.env` for local dev**

Copy `.env.example` to `.env` and fill in real values:
- `DATABASE_URL`: your Supabase project's connection string (Project Settings → Database → Connection string → URI).
- `JWT_SECRET`: any long random string (e.g. generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
- `GMAIL_USER` / `GMAIL_APP_PASSWORD`: the Gmail address and App Password you already have ready.
- `FRONTEND_ORIGIN`: `http://localhost:5500` is enough for now (add the real Vercel domain in Task 14).

This file is already covered by the root `.gitignore`'s `.env` rule — confirm with:

Run: `git check-ignore -v backend/.env`
Expected: prints a match against the root `.gitignore`'s `.env` line (confirms it will never be committed).

- [ ] **Step 7: Install dependencies**

Run (from `backend/`): `npm install`
Expected: installs without error, creates `backend/node_modules/` and `backend/package-lock.json`.

- [ ] **Step 8: Generate the Prisma client**

Run (from `backend/`): `npx prisma generate`
Expected: `Generated Prisma Client ... to ./node_modules/@prisma/client` — this only reads the schema file, it does not need a reachable database.

- [ ] **Step 9: Create `backend/src/repositories/prismaClient.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 10: Verify the scaffold compiles**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/vitest.config.ts backend/.env.example backend/prisma/schema.prisma backend/src/repositories/prismaClient.ts
git commit -m "feat(backend): scaffold Node+TS+Express+Prisma project"
```

---

### Task 2: Password hashing

**Files:**
- Create: `backend/src/lib/password.ts`
- Test: `backend/tests/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `comparePassword(plain: string, hash: string): Promise<boolean>` — consumed by the auth router (Tasks 10, 11).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/lib/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../src/lib/password";

describe("password hashing", () => {
  it("produces a hash that is not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
  });

  it("comparePassword returns true for the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await comparePassword("correct horse battery staple", hash)).toBe(true);
  });

  it("comparePassword returns false for the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await comparePassword("wrong password", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/lib/password.test.ts`
Expected: FAIL — cannot find module `../../src/lib/password`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/lib/password.ts
import bcrypt from "bcryptjs";

const PASSWORD_BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_BCRYPT_COST);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/lib/password.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/password.ts backend/tests/lib/password.test.ts
git commit -m "feat(backend): add bcrypt password hashing"
```

---

### Task 3: OTP generation and hashing

**Files:**
- Create: `backend/src/lib/otp.ts`
- Test: `backend/tests/lib/otp.test.ts`

**Interfaces:**
- Produces: `generateOtp(): string`, `hashOtp(otp: string): Promise<string>`, `compareOtp(otp: string, hash: string): Promise<boolean>` — consumed by the auth router (Tasks 9, 10).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/lib/otp.test.ts
import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, compareOtp } from "../../src/lib/otp";

describe("otp", () => {
  it("generateOtp returns a 6-digit numeric string", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("compareOtp returns true for the correct code", async () => {
    const hash = await hashOtp("123456");
    expect(await compareOtp("123456", hash)).toBe(true);
  });

  it("compareOtp returns false for the wrong code", async () => {
    const hash = await hashOtp("123456");
    expect(await compareOtp("654321", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/lib/otp.test.ts`
Expected: FAIL — cannot find module `../../src/lib/otp`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/lib/otp.ts
import bcrypt from "bcryptjs";

const OTP_BCRYPT_COST = 10;

export function generateOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_COST);
}

export async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/lib/otp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/otp.ts backend/tests/lib/otp.test.ts
git commit -m "feat(backend): add OTP generation and hashing"
```

---

### Task 4: JWT sign/verify

**Files:**
- Create: `backend/src/lib/jwt.ts`
- Test: `backend/tests/lib/jwt.test.ts`

**Interfaces:**
- Produces: `AuthTokenPayload` (`{ userId: string }`), `signToken(payload: AuthTokenPayload, secret: string): string`, `verifyToken(token: string, secret: string): AuthTokenPayload` — consumed by the auth router (Tasks 9–11) and `requireAuth` middleware (Task 12).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/lib/jwt.test.ts
import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/lib/jwt";

const SECRET = "test-secret";

describe("jwt", () => {
  it("verifyToken returns the original payload for a valid token", () => {
    const token = signToken({ userId: "user-123" }, SECRET);
    expect(verifyToken(token, SECRET)).toMatchObject({ userId: "user-123" });
  });

  it("verifyToken throws for a token signed with a different secret", () => {
    const token = signToken({ userId: "user-123" }, "other-secret");
    expect(() => verifyToken(token, SECRET)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/lib/jwt.test.ts`
Expected: FAIL — cannot find module `../../src/lib/jwt`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/lib/jwt.ts
import jwt from "jsonwebtoken";

export interface AuthTokenPayload {
  userId: string;
}

export function signToken(payload: AuthTokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token: string, secret: string): AuthTokenPayload {
  return jwt.verify(token, secret) as AuthTokenPayload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/lib/jwt.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/jwt.ts backend/tests/lib/jwt.test.ts
git commit -m "feat(backend): add JWT sign/verify helpers"
```

---

### Task 5: OTP email sending

**Files:**
- Create: `backend/src/lib/mailer.ts`
- Test: `backend/tests/lib/mailer.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sendOtpEmail(transporter: Pick<import("nodemailer").Transporter, "sendMail">, to: string, otp: string): Promise<void>` — consumed by `server.ts` (Task 13, wrapped with a real nodemailer transporter) and by the auth router's injected `sendOtpEmail` dependency (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/lib/mailer.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendOtpEmail } from "../../src/lib/mailer";

describe("sendOtpEmail", () => {
  it("sends the otp code and expiry in the message text", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    await sendOtpEmail({ sendMail }, "customer@example.com", "482913");

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe("customer@example.com");
    expect(message.text).toContain("482913");
    expect(message.text).toContain("10 minutes");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/lib/mailer.test.ts`
Expected: FAIL — cannot find module `../../src/lib/mailer`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/lib/mailer.ts
import type { Transporter } from "nodemailer";

export async function sendOtpEmail(
  transporter: Pick<Transporter, "sendMail">,
  to: string,
  otp: string
): Promise<void> {
  await transporter.sendMail({
    from: "FeastNow <no-reply@feastnow.app>",
    to,
    subject: "Your FeastNow verification code",
    text: `Your FeastNow verification code is ${otp}. It expires in 10 minutes.`,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/lib/mailer.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/mailer.ts backend/tests/lib/mailer.test.ts
git commit -m "feat(backend): add injectable OTP email sender"
```

---

### Task 6: Rate limiting middleware

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`
- Test: `backend/tests/middleware/rateLimit.test.ts`

**Interfaces:**
- Produces: `createOtpRequestLimiter(overrides?: Partial<import("express-rate-limit").Options>)`, `createLoginLimiter(overrides?: Partial<import("express-rate-limit").Options>)` — both return Express middleware, consumed directly inside the auth router (Tasks 9, 11).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/middleware/rateLimit.test.ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createOtpRequestLimiter, createLoginLimiter } from "../../src/middleware/rateLimit";

function buildApp(limiter: ReturnType<typeof createOtpRequestLimiter>) {
  const app = express();
  app.get("/probe", limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("rate limiting", () => {
  it("allows requests under the limit and blocks the one after", async () => {
    const app = buildApp(createOtpRequestLimiter({ windowMs: 60_000, limit: 2 }));

    const first = await request(app).get("/probe");
    const second = await request(app).get("/probe");
    const third = await request(app).get("/probe");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });

  it("createLoginLimiter also blocks after its configured limit", async () => {
    const app = buildApp(createLoginLimiter({ windowMs: 60_000, limit: 1 }));

    const first = await request(app).get("/probe");
    const second = await request(app).get("/probe");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/middleware/rateLimit.test.ts`
Expected: FAIL — cannot find module `../../src/middleware/rateLimit`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/middleware/rateLimit.ts
import rateLimit, { type Options } from "express-rate-limit";

const DEFAULT_OTP_LIMIT: Partial<Options> = { windowMs: 15 * 60 * 1000, limit: 5 };
const DEFAULT_LOGIN_LIMIT: Partial<Options> = { windowMs: 15 * 60 * 1000, limit: 10 };

export function createOtpRequestLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    ...DEFAULT_OTP_LIMIT,
    ...overrides,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many verification code requests. Try again later." },
  });
}

export function createLoginLimiter(overrides: Partial<Options> = {}) {
  return rateLimit({
    ...DEFAULT_LOGIN_LIMIT,
    ...overrides,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again later." },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/middleware/rateLimit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/rateLimit.ts backend/tests/middleware/rateLimit.test.ts
git commit -m "feat(backend): add rate limiting for OTP requests and login"
```

---

### Task 7: User and OTP repositories

**Files:**
- Create: `backend/src/repositories/userRepository.ts`
- Create: `backend/src/repositories/otpRepository.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1).
- Produces:
  - `UserRepository` interface + `createUserRepository(prisma): UserRepository` with methods `findById(id)`, `findByEmail(email)`, `findByEmailOrPhone(identifier)`, `create({name,email,phone,passwordHash})` — all returning the Prisma `User` type (or `null`).
  - `OtpRepository` interface + `createOtpRepository(prisma): OtpRepository` with methods `invalidateActiveForEmail(email)`, `create({email,otpHash,expiresAt})`, `findActiveForEmail(email)`, `incrementAttempts(id)`, `consume(id)` — returning the Prisma `OtpChallenge` type where applicable.
  - Consumed by the auth router (Tasks 9–11) and me router (Task 12), always via their interface types — never imported directly, so fake implementations (Task 9) can substitute for tests.

These are thin Prisma pass-throughs with no business logic of their own — the business rules (OTP expiry/attempts, uniqueness, hashing) live in the route handlers that call them and are tested there via fakes. There is no live database in this repo's test environment, so these two files are verified by type-checking now and exercised for real during Task 15's manual end-to-end verification.

- [ ] **Step 1: Write `backend/src/repositories/userRepository.ts`**

```ts
import type { PrismaClient, User } from "@prisma/client";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  create(data: { name: string; email: string; phone: string; passwordHash: string }): Promise<User>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },
    findByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },
    findByEmailOrPhone(identifier) {
      return prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { phone: identifier }] },
      });
    },
    create(data) {
      return prisma.user.create({ data });
    },
  };
}
```

- [ ] **Step 2: Write `backend/src/repositories/otpRepository.ts`**

```ts
import type { PrismaClient, OtpChallenge } from "@prisma/client";

export interface OtpRepository {
  invalidateActiveForEmail(email: string): Promise<void>;
  create(data: { email: string; otpHash: string; expiresAt: Date }): Promise<OtpChallenge>;
  findActiveForEmail(email: string): Promise<OtpChallenge | null>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string): Promise<void>;
}

export function createOtpRepository(prisma: PrismaClient): OtpRepository {
  return {
    async invalidateActiveForEmail(email) {
      await prisma.otpChallenge.updateMany({
        where: { email, consumedAt: null },
        data: { consumedAt: new Date() },
      });
    },
    create(data) {
      return prisma.otpChallenge.create({ data });
    },
    findActiveForEmail(email) {
      return prisma.otpChallenge.findFirst({
        where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
    },
    async incrementAttempts(id) {
      await prisma.otpChallenge.update({
        where: { id },
        data: { attempts: { increment: 1 } },
      });
    },
    async consume(id) {
      await prisma.otpChallenge.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
    },
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/repositories/userRepository.ts backend/src/repositories/otpRepository.ts
git commit -m "feat(backend): add Prisma-backed user and OTP repositories"
```

---

### Task 8: Fake repositories for testing

**Files:**
- Create: `backend/tests/test-helpers/fakeUserRepository.ts`
- Create: `backend/tests/test-helpers/fakeOtpRepository.ts`

**Interfaces:**
- Consumes: `UserRepository`, `OtpRepository` types (Task 7).
- Produces: `createFakeUserRepository(seed?: User[]): UserRepository & { users: User[] }`, `createFakeOtpRepository(): OtpRepository & { challenges: OtpChallenge[] }` — in-memory implementations consumed by every route test from Task 9 onward.

- [ ] **Step 1: Write `backend/tests/test-helpers/fakeUserRepository.ts`**

```ts
import type { User } from "@prisma/client";
import type { UserRepository } from "../../src/repositories/userRepository";

export function createFakeUserRepository(seed: User[] = []): UserRepository & { users: User[] } {
  const users = [...seed];
  let nextId = seed.length + 1;

  return {
    users,
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async findByEmailOrPhone(identifier) {
      return users.find((u) => u.email === identifier || u.phone === identifier) ?? null;
    },
    async create(data) {
      const user: User = {
        id: `user-${nextId++}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: "customer",
        createdAt: new Date(),
      } as User;
      users.push(user);
      return user;
    },
  };
}
```

- [ ] **Step 2: Write `backend/tests/test-helpers/fakeOtpRepository.ts`**

```ts
import type { OtpChallenge } from "@prisma/client";
import type { OtpRepository } from "../../src/repositories/otpRepository";

export function createFakeOtpRepository(): OtpRepository & { challenges: OtpChallenge[] } {
  const challenges: OtpChallenge[] = [];
  let nextId = 1;

  return {
    challenges,
    async invalidateActiveForEmail(email) {
      const now = new Date();
      challenges
        .filter((c) => c.email === email && !c.consumedAt)
        .forEach((c) => { c.consumedAt = now; });
    },
    async create(data) {
      const challenge: OtpChallenge = {
        id: `otp-${nextId++}`,
        email: data.email,
        otpHash: data.otpHash,
        attempts: 0,
        expiresAt: data.expiresAt,
        consumedAt: null,
        createdAt: new Date(),
      };
      challenges.push(challenge);
      return challenge;
    },
    async findActiveForEmail(email) {
      const now = new Date();
      const active = challenges
        .filter((c) => c.email === email && !c.consumedAt && c.expiresAt > now)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return active[0] ?? null;
    },
    async incrementAttempts(id) {
      const challenge = challenges.find((c) => c.id === id);
      if (challenge) challenge.attempts += 1;
    },
    async consume(id) {
      const challenge = challenges.find((c) => c.id === id);
      if (challenge) challenge.consumedAt = new Date();
    },
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run (from `backend/`): `npx tsc --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test-helpers/fakeUserRepository.ts backend/tests/test-helpers/fakeOtpRepository.ts
git commit -m "test(backend): add in-memory fake repositories for route tests"
```

---

### Task 9: Auth router — `POST /signup/request-otp`

**Files:**
- Create: `backend/src/routes/authRouter.ts`
- Test: `backend/tests/routes/authRouter.test.ts`

**Interfaces:**
- Consumes: `UserRepository`, `OtpRepository` (Task 7), `generateOtp`/`hashOtp`/`compareOtp` (Task 3), `hashPassword`/`comparePassword` (Task 2), `signToken` (Task 4), `createOtpRequestLimiter`/`createLoginLimiter` (Task 6), `createFakeUserRepository`/`createFakeOtpRepository` (Task 8).
- Produces: `AuthRouterDeps` interface (`{ userRepo: UserRepository; otpRepo: OtpRepository; sendOtpEmail: (to: string, otp: string) => Promise<void>; jwtSecret: string }`) and `createAuthRouter(deps: AuthRouterDeps): Router` — consumed by `app.ts` (Task 13). This task implements only the `/signup/request-otp` route on that router; Tasks 10–11 add the remaining routes to the same file.

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/routes/authRouter.test.ts
import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { createAuthRouter } from "../../src/routes/authRouter";
import { createFakeUserRepository } from "../test-helpers/fakeUserRepository";
import { createFakeOtpRepository } from "../test-helpers/fakeOtpRepository";

const JWT_SECRET = "test-secret";

function buildApp(overrides: {
  userRepo?: ReturnType<typeof createFakeUserRepository>;
  otpRepo?: ReturnType<typeof createFakeOtpRepository>;
  sendOtpEmail?: (to: string, otp: string) => Promise<void>;
} = {}) {
  const userRepo = overrides.userRepo ?? createFakeUserRepository();
  const otpRepo = overrides.otpRepo ?? createFakeOtpRepository();
  const sendOtpEmail = overrides.sendOtpEmail ?? vi.fn().mockResolvedValue(undefined);

  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter({ userRepo, otpRepo, sendOtpEmail, jwtSecret: JWT_SECRET }));
  return { app, userRepo, otpRepo, sendOtpEmail };
}

describe("POST /api/auth/signup/request-otp", () => {
  it("sends an otp and returns ok for a new email", async () => {
    const { app, otpRepo, sendOtpEmail } = buildApp();

    const res = await request(app)
      .post("/api/auth/signup/request-otp")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(otpRepo.challenges).toHaveLength(1);
    expect(sendOtpEmail).toHaveBeenCalledWith("new@example.com", expect.stringMatching(/^\d{6}$/));
  });

  it("returns 409 when the email is already registered", async () => {
    const userRepo = createFakeUserRepository();
    await userRepo.create({ name: "Existing", email: "taken@example.com", phone: "1", passwordHash: "x" });
    const { app } = buildApp({ userRepo });

    const res = await request(app)
      .post("/api/auth/signup/request-otp")
      .send({ email: "taken@example.com" });

    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid email", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/api/auth/signup/request-otp").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: FAIL — cannot find module `../../src/routes/authRouter`.

- [ ] **Step 3: Write the implementation**

```ts
// backend/src/routes/authRouter.ts
import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import type { OtpRepository } from "../repositories/otpRepository";
import { generateOtp, hashOtp } from "../lib/otp";
import { createOtpRequestLimiter, createLoginLimiter } from "../middleware/rateLimit";

const OTP_TTL_MS = 10 * 60 * 1000;

export interface AuthRouterDeps {
  userRepo: UserRepository;
  otpRepo: OtpRepository;
  sendOtpEmail: (to: string, otp: string) => Promise<void>;
  jwtSecret: string;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post("/signup/request-otp", createOtpRequestLimiter(), async (req, res) => {
    const { email } = req.body ?? {};
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "A valid email is required." });
    }

    const existing = await deps.userRepo.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    await deps.otpRepo.invalidateActiveForEmail(email);
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    await deps.otpRepo.create({
      email,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await deps.sendOtpEmail(email, otp);

    return res.status(200).json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/authRouter.ts backend/tests/routes/authRouter.test.ts
git commit -m "feat(backend): add POST /api/auth/signup/request-otp"
```

---

### Task 10: Auth router — `POST /signup/verify-otp`

**Files:**
- Modify: `backend/src/routes/authRouter.ts`
- Modify: `backend/tests/routes/authRouter.test.ts`

**Interfaces:**
- Consumes: `compareOtp` (Task 3), `hashPassword` (Task 2), `signToken` (Task 4), plus everything already in `AuthRouterDeps` (Task 9).
- Produces: nothing new exported — adds a route to the existing router.

- [ ] **Step 1: Add the failing tests**

Append to `backend/tests/routes/authRouter.test.ts` (add these imports at the top alongside the existing ones, and this `describe` block at the end of the file):

```ts
// add to the top imports:
import { hashOtp } from "../../src/lib/otp";
```

```ts
// append to the end of the file:
describe("POST /api/auth/signup/verify-otp", () => {
  it("creates the account and returns a token for the correct code", async () => {
    const otpRepo = createFakeOtpRepository();
    await otpRepo.create({
      email: "new@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const { app, userRepo } = buildApp({ otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "new@example.com",
      phone: "555-0100",
      password: "correct horse battery staple",
      otp: "123456",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user).toMatchObject({ name: "Ada Lovelace", email: "new@example.com" });
    expect(userRepo.users).toHaveLength(1);
  });

  it("returns 400 and does not create an account for the wrong code", async () => {
    const otpRepo = createFakeOtpRepository();
    await otpRepo.create({
      email: "new@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const { app, userRepo } = buildApp({ otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "new@example.com",
      phone: "555-0100",
      password: "correct horse battery staple",
      otp: "000000",
    });

    expect(res.status).toBe(400);
    expect(userRepo.users).toHaveLength(0);
    expect(otpRepo.challenges[0].attempts).toBe(1);
  });

  it("returns 400 when there is no active challenge for the email", async () => {
    const { app } = buildApp();

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "nobody@example.com",
      phone: "555-0100",
      password: "correct horse battery staple",
      otp: "123456",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 after 5 incorrect attempts even with the right code afterward", async () => {
    const otpRepo = createFakeOtpRepository();
    const challenge = await otpRepo.create({
      email: "new@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    for (let i = 0; i < 5; i++) {
      await otpRepo.incrementAttempts(challenge.id);
    }
    const { app } = buildApp({ otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "new@example.com",
      phone: "555-0100",
      password: "correct horse battery staple",
      otp: "123456",
    });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: the 3 existing tests still PASS; the 4 new tests FAIL (404 — no such route yet).

- [ ] **Step 3: Add the route to `backend/src/routes/authRouter.ts`**

Update the imports at the top of the file:

```ts
import { generateOtp, hashOtp, compareOtp } from "../lib/otp";
import { hashPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
```

Add this route inside `createAuthRouter`, after the `/signup/request-otp` route and before `return router;`:

```ts
  const MAX_OTP_ATTEMPTS = 5;

  router.post("/signup/verify-otp", async (req, res) => {
    const { name, email, phone, password, otp } = req.body ?? {};
    if (
      typeof name !== "string" || !name.trim() ||
      !isValidEmail(email) ||
      typeof phone !== "string" || !phone.trim() ||
      typeof password !== "string" || password.length < 8 ||
      typeof otp !== "string"
    ) {
      return res.status(400).json({ error: "Missing or invalid signup details." });
    }

    const challenge = await deps.otpRepo.findActiveForEmail(email);
    if (!challenge) {
      return res.status(400).json({ error: "No active verification code for this email. Request a new one." });
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(400).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const matches = await compareOtp(otp, challenge.otpHash);
    if (!matches) {
      await deps.otpRepo.incrementAttempts(challenge.id);
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    const existingUser = await deps.userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const user = await deps.userRepo.create({ name, email, phone, passwordHash });
    await deps.otpRepo.consume(challenge.id);
    const token = signToken({ userId: user.id }, deps.jwtSecret);

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/authRouter.ts backend/tests/routes/authRouter.test.ts
git commit -m "feat(backend): add POST /api/auth/signup/verify-otp"
```

---

### Task 11: Auth router — `POST /login`

**Files:**
- Modify: `backend/src/routes/authRouter.ts`
- Modify: `backend/tests/routes/authRouter.test.ts`

**Interfaces:**
- Consumes: `comparePassword` (Task 2), `signToken` (Task 4), `createLoginLimiter` (Task 6, already imported in Task 9).
- Produces: nothing new exported — adds the final route to the existing router.

- [ ] **Step 1: Add the failing tests**

Add this import at the top of `backend/tests/routes/authRouter.test.ts`, alongside the existing ones:

```ts
import { hashPassword } from "../../src/lib/password";
```

Append to the end of the file:

```ts
describe("POST /api/auth/login", () => {
  it("returns a token for correct credentials", async () => {
    const userRepo = createFakeUserRepository();
    await userRepo.create({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      passwordHash: await hashPassword("correct horse battery staple"),
    });
    const { app } = buildApp({ userRepo });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "ada@example.com",
      password: "correct horse battery staple",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
  });

  it("returns 401 for a wrong password", async () => {
    const userRepo = createFakeUserRepository();
    await userRepo.create({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      passwordHash: await hashPassword("correct horse battery staple"),
    });
    const { app } = buildApp({ userRepo });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "ada@example.com",
      password: "wrong password",
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown identifier", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/api/auth/login").send({
      identifier: "nobody@example.com",
      password: "whatever",
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: the 7 existing tests still PASS; the 3 new tests FAIL (404 — no such route yet).

- [ ] **Step 3: Add the route to `backend/src/routes/authRouter.ts`**

Update the imports at the top of the file:

```ts
import { hashPassword, comparePassword } from "../lib/password";
```

Add this route inside `createAuthRouter`, after the `/signup/verify-otp` route and before `return router;`:

```ts
  router.post("/login", createLoginLimiter(), async (req, res) => {
    const { identifier, password } = req.body ?? {};
    if (typeof identifier !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Identifier and password are required." });
    }

    const genericError = { error: "Incorrect email/phone or password." };
    const user = await deps.userRepo.findByEmailOrPhone(identifier);
    if (!user) {
      return res.status(401).json(genericError);
    }

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json(genericError);
    }

    const token = signToken({ userId: user.id }, deps.jwtSecret);
    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `npx vitest run tests/routes/authRouter.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/authRouter.ts backend/tests/routes/authRouter.test.ts
git commit -m "feat(backend): add POST /api/auth/login"
```

---

### Task 12: `requireAuth` middleware and `GET /api/me`

**Files:**
- Create: `backend/src/middleware/requireAuth.ts`
- Create: `backend/src/routes/meRouter.ts`
- Test: `backend/tests/routes/meRouter.test.ts`

**Interfaces:**
- Consumes: `verifyToken` (Task 4), `UserRepository` (Task 7), `createFakeUserRepository` (Task 8).
- Produces: `AuthenticatedRequest` (extends `Request` with `userId?: string`), `createRequireAuth(jwtSecret: string)` middleware factory, `MeRouterDeps` (`{ userRepo: UserRepository; jwtSecret: string }`), `createMeRouter(deps: MeRouterDeps): Router` — consumed by `app.ts` (Task 13).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/routes/meRouter.test.ts
import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createMeRouter } from "../../src/routes/meRouter";
import { createFakeUserRepository } from "../test-helpers/fakeUserRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";

function buildApp(userRepo = createFakeUserRepository()) {
  const app = express();
  app.use(express.json());
  app.use("/api/me", createMeRouter({ userRepo, jwtSecret: JWT_SECRET }));
  return { app, userRepo };
}

describe("GET /api/me", () => {
  it("returns the caller's profile for a valid token", async () => {
    const { app, userRepo } = buildApp();
    const user = await userRepo.create({
      name: "Ada Lovelace", email: "ada@example.com", phone: "555-0100", passwordHash: "x",
    });
    const token = signToken({ userId: user.id }, JWT_SECRET);

    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, name: "Ada Lovelace", email: "ada@example.com", phone: "555-0100" });
  });

  it("returns 401 with no Authorization header", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/routes/meRouter.test.ts`
Expected: FAIL — cannot find module `../../src/routes/meRouter`.

- [ ] **Step 3: Write `backend/src/middleware/requireAuth.ts`**

```ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function createRequireAuth(jwtSecret: string) {
  return function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    try {
      const payload = verifyToken(token, jwtSecret);
      req.userId = payload.userId;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}
```

- [ ] **Step 4: Write `backend/src/routes/meRouter.ts`**

```ts
import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import { createRequireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

export interface MeRouterDeps {
  userRepo: UserRepository;
  jwtSecret: string;
}

export function createMeRouter(deps: MeRouterDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.jwtSecret);

  router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = await deps.userRepo.findById(req.userId!);
    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    return res.status(200).json({ id: user.id, name: user.name, email: user.email, phone: user.phone });
  });

  return router;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/routes/meRouter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/requireAuth.ts backend/src/routes/meRouter.ts backend/tests/routes/meRouter.test.ts
git commit -m "feat(backend): add requireAuth middleware and GET /api/me"
```

---

### Task 13: App assembly and server entrypoint

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/app.test.ts`

**Interfaces:**
- Consumes: `createUserRepository`/`createOtpRepository` (Task 7), `createAuthRouter` (Tasks 9–11), `createMeRouter` (Task 12), `sendOtpEmail` (Task 5), `prisma` (Task 1).
- Produces: `AppConfig` (`{ prisma: PrismaClient; jwtSecret: string; frontendOrigins: string[]; sendOtpEmail: (to: string, otp: string) => Promise<void> }`), `createApp(config: AppConfig)` — this is the final integration point; nothing later depends on it (Task 14 deploys it).

- [ ] **Step 1: Write the failing test**

```ts
// backend/tests/app.test.ts
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";

describe("createApp", () => {
  const app = createApp({
    prisma: new PrismaClient(),
    jwtSecret: "test-secret",
    frontendOrigins: ["http://localhost:5500"],
    sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("POST /api/auth/login without a body returns 400 without touching the database", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
  });

  it("mounts /api/me and requires auth", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `npx vitest run tests/app.test.ts`
Expected: FAIL — cannot find module `../src/app`.

- [ ] **Step 3: Write `backend/src/app.ts`**

```ts
import express from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { createUserRepository } from "./repositories/userRepository";
import { createOtpRepository } from "./repositories/otpRepository";
import { createAuthRouter } from "./routes/authRouter";
import { createMeRouter } from "./routes/meRouter";

export interface AppConfig {
  prisma: PrismaClient;
  jwtSecret: string;
  frontendOrigins: string[];
  sendOtpEmail: (to: string, otp: string) => Promise<void>;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.use(cors({ origin: config.frontendOrigins }));
  app.use(express.json());

  const userRepo = createUserRepository(config.prisma);
  const otpRepo = createOtpRepository(config.prisma);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.use("/api/auth", createAuthRouter({
    userRepo, otpRepo, sendOtpEmail: config.sendOtpEmail, jwtSecret: config.jwtSecret,
  }));
  app.use("/api/me", createMeRouter({ userRepo, jwtSecret: config.jwtSecret }));

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `npx vitest run tests/app.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `backend/src/server.ts`** (entrypoint — not unit tested; exercised in Task 15's manual verification)

```ts
import "dotenv/config";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { sendOtpEmail as sendOtpEmailRaw } from "./lib/mailer";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "";

if (!JWT_SECRET || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
  throw new Error("Missing required environment variables: JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const prisma = new PrismaClient();

const app = createApp({
  prisma,
  jwtSecret: JWT_SECRET,
  frontendOrigins: FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  sendOtpEmail: (to, otp) => sendOtpEmailRaw(transporter, to, otp),
});

app.listen(PORT, () => {
  console.log(`FeastNow backend listening on port ${PORT}`);
});
```

- [ ] **Step 6: Verify the whole project builds**

Run (from `backend/`): `npm run build`
Expected: `tsc` compiles to `dist/`, then `prisma generate` runs, no errors.

- [ ] **Step 7: Run the full test suite**

Run (from `backend/`): `npm test`
Expected: PASS — all tests across every file from Tasks 2–13 (26 tests total: 3 password + 3 otp + 2 jwt + 1 mailer + 2 rateLimit + 10 authRouter + 3 meRouter + 3 app).

- [ ] **Step 8: Commit**

```bash
git add backend/src/app.ts backend/src/server.ts backend/tests/app.test.ts
git commit -m "feat(backend): assemble Express app and add server entrypoint"
```

---

### Task 14: Deploy — Supabase, Railway, real secrets (manual — human action required)

This task cannot be executed by an autonomous coding agent: it requires clicking through third-party dashboards and handling real secrets. Do this yourself, or hand these exact steps to whoever has the Supabase/Railway/Gmail accounts.

- [ ] **Step 1: Get the Supabase connection string**

In the Supabase dashboard: Project → Settings → Database → Connection string → URI. Copy it (it looks like `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`).

- [ ] **Step 2: Run the first migration against the real database**

In `backend/.env`, set `DATABASE_URL` to the real Supabase connection string from Step 1 (temporarily, for this one command — Railway will set its own copy of this env var in Step 5).

Run (from `backend/`): `npx prisma migrate dev --name init`
Expected: creates `backend/prisma/migrations/<timestamp>_init/migration.sql`, applies it to the Supabase database, prints "Your database is now in sync with your schema."

- [ ] **Step 3: Commit the migration**

```bash
git add backend/prisma/migrations
git commit -m "feat(backend): add initial Prisma migration"
```

- [ ] **Step 4: Create the Railway project**

In Railway: New Project → Deploy from GitHub repo → select this repository. Under the service's Settings → set **Root Directory** to `backend`. Railway auto-detects the Node app via `package.json`'s `build`/`start` scripts.

- [ ] **Step 5: Set Railway environment variables**

In the Railway service's Variables tab, add:
- `DATABASE_URL` — the same Supabase connection string from Step 1.
- `JWT_SECRET` — a long random string (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, different from any value used in `backend/.env`).
- `GMAIL_USER` — your Gmail address.
- `GMAIL_APP_PASSWORD` — your 16-character Gmail App Password.
- `FRONTEND_ORIGIN` — the Vercel domain(s) serving `landing/`, comma-separated (e.g. `https://feast-now.vercel.app`). Add `http://localhost:5500` too if you test the frontend locally against this deployed backend.

Do not set `PORT` — Railway injects it automatically and `server.ts` already reads `process.env.PORT`.

- [ ] **Step 6: Deploy and confirm health**

Trigger a deploy (Railway does this automatically once the GitHub connection and root directory are set, or push a commit to `main`). Once deployed, Railway shows a public URL. Confirm:

Run: `curl https://<your-railway-url>/health`
Expected: `{"ok":true}`

- [ ] **Step 7: Record the deployed URL**

Once you have the Railway URL, it needs to be wired into the frontend (Spec B) as the API base URL — note it down for that implementation plan.

---

### Task 15: End-to-end manual verification (manual — human action required)

This is the "up and running" bar from the original request — confirms the real OTP email flow works against the deployed service, not just against fakes.

- [ ] **Step 1: Real sign-up request**

Run: `curl -X POST https://<your-railway-url>/api/auth/signup/request-otp -H "Content-Type: application/json" -d "{\"email\":\"<an email address you control>\"}"`
Expected: `{"ok":true}`, and a real email arrives in that inbox within a minute containing a 6-digit code.

- [ ] **Step 2: Real sign-up verification**

Using the code from the email:

Run: `curl -X POST https://<your-railway-url>/api/auth/signup/verify-otp -H "Content-Type: application/json" -d "{\"name\":\"Test User\",\"email\":\"<same email>\",\"phone\":\"555-0100\",\"password\":\"a real test password\",\"otp\":\"<the 6-digit code>\"}"`
Expected: `{"token":"...", "user": {...}}`.

- [ ] **Step 3: Real login**

Run: `curl -X POST https://<your-railway-url>/api/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"<same email>\",\"password\":\"a real test password\"}"`
Expected: `{"token":"...", "user": {...}}`.

- [ ] **Step 4: Real `/api/me`**

Run: `curl https://<your-railway-url>/api/me -H "Authorization: Bearer <token from step 3>"`
Expected: `{"id":"...","name":"Test User","email":"<same email>","phone":"555-0100"}`.

If all four steps succeed, the backend is genuinely "up and running" per the original request, and Spec B's frontend can be pointed at this URL.
