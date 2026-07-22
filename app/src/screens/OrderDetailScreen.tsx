import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiSend, ApiError } from "../lib/api";
import { formatClock, formatOrderNumber, formatPrice } from "../lib/format";
import type { OrderDTO } from "../lib/types";
import { usePolling } from "../hooks/usePolling";
import { StatusTimeline } from "../components/OrderStatus";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";

const POLL_MS = 5000;

export function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [missing, setMissing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ order: OrderDTO }>(`/api/customer/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else throw err; // usePolling swallows and retries
    }
  }, [id]);
  usePolling(load, POLL_MS);

  const cancel = async () => {
    if (!order || !window.confirm("Cancel this order?")) return;
    setCancelling(true);
    try {
      const res = await apiSend<{ order: OrderDTO }>("POST", `/api/customer/orders/${order.id}/cancel`);
      setOrder(res.order);
    } catch {
      await load(); // 409 → the restaurant beat us to it; show the truth
    } finally {
      setCancelling(false);
    }
  };

  if (missing) {
    return (
      <Screen className="restaurant--message">
        <p>This order doesn't exist.</p>
        <button className="btn-retry" onClick={() => navigate("/orders")}>Back to orders</button>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen className="orders">
        <AppHeader
          title="Order"
          leading={
            <button className="appbar__back" aria-label="Go back" onClick={() => navigate(-1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
          }
        />
        <div className="restaurant__hero-skeleton" role="status" aria-label="Loading" />
      </Screen>
    );
  }

  return (
    <Screen className="order-detail">
      <AppHeader
        title="Order"
        leading={
          <button className="appbar__back" aria-label="Go back" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        }
      />
      <header className="order-detail__head">
        <h1 className="serif">{order.restaurantName}</h1>
        <p className="mono">{formatOrderNumber(order.orderNumber)} · placed {formatClock(order.placedAt)}</p>
      </header>

      <StatusTimeline order={order} />

      <section className="receipt" aria-label="Order summary">
        {order.items.map((i) => (
          <div key={i.id} className="receipt__line">
            <span className="mono">{i.quantity}×</span>
            <span className="receipt__name">{i.nameSnapshot}</span>
            <span className="mono">{formatPrice(i.priceAtOrderCents * i.quantity)}</span>
          </div>
        ))}
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Subtotal</span><span className="mono">{formatPrice(order.subtotalCents)}</span></div>
        <div className="receipt__line receipt__line--sub"><span /><span className="receipt__name">Delivery fee</span><span className="mono">{formatPrice(order.deliveryFeeCents)}</span></div>
        <div className="receipt__line receipt__line--total"><span /><span className="receipt__name">Total (cash)</span><span className="mono">{formatPrice(order.totalCents)}</span></div>
      </section>

      <section className="order-detail__meta">
        <p><strong>Deliver to:</strong> {order.deliveryAddress}</p>
        {order.note && <p><strong>Note:</strong> {order.note}</p>}
      </section>

      {order.status === "placed" && (
        <button type="button" className="btn-danger" disabled={cancelling} onClick={() => void cancel()}>
          {cancelling ? "Cancelling…" : "Cancel order"}
        </button>
      )}
    </Screen>
  );
}
