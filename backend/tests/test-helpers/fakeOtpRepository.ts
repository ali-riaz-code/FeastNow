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
