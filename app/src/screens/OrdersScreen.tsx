import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../lib/api";
import { formatOrderNumber, formatPrice } from "../lib/format";
import type { OrderDTO, OrdersListResponse } from "../lib/types";
import { usePolling } from "../hooks/usePolling";
import { StatusBadge, StatusTimeline } from "../components/OrderStatus";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";
import { Reveal, RevealItem } from "../components/Reveal";

const POLL_MS = 5000;
const ACTIVE = new Set(["placed", "accepted", "preparing", "ready"]);

export function OrdersScreen() {
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);

  const load = useCallback(async () => {
    const res = await apiGet<OrdersListResponse>("/api/customer/orders?page=1");
    setOrders(res.orders);
  }, []);
  usePolling(load, POLL_MS);

  if (orders === null) {
    return (
      <Screen className="orders">
        <AppHeader title="Orders" />
        <div className="restaurant__hero-skeleton" role="status" aria-label="Loading" />
      </Screen>
    );
  }
  if (orders.length === 0) {
    return (
      <Screen className="orders-empty">
        <AppHeader title="Orders" />
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--brown)" strokeWidth="1.2" aria-hidden="true">
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
        </svg>
        <h1 className="serif">No orders yet</h1>
        <p>Your orders will show up here.</p>
        <Link to="/" className="btn-primary">Browse restaurants</Link>
      </Screen>
    );
  }

  const active = orders.filter((o) => ACTIVE.has(o.status));
  const past = orders.filter((o) => !ACTIVE.has(o.status));
  return (
    <Screen className="orders">
      <AppHeader title="Orders" />
      {active.length > 0 && <h1 className="serif">Happening now</h1>}
      <Reveal>
        {active.map((o) => (
          <RevealItem key={o.id}>
            <Link to={`/orders/${o.id}`} className="order-card order-card--active">
              <header>
                <span className="order-card__name">{o.restaurantName}</span>
                <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
              </header>
              <StatusTimeline order={o} />
              <footer><span className="mono">{formatPrice(o.totalCents)}</span> · cash on delivery</footer>
            </Link>
          </RevealItem>
        ))}
      </Reveal>
      {past.length > 0 && <h2 className="serif">Past orders</h2>}
      <Reveal>
        {past.map((o) => (
          <RevealItem key={o.id}>
            <Link to={`/orders/${o.id}`} className="order-card">
              <header>
                <span className="order-card__name">{o.restaurantName}</span>
                <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
              </header>
              <StatusBadge status={o.status} />
              <footer><span className="mono">{formatPrice(o.totalCents)}</span></footer>
            </Link>
          </RevealItem>
        ))}
      </Reveal>
    </Screen>
  );
}
