import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../../lib/api";
import type { AdminMetrics } from "../../lib/types";

const CARDS: { key: keyof AdminMetrics; label: string }[] = [
  { key: "activeOrders", label: "Active orders" },
  { key: "newSignups24h", label: "New sign-ups (24h)" },
  { key: "pendingApprovals", label: "Pending approvals" },
];

export function ADashboardScreen() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try { setMetrics(await apiGet<{ metrics: AdminMetrics }>("/api/admin/metrics").then((r) => r.metrics)); }
    catch { setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Dashboard</h1>
      {error && <p className="admin-error">Couldn't load metrics. <button className="btn-retry" onClick={() => void load()}>Retry</button></p>}
      <div className="admin-metrics">
        {CARDS.map((c) => (
          <div key={c.key} className="admin-card admin-metric">
            <span className="admin-metric__value mono">{metrics ? metrics[c.key] : "—"}</span>
            <span className="admin-metric__label">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
