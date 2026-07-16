import type { OrderStatus } from "@prisma/client";

export type OrderActor = "customer" | "restaurant" | "system";

/** Server-authoritative windows (spec §3). Client countdowns are cosmetic. */
export const ORDER_EXPIRY_MS = 2 * 60_000;
export const AUTO_APPROVE_AFTER_MS = 60_000;
export const EXPIRY_REJECTION_REASON = "Not accepted in time";

export const REJECTION_REASONS = [
  "Item unavailable", "Store too busy", "Closing soon", "Other",
] as const;

// The single source of truth for the order lifecycle (CLAUDE.md mandate).
// Post-ready transitions (assigned → … → delivered) arrive with the
// Delivery Partner phase — absent here means disabled.
const TRANSITIONS: Record<OrderActor, Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  restaurant: {
    placed: ["accepted", "rejected"],
    accepted: ["preparing"],
    preparing: ["ready"],
  },
  customer: { placed: ["cancelled"] },
  system: { placed: ["rejected"] },
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return (TRANSITIONS[actor][from] ?? []).includes(to);
}

const TIMESTAMP_FIELDS: Partial<Record<OrderStatus, "acceptedAt" | "preparingAt" | "readyAt" | "closedAt">> = {
  accepted: "acceptedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  rejected: "closedAt",
  cancelled: "closedAt",
};

export function timestampFieldFor(to: OrderStatus): "acceptedAt" | "preparingAt" | "readyAt" | "closedAt" | null {
  return TIMESTAMP_FIELDS[to] ?? null;
}
