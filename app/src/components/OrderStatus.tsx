import type { ReactElement } from "react";
import type { OrderDTO, OrderStatus } from "../lib/types";

const icon = (path: ReactElement) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{path}</svg>
);

export const STATUS_META: Record<OrderStatus, { label: string; icon: ReactElement }> = {
  placed: { label: "Order placed", icon: icon(<path d="M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6" />) },
  accepted: { label: "Accepted", icon: icon(<path d="m5 13 4 4 10-10" />) },
  preparing: { label: "Preparing", icon: icon(<><path d="M4 15h16" /><path d="M6 15a6 6 0 0 1 12 0" /><path d="M12 6v3" /></>) },
  ready: { label: "Ready", icon: icon(<><path d="M5 8h14l-1 13H6Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>) },
  assigned: { label: "Rider assigned", icon: icon(<circle cx="12" cy="12" r="9" />) },
  out_for_delivery: { label: "On the way", icon: icon(<circle cx="12" cy="12" r="9" />) },
  delivered: { label: "Delivered", icon: icon(<path d="m5 13 4 4 10-10" />) },
  rejected: { label: "Rejected", icon: icon(<path d="m6 6 12 12M18 6 6 18" />) },
  cancelled: { label: "Cancelled", icon: icon(<path d="m6 6 12 12M18 6 6 18" />) },
};

/** Tone classes are defined in orders.css; tomato/basil only where status semantics demand it. */
const TONE: Partial<Record<OrderStatus, string>> = {
  ready: "status--basil", delivered: "status--basil",
  rejected: "status--tomato", cancelled: "status--tomato",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`status ${TONE[status] ?? "status--navy"}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

const TIMELINE_STEPS = ["placed", "accepted", "preparing", "ready"] as const;
const STEP_TIME: Record<(typeof TIMELINE_STEPS)[number], (o: OrderDTO) => string | null> = {
  placed: (o) => o.placedAt, accepted: (o) => o.acceptedAt,
  preparing: (o) => o.preparingAt, ready: (o) => o.readyAt,
};

export function StatusTimeline({ order }: { order: OrderDTO }) {
  if (order.status === "rejected" || order.status === "cancelled") {
    return (
      <div className="timeline timeline--closed">
        <StatusBadge status={order.status} />
        {order.rejectionReason && <p className="timeline__reason">“{order.rejectionReason}”</p>}
      </div>
    );
  }
  const currentIdx = TIMELINE_STEPS.findIndex((s) => !STEP_TIME[s](order));
  return (
    <ol className="timeline" aria-label="Order progress">
      {TIMELINE_STEPS.map((step, i) => {
        const done = STEP_TIME[step](order) !== null;
        const current = i === (currentIdx === -1 ? TIMELINE_STEPS.length - 1 : currentIdx);
        return (
          <li key={step}
            className={`timeline__step${done ? " timeline__step--done" : ""}${current && !done ? " timeline__step--current" : ""}`}>
            {STATUS_META[step].icon}
            <span>{STATUS_META[step].label}</span>
          </li>
        );
      })}
      {order.status === "ready" && (
        <li className="timeline__note">Waiting for rider — live tracking coming soon.</li>
      )}
    </ol>
  );
}
