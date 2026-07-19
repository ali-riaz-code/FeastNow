import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePartner } from "../../PartnerContext";
import { usePolling } from "../../hooks/usePolling";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import { getPosition, LOCATION_PING_MS } from "../../lib/geolocation";
import type { ActiveDeliveryDTO, PartnerProfile } from "../../lib/types";

export function DAvailabilityScreen() {
  const { profile, setProfile } = usePartner();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasActive, setHasActive] = useState(false);

  const online = profile.availabilityStatus === "online";

  // Keep the toggle honest: an active delivery locks the rider Online.
  const checkActive = useCallback(async () => {
    const { active } = await apiGet<{ active: ActiveDeliveryDTO | null }>("/api/delivery/active");
    setHasActive(active != null);
  }, []);
  usePolling(checkActive, 8_000);

  // Location ping loop while online (silent — a transient failure just retries).
  useEffect(() => {
    if (!online) return;
    let stopped = false;
    const ping = async () => {
      try {
        const { lat, lng } = await getPosition();
        if (!stopped) await apiSend("POST", "/api/delivery/location", { lat, lng });
      } catch { /* transient — next tick retries */ }
    };
    const id = window.setInterval(() => void ping(), LOCATION_PING_MS);
    return () => { stopped = true; window.clearInterval(id); };
  }, [online]);

  const goOnline = async () => {
    setBusy(true); setError(null);
    try {
      const { lat, lng } = await getPosition();
      await apiSend("POST", "/api/delivery/location", { lat, lng });
      const { partner } = await apiSend<{ partner: PartnerProfile }>("POST", "/api/delivery/availability", { status: "online" });
      setProfile(partner);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("We couldn't confirm your location. Enable location access and try again.");
      } else {
        setError("Enable location access to go online and receive delivery offers.");
      }
    } finally {
      setBusy(false);
    }
  };

  const goOffline = async () => {
    setBusy(true); setError(null);
    try {
      const { partner } = await apiSend<{ partner: PartnerProfile }>("POST", "/api/delivery/availability", { status: "offline" });
      setProfile(partner);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409
        ? "Finish your active delivery before going offline."
        : "Couldn't update your status. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (hasActive) return; // locked online during a delivery
    void (online ? goOffline() : goOnline());
  };

  return (
    <section className="dscreen davail">
      <header className="davail__head">
        <h1 className="dscreen__title serif">You're {online ? "online" : "offline"}</h1>
        <p className="davail__sub">
          {online
            ? hasActive ? "You have an active delivery in progress." : "Waiting for a delivery offer nearby…"
            : "Go online to start receiving delivery offers."}
        </p>
      </header>

      <div className={`davail__orb${online ? " davail__orb--on" : ""}${online && !hasActive ? " davail__orb--pulse" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
        </svg>
      </div>

      <button
        type="button"
        className={`dtoggle${online ? " dtoggle--on" : ""}`}
        role="switch" aria-checked={online}
        disabled={busy || hasActive}
        onClick={toggle}
      >
        <span className="dtoggle__knob" aria-hidden="true" />
        {busy ? "…" : online ? "Go offline" : "Go online"}
      </button>

      {hasActive ? (
        <p className="davail__locked" role="status">
          You're locked online during a delivery. <Link to="/">Open your active delivery →</Link>
        </p>
      ) : null}

      {error ? <p className="davail__error" role="alert">{error}</p> : null}
    </section>
  );
}
