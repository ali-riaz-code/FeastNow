import { useCallback, useState } from "react";
import { m } from "motion/react";
import { clearToken, redirectToLogin } from "../../lib/session";
import { usePolling } from "../../hooks/usePolling";
import { revealUp } from "../../lib/motion";

/** Shown to riders whose account is still pending admin approval. Polls quietly
 *  (so it advances as soon as an admin approves) and offers a manual refresh. */
export function DPendingApprovalScreen({ refresh }: { refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  const poll = useCallback(() => refresh().catch(() => undefined), [refresh]);
  usePolling(poll, 15_000);

  const check = async () => {
    setBusy(true);
    try { await refresh(); } catch { /* stays pending */ }
    setBusy(false);
  };

  const logout = () => { clearToken(); redirectToLogin(); };

  return (
    <m.div className="dpending" variants={revealUp} initial="hidden" animate="show">
      <div className="dpending__badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
        </svg>
      </div>
      <h1 className="serif">Application under review</h1>
      <p>Thanks for signing up to deliver with FeastNow. We're reviewing your details — you'll be able to go online as soon as you're approved.</p>
      <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => void check()}>
        {busy ? "Checking…" : "Check status"}
      </m.button>
      <button type="button" className="dpending__logout" onClick={logout}>Log out</button>
    </m.div>
  );
}
