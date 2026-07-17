import { useCallback } from "react";
import type { OwnerProfile } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";

const POLL_MS = 5000;

export function PendingApprovalScreen({ profile, refresh, onContinue }: {
  profile: OwnerProfile;
  refresh: () => Promise<void>;
  onContinue: () => void;
}) {
  const poll = useCallback(async () => {
    if (profile.approvalStatus === "pending") await refresh();
  }, [profile.approvalStatus, refresh]);
  usePolling(poll, POLL_MS);

  if (profile.approvalStatus === "rejected") {
    return (
      <main className="screen pending">
        <h1>Application not approved</h1>
        <p>We couldn't approve “{profile.name}” this time. Contact support for details.</p>
      </main>
    );
  }
  if (profile.approvalStatus === "approved") {
    return (
      <main className="screen pending pending--approved">
        <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--basil)" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-7" />
        </svg>
        <h1>You're live!</h1>
        <p>“{profile.name}” is now on FeastNow. Buon lavoro.</p>
        <button className="btn-primary" onClick={onContinue}>Open your orders</button>
      </main>
    );
  }
  return (
    <main className="screen pending">
      <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="var(--navy)" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 9 5.5 4h13L20 9" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />
      </svg>
      <h1>Reviewing your application</h1>
      <p>“{profile.name}” is being reviewed. This usually takes about a minute — we'll flip the sign to Open the moment you're approved.</p>
      <p className="pending__spinner" role="status" aria-label="Waiting for approval" />
    </main>
  );
}
