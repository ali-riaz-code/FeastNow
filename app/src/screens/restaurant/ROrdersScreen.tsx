import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { formatClock, formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { StatusBadge } from "../../components/OrderStatus";
import { Screen } from "../../components/Screen";
import { Reveal } from "../../components/Reveal";
import { staggerChild } from "../../lib/motion";

const POLL_MS = 5000;
const REJECT_REASONS = ["Item unavailable", "Store too busy", "Closing soon", "Other"];
export type QueueTab = "new" | "preparing" | "ready" | "history";
const TABS: { key: QueueTab; label: string }[] = [
  { key: "new", label: "New" }, { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" }, { key: "history", label: "History" },
];

function Countdown({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <span className={`rcountdown mono${left <= 30 ? " rcountdown--urgent" : ""}`} aria-label="Time left to accept">
      {mm}:{ss}
    </span>
  );
}

export function RejectSheet({ onPick, onClose }: { onPick: (reason: string) => void; onClose: () => void }) {
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  return (
    <div className="rsheet__backdrop" role="dialog" aria-modal="true" aria-label="Reject order" onClick={onClose}>
      <div className="rsheet" onClick={(e) => e.stopPropagation()}>
        <h2>Why are you rejecting?</h2>
        {REJECT_REASONS.map((r) => r === "Other" ? (
          <button key={r} type="button" className="rsheet__option" onClick={() => setShowOther(true)}>{r}</button>
        ) : (
          <button key={r} type="button" className="rsheet__option" onClick={() => onPick(r)}>{r}</button>
        ))}
        {showOther && (
          <div className="rsheet__other">
            <input type="text" value={other} maxLength={200} placeholder="Tell the customer why"
              onChange={(e) => setOther(e.target.value)} />
            <button type="button" className="btn-danger" disabled={!other.trim()} onClick={() => onPick(other.trim())}>
              Reject order
            </button>
          </div>
        )}
        <button type="button" className="rsheet__cancel" onClick={onClose}>Keep the order</button>
      </div>
    </div>
  );
}

function elapsedMin(fromIso: string | null): string {
  if (!fromIso) return "0 min";
  return `${Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 60_000))} min`;
}

export function ROrdersScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as QueueTab) ?? "new";
  const [data, setData] = useState<OrdersListResponse | null>(null);
  const [rejecting, setRejecting] = useState<OrderDTO | null>(null);

  // New-order detection (full-screen alert) lives in Task 18's shell-level
  // NewOrderWatcher, not here — this screen only renders the queue.
  const load = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>(`/api/restaurant/orders?tab=${tab}&page=1`);
    setData(res);
  }, [tab]);
  usePolling(load, POLL_MS);
  useEffect(() => { setData(null); }, [tab]);

  const act = async (order: OrderDTO, path: string, body?: unknown) => {
    try {
      await apiSend<{ order: OrderDTO }>("POST", `/api/restaurant/orders/${order.id}/${path}`, body);
    } catch { /* 409 = the card is stale (expired/raced) — the reload below shows the truth */ }
    setRejecting(null);
    await load();
  };

  const counts = data?.counts;
  return (
    <Screen className="rqueue">
      <div className="rtabs" role="tablist" aria-label="Order queues">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`rtabs__tab${tab === t.key ? " rtabs__tab--active" : ""}`}
            onClick={() => setParams({ tab: t.key })}>
            {t.label}
            {counts && t.key !== "history" && counts[t.key] > 0 && (
              <span className="rtabs__count mono">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {data === null && <div className="restaurant__hero-skeleton" role="status" aria-label="Loading" />}
      {data !== null && data.orders.length === 0 && (
        <div className="rqueue__empty">
          <p>{tab === "new" ? "New orders will appear here." : tab === "history" ? "Completed and rejected orders will appear here." : "Nothing here right now."}</p>
        </div>
      )}

      <Reveal className="rqueue__list" inView={false}>
      <AnimatePresence>
      {data?.orders.map((o) => (
        <m.article key={o.id} className="rorder-card" layout
          variants={staggerChild} exit={{ opacity: 0, scale: 0.97 }}>
          <header>
            <Link to={`/orders/${o.id}`} className="rorder-card__id mono">{formatOrderNumber(o.orderNumber)}</Link>
            <span className="rorder-card__time">{formatClock(o.placedAt)}</span>
            {o.status === "placed" && <Countdown expiresAt={o.expiresAt} />}
            {o.status === "preparing" && <span className="mono rorder-card__elapsed">{elapsedMin(o.preparingAt)}</span>}
            {(tab === "history" || tab === "ready") && <StatusBadge status={o.status} />}
          </header>
          <ul className="rorder-card__items">
            {o.items.map((i) => <li key={i.id}><span className="mono">{i.quantity}×</span> {i.nameSnapshot}</li>)}
          </ul>
          {o.note && <p className="rorder-card__note">“{o.note}”</p>}
          <footer>
            <span className="mono rorder-card__total">{formatPrice(o.totalCents)}</span>
            {o.status === "placed" && (
              <span className="rorder-card__actions">
                <button type="button" className="btn-danger" onClick={() => setRejecting(o)}>Reject</button>
                <button type="button" className="btn-primary attn-pulse" onClick={() => void act(o, "accept")}>Accept</button>
              </span>
            )}
            {o.status === "accepted" && (
              <button type="button" className="btn-primary" onClick={() => void act(o, "status", { to: "preparing" })}>Start preparing</button>
            )}
            {o.status === "preparing" && (
              <button type="button" className="btn-primary" onClick={() => void act(o, "status", { to: "ready" })}>Mark Ready</button>
            )}
            {o.status === "ready" && <span className="rorder-card__waiting">Waiting for pickup</span>}
          </footer>
        </m.article>
      ))}
      </AnimatePresence>
      </Reveal>

      {rejecting && (
        <RejectSheet
          onPick={(reason) => void act(rejecting, "reject", { reason })}
          onClose={() => setRejecting(null)}
        />
      )}
    </Screen>
  );
}
