import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import type { OtpRepository } from "../repositories/otpRepository";
import { generateOtp, hashOtp, compareOtp } from "../lib/otp";
import { hashPassword } from "../lib/password";
import { signToken } from "../lib/jwt";
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

  return router;
}
