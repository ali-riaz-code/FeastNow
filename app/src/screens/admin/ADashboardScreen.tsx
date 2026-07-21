import { useCallback, useEffect, useState } from "react";
import { m, useMotionValue, useTransform, animate } from "motion/react";
import { apiGet } from "../../lib/api";
import type { AdminMetrics } from "../../lib/types";
import { Reveal, RevealItem } from "../../components/Reveal";
import { easeExpo } from "../../lib/motion";

const CARDS: { key: keyof AdminMetrics; label: string }[] = [
  { key: "activeOrders", label: "Active orders" },
  { key: "newSignups24h", label: "New sign-ups (24h)" },
  { key: "pendingApprovals", label: "Pending approvals" },
];

/** Count-up metric value. Shows an em-dash until the number arrives, then
 *  animates 0 → value. Reads the existing metric number only (no new data). */
function MetricValue({ value }: { value: number | null }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    if (value == null) return;
    const c = animate(count, value, { duration: 0.9, ease: easeExpo });
    return () => c.stop();
  }, [value, count]);
  if (value == null) return <span className="admin-metric__value mono">—</span>;
  return <m.span className="admin-metric__value mono">{rounded}</m.span>;
}

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
      <Reveal className="admin-metrics">
        {CARDS.map((c, i) => (
          <RevealItem key={c.key} className={`admin-card admin-metric admin-metric--tint-${i % 4}`}>
            <MetricValue value={metrics ? metrics[c.key] : null} />
            <span className="admin-metric__label">{c.label}</span>
          </RevealItem>
        ))}
      </Reveal>
    </div>
  );
}
