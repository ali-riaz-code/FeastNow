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
