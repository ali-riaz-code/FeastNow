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
