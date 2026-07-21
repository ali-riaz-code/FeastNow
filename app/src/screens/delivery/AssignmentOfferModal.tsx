import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "motion/react";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { DeliveryOfferDTO } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { useCountdown } from "../../hooks/useCountdown";
import { playChime, unlockChime } from "../../lib/chime";
import { slideUp } from "../../lib/motion";

const POLL_MS = 4000;
const OFFER_WINDOW_MS = 45_000; // mirrors backend OFFER_WINDOW_MS

function OfferCountdownBar({ expiresAt }: { expiresAt: string }) {
  const left = useCountdown(expiresAt);
  const total = Math.max(1, Math.round(OFFER_WINDOW_MS / 1000));
  const frac = Math.min(1, Math.max(0, left / total));
  return (
    <div className="doffer__bar" aria-hidden="true">
      <m.span className="doffer__bar-fill" style={{ transformOrigin: "left" }}
        animate={{ scaleX: frac }} transition={{ ease: "linear", duration: 0.5 }} />
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

  const accept = async () => {
    if (!offer) return;
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
    if (!offer) return;
    setBusy(true);
    try { await apiSend("POST", `/api/delivery/offers/${offer.id}/decline`); }
    catch { /* already gone — poll will reconcile */ }
    setOffer(null);
    setBusy(false);
  };

  return (
    <>
      <AnimatePresence>
        {offer && (
          <>
            <m.div key="backdrop" className="doffer__backdrop" aria-hidden="true"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <m.div key="panel" className="doffer" role="alertdialog" aria-modal="true" aria-label="New delivery offer"
              variants={slideUp} initial="hidden" animate="show" exit="exit">
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
                <m.button type="button" className="btn-primary doffer__accept" whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => void accept()}>Accept</m.button>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
      {toast ? <p className="doffer__toast" role="status" onAnimationEnd={() => setToast(null)}>{toast}</p> : null}
    </>
  );
}
