import { useCallback, useState } from "react";
import { clearToken, redirectToLogin } from "../../lib/session";
import { usePolling } from "../../hooks/usePolling";

/** Dormant this phase (partners auto-approve on signup), but wired so the gate
 *  works once Admin approval ships. Polls quietly and offers a manual refresh. */
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
    <div className="dpending">
      <div className="dpending__badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
        </svg>
      </div>
      <h1 className="serif">Application under review</h1>
      <p>Thanks for signing up to deliver with FeastNow. We're reviewing your details — you'll be able to go online as soon as you're approved.</p>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void check()}>
        {busy ? "Checking…" : "Check status"}
      </button>
      <button type="button" className="dpending__logout" onClick={logout}>Log out</button>
    </div>
  );
}
