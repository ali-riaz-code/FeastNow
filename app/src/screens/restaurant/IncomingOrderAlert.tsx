import { useCallback, useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { playChime, unlockChime } from "../../lib/chime";
import { slideUp, popIn } from "../../lib/motion";
import { RejectSheet } from "./ROrdersScreen";

const POLL_MS = 5000;
const RING_MS = 3000;

function AlertCountdown({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  return <span className="ralert__count mono">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
}

export function NewOrderWatcher() {
  const [alertOrder, setAlertOrder] = useState<OrderDTO | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = useRef<Set<string> | null>(null);

  // Sound needs one prior user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => unlockChime();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const poll = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>("/api/restaurant/orders?tab=new&page=1");
    const ids = new Set(res.orders.map((o) => o.id));
    if (known.current !== null) {
      const fresh = res.orders.filter((o) => !known.current!.has(o.id));
      if (fresh.length > 0) setAlertOrder(fresh[0]); // newest first from the API
    }
    known.current = ids;
  }, []);
  usePolling(poll, POLL_MS);

  // Ring + vibrate repeatedly while the alert is on screen.
  useEffect(() => {
    if (!alertOrder) return;
    const ring = () => {
      playChime();
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    };
    ring();
    const id = window.setInterval(ring, RING_MS);
    return () => window.clearInterval(id);
  }, [alertOrder]);

  // Keep an AnimatePresence mounted even with no alert so a just-dismissed
  // alert can play its slide-out exit before the node leaves the tree.
  if (!alertOrder) return <AnimatePresence />;

  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    try {
      await apiSend<{ order: OrderDTO }>("POST", `/api/restaurant/orders/${alertOrder.id}/${path}`, body);
    } catch { /* expired or raced — the queue poll shows the truth */ }
    setBusy(false);
    setRejecting(false);
    setAlertOrder(null);
  };

  return (
    <AnimatePresence>
      <m.div key={alertOrder.id} className="ralert" role="alertdialog" aria-modal="true" aria-label="New incoming order"
        variants={slideUp} initial="hidden" animate="show" exit="exit">
        <m.span className="ralert__icon" variants={popIn} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </m.span>
        <p className="ralert__eyebrow">New order</p>
      <p className="ralert__id mono">{formatOrderNumber(alertOrder.orderNumber)}</p>
      <AlertCountdown expiresAt={alertOrder.expiresAt} />
      <ul className="ralert__items">
        {alertOrder.items.map((i) => (
          <li key={i.id}><span className="mono">{i.quantity}×</span> {i.nameSnapshot}</li>
        ))}
      </ul>
      {alertOrder.note && <p className="ralert__note">“{alertOrder.note}”</p>}
      <p className="ralert__total mono">{formatPrice(alertOrder.totalCents)}</p>
      <div className="ralert__actions">
        <button type="button" className="btn-danger" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
        <button type="button" className="btn-primary ralert__accept" disabled={busy} onClick={() => void act("accept")}>Accept order</button>
      </div>
        <button type="button" className="ralert__dismiss" onClick={() => setAlertOrder(null)}>Decide from the queue</button>
        {rejecting && (
          <RejectSheet onPick={(reason) => void act("reject", { reason })} onClose={() => setRejecting(false)} />
        )}
      </m.div>
    </AnimatePresence>
  );
}
