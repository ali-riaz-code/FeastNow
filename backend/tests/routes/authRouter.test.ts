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
