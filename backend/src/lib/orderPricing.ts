/** Money is integer cents (see format.ts in the app: 45000 → "Rs 450"). */
export const DELIVERY_FEE_CENTS = 9900;

export function computeOrderTotals(
  items: { priceCents: number; quantity: number }[],
  discountCents = 0,
) {
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  // Discount applies to the food subtotal only and can never exceed it, so the
  // delivery fee is always charged and the total never goes negative.
  const appliedDiscountCents = Math.max(0, Math.min(discountCents, subtotalCents));
  return {
    subtotalCents,
    deliveryFeeCents: DELIVERY_FEE_CENTS,
    discountCents: appliedDiscountCents,
    totalCents: subtotalCents + DELIVERY_FEE_CENTS - appliedDiscountCents,
  };
}
