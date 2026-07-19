import { Router } from "express";
import type { UserRepository } from "../repositories/userRepository";
import type { OtpRepository } from "../repositories/otpRepository";
import { generateOtp, hashOtp, compareOtp } from "../lib/otp";
import { hashPassword, comparePassword } from "../lib/password";
import { signToken } from "../lib/jwt";
import { createOtpRequestLimiter, createLoginLimiter } from "../middleware/rateLimit";
import { asyncHandler } from "../middleware/asyncHandler";

const OTP_TTL_MS = 10 * 60 * 1000;

// Valid bcrypt (cost 12) hash of an arbitrary fixed string. Not a secret —
// it exists purely so the "no such user" login branch performs the same
// bcrypt.compare work as the "wrong password" branch, closing a timing
// side-channel that would otherwise let an attacker distinguish whether an
// account exists from response latency alone.
const DUMMY_PASSWORD_HASH = "$2a$12$J9oBPpa.2hqJ/.SU3M.D0.umu4YTX7uQrkbBR42901YSRsUdWJfS6";

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

  router.post("/signup/request-otp", createOtpRequestLimiter(), asyncHandler(async (req, res) => {
    let { email } = req.body ?? {};
    if (typeof email === "string") {
      email = email.trim().toLowerCase();
    }
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
  }));

  const MAX_OTP_ATTEMPTS = 5;

  router.post("/signup/verify-otp", createOtpRequestLimiter(), asyncHandler(async (req, res) => {
    const { name, phone, password, otp } = req.body ?? {};
    let { email } = req.body ?? {};
    if (typeof email === "string") {
      email = email.trim().toLowerCase();
    }
    if (
      typeof name !== "string" || !name.trim() ||
      !isValidEmail(email) ||
      typeof phone !== "string" || !phone.trim() ||
      typeof password !== "string" || password.length < 8 ||
      typeof otp !== "string"
    ) {
      return res.status(400).json({ error: "Missing or invalid signup details." });
    }

    const { role, businessName, businessAddress, cuisine, vehicleType } = req.body ?? {};
    const isRestaurant = role === "restaurant";
    if (isRestaurant && (
      typeof businessName !== "string" || !businessName.trim() ||
      typeof businessAddress !== "string" || !businessAddress.trim() ||
      typeof cuisine !== "string" || !cuisine.trim()
    )) {
      return res.status(400).json({ error: "Business name, address, and cuisine are required for a restaurant account." });
    }

    const isPartner = role === "delivery_partner";
    const VEHICLES = ["bike", "motorcycle", "car"];
    if (isPartner && (typeof vehicleType !== "string" || !VEHICLES.includes(vehicleType))) {
      return res.status(400).json({ error: "A valid vehicle type is required for a delivery account." });
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
      await deps.otpRepo.consume(challenge.id);
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = isRestaurant
        ? await deps.userRepo.createRestaurantOwner({
            name, email, phone, passwordHash,
            businessName: businessName.trim(), businessAddress: businessAddress.trim(), cuisine: cuisine.trim(),
          })
        : isPartner
        ? await deps.userRepo.createDeliveryPartner({ name, email, phone, passwordHash, vehicleType })
        : await deps.userRepo.create({ name, email, phone, passwordHash });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "P2002") {
        return res.status(409).json({ error: "An account with this email or phone already exists." });
      }
      throw err;
    }
    await deps.otpRepo.consume(challenge.id);
    const token = signToken({ userId: user.id }, deps.jwtSecret);

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  }));

  router.post("/login", createLoginLimiter(), asyncHandler(async (req, res) => {
    let { identifier } = req.body ?? {};
    const { password } = req.body ?? {};
    if (typeof identifier !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Identifier and password are required." });
    }
    identifier = identifier.trim();

    const genericError = { error: "Incorrect email/phone or password." };
    const user = await deps.userRepo.findByEmailOrPhone(identifier);
    if (!user) {
      // Perform the same bcrypt work as the wrong-password branch so
      // response timing does not reveal whether the account exists.
      await comparePassword(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json(genericError);
    }

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json(genericError);
    }

    if (user.suspendedAt) {
      return res.status(403).json({ error: "This account has been suspended." });
    }

    const token = signToken({ userId: user.id }, deps.jwtSecret);
    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  }));

  return router;
}
