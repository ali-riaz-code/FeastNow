import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import type { User } from "@prisma/client";
import { createAuthRouter } from "../../src/routes/authRouter";
import { createFakeUserRepository } from "../test-helpers/fakeUserRepository";
import { createFakeOtpRepository } from "../test-helpers/fakeOtpRepository";
import { hashOtp } from "../../src/lib/otp";
import { hashPassword } from "../../src/lib/password";
import { errorHandler } from "../../src/middleware/errorHandler";

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
  // Mirrors the terminal error middleware registered in createApp (app.ts),
  // so these tests can exercise the asyncHandler + error-handler safety net
  // without needing a real Prisma-backed createApp.
  app.use(errorHandler);
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

  it("returns 500 (and does not crash) when sendOtpEmail rejects", async () => {
    const sendOtpEmail = vi.fn().mockRejectedValue(new Error("smtp down"));
    const { app } = buildApp({ sendOtpEmail });

    const res = await request(app)
      .post("/api/auth/signup/request-otp")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong." });
  });
});

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

  it("returns 409 when userRepo.create throws a Prisma P2002 duplicate-key error (e.g. duplicate phone)", async () => {
    const otpRepo = createFakeOtpRepository();
    await otpRepo.create({
      email: "new@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const baseUserRepo = createFakeUserRepository();
    const userRepo = {
      ...baseUserRepo,
      create: vi.fn().mockRejectedValue({ code: "P2002" }),
    };
    const { app } = buildApp({ userRepo, otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "new@example.com",
      phone: "555-0100",
      password: "correct horse battery staple",
      otp: "123456",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "An account with this email or phone already exists." });
  });

  it("matches the email case-insensitively between request-otp and verify-otp", async () => {
    const sendOtpEmail = vi.fn().mockResolvedValue(undefined);
    const { app, userRepo } = buildApp({ sendOtpEmail });

    const requestRes = await request(app)
      .post("/api/auth/signup/request-otp")
      .send({ email: "Ada@Example.com" });
    expect(requestRes.status).toBe(200);
    expect(sendOtpEmail).toHaveBeenCalledWith("ada@example.com", expect.stringMatching(/^\d{6}$/));
    const sentOtp = sendOtpEmail.mock.calls[0][1];

    const verifyRes = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0200",
      password: "correct horse battery staple",
      otp: sentOtp,
    });

    expect(verifyRes.status).toBe(200);
    expect(userRepo.users).toHaveLength(1);
    expect(userRepo.users[0].email).toBe("ada@example.com");
  });

  it("consumes the otp challenge when returning 409 for an already-registered email", async () => {
    const userRepo = createFakeUserRepository();
    await userRepo.create({ name: "Existing", email: "taken@example.com", phone: "555-0999", passwordHash: "x" });
    const otpRepo = createFakeOtpRepository();
    const challenge = await otpRepo.create({
      email: "taken@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const { app } = buildApp({ userRepo, otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Someone Else",
      email: "taken@example.com",
      phone: "555-0111",
      password: "correct horse battery staple",
      otp: "123456",
    });

    expect(res.status).toBe(409);
    expect(challenge.consumedAt).not.toBeNull();
    expect(await otpRepo.findActiveForEmail("taken@example.com")).toBeNull();
  });

  it("creates a restaurant owner with a pending profile when role=restaurant", async () => {
    const otpRepo = createFakeOtpRepository();
    await otpRepo.create({
      email: "rosa@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const { app, userRepo } = buildApp({ otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Rosa",
      email: "rosa@example.com",
      phone: "03119876543",
      password: "password123",
      otp: "123456",
      role: "restaurant",
      businessName: "Rosa's Trattoria",
      businessAddress: "9 Zamzama Blvd, Karachi",
      cuisine: "Italian",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("restaurant");
    expect(userRepo.lastRestaurantOwner).toMatchObject({
      businessName: "Rosa's Trattoria",
      businessAddress: "9 Zamzama Blvd, Karachi",
      cuisine: "Italian",
    });
  });

  it("rejects role=restaurant signup missing business fields", async () => {
    const otpRepo = createFakeOtpRepository();
    await otpRepo.create({
      email: "rosa2@example.com",
      otpHash: await hashOtp("123456"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const { app } = buildApp({ otpRepo });

    const res = await request(app).post("/api/auth/signup/verify-otp").send({
      name: "Rosa",
      email: "rosa2@example.com",
      phone: "03119876544",
      password: "password123",
      otp: "123456",
      role: "restaurant",
      businessAddress: "9 Zamzama Blvd",
      cuisine: "Italian",
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns role on login", async () => {
    const userRepo = createFakeUserRepository([
      {
        id: "user-rosa3",
        name: "Rosa",
        email: "rosa3@example.com",
        phone: "555-0300",
        passwordHash: await hashPassword("correct horse battery staple"),
        role: "restaurant",
        createdAt: new Date(),
      } as User,
    ]);
    const { app } = buildApp({ userRepo });

    const res = await request(app).post("/api/auth/login").send({
      identifier: "rosa3@example.com",
      password: "correct horse battery staple",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("restaurant");
  });

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
