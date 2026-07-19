import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { DeliveryOfferDTO } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { playChime, unlockChime } from "../../lib/chime";

const POLL_MS = 4000;
const OFFER_WINDOW_MS = 45_000; // mirrors backend OFFER_WINDOW_MS

function OfferCountdownBar({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  const total = Math.max(1, Math.round(OFFER_WINDOW_MS / 1000));
  const pct = Math.min(100, Math.max(0, (left / total) * 100));
  return (
    <div className="doffer__bar" aria-hidden="true">
      <span className="doffer__bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AssignmentOfferWatcher() {
  const navigate = useNavigate();
  const [offer, setOffer] = useState<DeliveryOfferDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const unlock = () => unlockChime();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const poll = useCallback(async () => {
    const { offers } = await apiGet<{ offers: DeliveryOfferDTO[] }>("/api/delivery/offers");
    setOffer((current) => {
      if (current) return offers.find((o) => o.id === current.id) ?? null; // keep or clear the open one
      return offers[0] ?? null;
    });
  }, []);
  usePolling(poll, POLL_MS);

  // Chime + vibrate once when a fresh offer appears.
  useEffect(() => {
    if (!offer) return;
    playChime();
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  }, [offer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!offer) return null;

  const accept = async () => {
    setBusy(true);
    try {
      await apiSend("POST", `/api/delivery/offers/${offer.id}/accept`);
      setOffer(null);
      navigate("/");
    } catch (err) {
      setOffer(null);
      setToast(err instanceof ApiError && err.status === 409 ? "That order was just taken." : "Couldn't accept — try the next one.");
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try { await apiSend("POST", `/api/delivery/offers/${offer.id}/decline`); }
    catch { /* already gone — poll will reconcile */ }
    setOffer(null);
    setBusy(false);
  };

  return (
    <>
      <div className="doffer" role="alertdialog" aria-modal="true" aria-label="New delivery offer">
        <p className="doffer__eyebrow">New delivery offer</p>
        <p className="doffer__restaurant serif">{offer.restaurantName}</p>
        <p className="doffer__id mono">{formatOrderNumber(offer.orderNumber)}</p>
        <OfferCountdownBar expiresAt={offer.expiresAt} />
        <dl className="doffer__stats">
          <div><dt>To pickup</dt><dd className="mono">{offer.pickupDistanceKm != null ? `${offer.pickupDistanceKm} km` : "—"}</dd></div>
          <div><dt>To dropoff</dt><dd className="mono">{offer.dropoffDistanceKm != null ? `${offer.dropoffDistanceKm} km` : "—"}</dd></div>
          <div><dt>Payout</dt><dd className="mono doffer__payout">{formatPrice(offer.payoutCents)}</dd></div>
        </dl>
        <div className="doffer__actions">
          <button type="button" className="doffer__decline" disabled={busy} onClick={() => void decline()}>Decline</button>
          <button type="button" className="btn-primary doffer__accept" disabled={busy} onClick={() => void accept()}>Accept</button>
        </div>
      </div>
      {toast ? <p className="doffer__toast" role="status" onAnimationEnd={() => setToast(null)}>{toast}</p> : null}
    </>
  );
}
