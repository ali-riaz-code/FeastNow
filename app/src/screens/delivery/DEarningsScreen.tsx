import { useEffect, useState } from "react";
import { m, useMotionValue, useTransform, animate } from "motion/react";
import { apiGet, NetworkError } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { EarningsDTO } from "../../lib/types";
import { Screen } from "../../components/Screen";
import { AppHeader } from "../../components/AppHeader";
import { staggerParent, staggerChild } from "../../lib/motion";

function formatDeliveredAt(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).toLowerCase();
}

/** Animates a rupee amount up from zero on mount, formatted like the rest of the app. */
function CountUpPrice({ cents }: { cents: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => formatPrice(v));
  useEffect(() => {
    const controls = animate(mv, cents, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [cents, mv]);
  return <m.span className="dearn__card-amount mono">{text}</m.span>;
}

export function DEarningsScreen() {
  const [data, setData] = useState<EarningsDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<EarningsDTO>("/api/delivery/earnings")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof NetworkError ? err.message : "Couldn't load your earnings."));
  }, []);

  if (error) {
    return (
      <Screen>
        <AppHeader title="Earnings" />
        <section className="dearn"><p className="davail__error" role="alert">{error}</p></section>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <AppHeader title="Earnings" />
        <section className="dearn"><p className="dactive__muted">Loading…</p></section>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Earnings" />
      <section className="dearn">
        <div className="dearn__cards">
          <div className="dearn__card">
            <span className="dearn__card-label">Today</span>
            <CountUpPrice cents={data.today.cents} />
            <span className="dearn__card-count">{data.today.count} deliver{data.today.count === 1 ? "y" : "ies"}</span>
          </div>
          <div className="dearn__card">
            <span className="dearn__card-label">This week</span>
            <CountUpPrice cents={data.week.cents} />
            <span className="dearn__card-count">{data.week.count} deliver{data.week.count === 1 ? "y" : "ies"}</span>
          </div>
        </div>

        <h2 className="dearn__subtitle">Completed deliveries</h2>
        {data.deliveries.length === 0 ? (
          <p className="dactive__muted">No completed deliveries yet.</p>
        ) : (
          <m.ul className="dearn__list" variants={staggerParent}
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
            {data.deliveries.map((d) => (
              <m.li key={d.id} className="dearn__row" variants={staggerChild}>
                <div>
                  <p className="dearn__row-name">{d.restaurantName}</p>
                  <p className="dearn__row-meta mono">{formatOrderNumber(d.orderNumber)} · {formatDeliveredAt(d.deliveredAt)}</p>
                </div>
                <span className="dearn__row-payout mono">{formatPrice(d.payoutCents)}</span>
              </m.li>
            ))}
          </m.ul>
        )}
      </section>
    </Screen>
  );
}
