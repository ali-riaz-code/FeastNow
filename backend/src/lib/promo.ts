import type { PromoCode } from "@prisma/client";

export type PromoInvalidReason = "not_found" | "inactive" | "expired";

/** Null means the code is usable right now; otherwise the reason it can't be applied. */
export function promoInvalidReason(promo: PromoCode | null, now: Date): PromoInvalidReason | null {
  if (!promo) return "not_found";
  if (!promo.active) return "inactive";
  if (promo.expiresAt && promo.expiresAt.getTime() <= now.getTime()) return "expired";
  return null;
}

/**
 * Discount in cents, applied to the food subtotal only. A percentage floors to
 * the nearest cent; a fixed amount is capped at the subtotal so the discount can
 * never exceed the food total (delivery fee is always charged separately).
 */
export function computeDiscountCents(
  promo: Pick<PromoCode, "discountType" | "discountValue">,
  subtotalCents: number,
): number {
  if (subtotalCents <= 0) return 0;
  const raw = promo.discountType === "percentage"
    ? Math.floor((subtotalCents * promo.discountValue) / 100)
    : promo.discountValue;
  return Math.max(0, Math.min(raw, subtotalCents));
}
