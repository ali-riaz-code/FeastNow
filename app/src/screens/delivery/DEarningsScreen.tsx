import { useEffect, useState } from "react";
import { apiGet, NetworkError } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { EarningsDTO } from "../../lib/types";

function formatDeliveredAt(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).toLowerCase();
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
    return <section className="dscreen"><p className="davail__error" role="alert">{error}</p></section>;
  }
  if (!data) {
    return <section className="dscreen"><p className="dactive__muted">Loading…</p></section>;
  }

  return (
    <section className="dscreen dearn">
      <h1 className="dscreen__title serif">Earnings</h1>

      <div className="dearn__cards">
        <div className="dearn__card">
          <span className="dearn__card-label">Today</span>
          <span className="dearn__card-amount mono">{formatPrice(data.today.cents)}</span>
          <span className="dearn__card-count">{data.today.count} deliver{data.today.count === 1 ? "y" : "ies"}</span>
        </div>
        <div className="dearn__card">
          <span className="dearn__card-label">This week</span>
          <span className="dearn__card-amount mono">{formatPrice(data.week.cents)}</span>
          <span className="dearn__card-count">{data.week.count} deliver{data.week.count === 1 ? "y" : "ies"}</span>
        </div>
      </div>

      <h2 className="dearn__subtitle">Completed deliveries</h2>
      {data.deliveries.length === 0 ? (
        <p className="dactive__muted">No completed deliveries yet.</p>
      ) : (
        <ul className="dearn__list">
          {data.deliveries.map((d) => (
            <li key={d.id} className="dearn__row">
              <div>
                <p className="dearn__row-name">{d.restaurantName}</p>
                <p className="dearn__row-meta mono">{formatOrderNumber(d.orderNumber)} · {formatDeliveredAt(d.deliveredAt)}</p>
              </div>
              <span className="dearn__row-payout mono">{formatPrice(d.payoutCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
