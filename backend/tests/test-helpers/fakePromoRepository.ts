import type { PromoCode } from "@prisma/client";
import type { PromoRepository } from "../../src/repositories/promoRepository";

let seq = 0;

export function makePromo(overrides: Partial<PromoCode> = {}): PromoCode {
  seq += 1;
  return {
    id: `promo-${seq}`,
    code: `SAVE${seq}`,
    discountType: "percentage",
    discountValue: 20,
    active: true,
    expiresAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

export function createFakePromoRepository(seed: PromoCode[] = []): PromoRepository {
  const promos = [...seed];
  return {
    async findByCode(code) {
      return promos.find((p) => p.code === code) ?? null;
    },
  };
}
