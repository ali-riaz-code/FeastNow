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
