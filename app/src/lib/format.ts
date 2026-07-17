/** Money is integer cents; display whole rupees. 45000 → "Rs 450". */
export function formatPrice(priceCents: number): string {
  return `Rs ${Math.round(priceCents / 100).toLocaleString("en-PK")}`;
}

export function formatRating(avg: number): string {
  return avg.toFixed(1);
}

/** Human-friendly order reference: 1042 → "#FN-1042". */
export function formatOrderNumber(n: number): string {
  return `#FN-${n}`;
}

/** "03001234567" → "03•••••••67" — restaurants see a masked customer phone. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 2)}${"•".repeat(phone.length - 4)}${phone.slice(-2)}`;
}

/** ISO timestamp → local wall-clock "8:42 pm" (marketplace audience format). */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" }).toLowerCase();
}
