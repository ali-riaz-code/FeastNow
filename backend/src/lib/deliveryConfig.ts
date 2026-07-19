export const OFFER_WINDOW_MS = 45_000;
export const MAX_OFFER_ATTEMPTS = 5;
export const PAYOUT_BASE_CENTS = 5_000;    // PKR 50.00
export const PAYOUT_PER_KM_CENTS = 1_500;  // PKR 15.00 / km
export const LOCATION_STALE_MS = 60_000;
export const LOCATION_PING_MS = 10_000;

/** Snapshot-friendly payout: base fare + per-km, or base-only when distance is unknown. */
export function computePayoutCents(distanceKm: number | null): number {
  if (distanceKm === null) return PAYOUT_BASE_CENTS;
  return PAYOUT_BASE_CENTS + Math.round(distanceKm * PAYOUT_PER_KM_CENTS);
}
