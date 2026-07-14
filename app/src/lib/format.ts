/** Money is integer cents; display whole rupees. 45000 → "Rs 450". */
export function formatPrice(priceCents: number): string {
  return `Rs ${Math.round(priceCents / 100).toLocaleString("en-PK")}`;
}

export function formatRating(avg: number): string {
  return avg.toFixed(1);
}
