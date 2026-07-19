import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { ActiveDeliveryDTO } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";

const POLL_MS = 5000;

/** Google Maps directions deep-link to a free-text destination. */
function mapsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function DActiveDeliveryScreen() {
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveDeliveryDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    const { active: next } = await apiGet<{ active: ActiveDeliveryDTO | null }>("/api/delivery/active");
    setActive(next);
    setLoaded(true);
  }, []);
  usePolling(poll, POLL_MS);

  if (!loaded) {
    return <section className="dscreen"><p className="dactive__muted">Loading…</p></section>;
  }

  if (!active) {
    return (
      <section className="dscreen dactive dactive--empty">
        <div className="dactive__empty-orb" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
          </svg>
        </div>
        <h1 className="dscreen__title serif">No active delivery</h1>
        <p className="dactive__muted">Go online to start receiving offers.</p>
        <Link className="btn-primary" to="/availability">Availability</Link>
      </section>
    );
  }

  const { order } = active;
  const beforePickup = order.status === "assigned";
  const destination = beforePickup ? active.restaurantAddress : order.deliveryAddress;
  const callNumber = beforePickup ? active.restaurantPhone : order.customerPhone;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  const act = async (path: string, body?: unknown, onDone?: () => void) => {
    setBusy(true); setError(null);
    try {
      await apiSend("POST", `/api/delivery/orders/${order.id}/${path}`, body);
      await poll();
      onDone?.();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409
        ? "This delivery already moved on. Refreshing…"
        : "Couldn't complete that. Check your connection.");
      await poll();
    } finally {
      setBusy(false);
    }
  };

  const unable = () => {
    if (!window.confirm("Release this delivery? It will be offered to another rider.")) return;
    void act("unable", undefined, () => navigate("/availability"));
  };

  return (
    <section className="dscreen dactive">
      <div className="dactive__card">
        <div className="dactive__stage" data-stage={order.status}>
          {beforePickup ? "Head to the restaurant" : "Deliver to the customer"}
        </div>
        <h1 className="dactive__restaurant serif">{order.restaurantName}</h1>
        <p className="dactive__meta mono">{formatOrderNumber(order.orderNumber)} · {itemCount} item{itemCount === 1 ? "" : "s"}</p>
        {active.payoutCents != null ? <p className="dactive__payout mono">{formatPrice(active.payoutCents)} payout</p> : null}

        <p className="dactive__dest">
          <span className="dactive__dest-label">{beforePickup ? "Pickup" : "Dropoff"}</span>
          {destination || "—"}
        </p>
        {!beforePickup ? <p className="dactive__customer">For {order.customerName}</p> : null}

        <div className="dactive__links">
          {destination ? (
            <a className="btn-primary dactive__nav" href={mapsUrl(destination)} target="_blank" rel="noreferrer">Navigate</a>
          ) : null}
          {callNumber ? <a className="dactive__call" href={`tel:${callNumber}`}>Call</a> : null}
        </div>
      </div>

      {beforePickup ? (
        <button type="button" className="btn-primary dactive__primary" disabled={busy} onClick={() => void act("pickup")}>
          Confirm pickup
        </button>
      ) : (
        <div className="dactive__deliver">
          <label className="dactive__note-label" htmlFor="proof-note">Delivery note (optional)</label>
          <textarea
            id="proof-note" className="dactive__note" maxLength={300} rows={2}
            placeholder="e.g. Left at the door with the guard"
            value={note} onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" className="btn-primary dactive__primary" disabled={busy}
            onClick={() => void act("deliver", { note: note.trim() || undefined }, () => navigate("/availability"))}>
            Mark as delivered
          </button>
        </div>
      )}

      <button type="button" className="dactive__unable" disabled={busy} onClick={unable}>Unable to complete</button>
      {error ? <p className="davail__error" role="alert">{error}</p> : null}
    </section>
  );
}
