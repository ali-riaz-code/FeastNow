/** Money is integer cents (see format.ts in the app: 45000 → "Rs 450"). */
export const DELIVERY_FEE_CENTS = 9900;

export function computeOrderTotals(items: { priceCents: number; quantity: number }[]) {
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  return { subtotalCents, deliveryFeeCents: DELIVERY_FEE_CENTS, totalCents: subtotalCents + DELIVERY_FEE_CENTS };
}
