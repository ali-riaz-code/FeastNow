import type { PrismaClient, PromoCode } from "@prisma/client";

export interface PromoRepository {
  findByCode(code: string): Promise<PromoCode | null>;
}

export function createPromoRepository(prisma: PrismaClient): PromoRepository {
  return {
    findByCode(code) {
      return prisma.promoCode.findUnique({ where: { code } });
    },
  };
}
