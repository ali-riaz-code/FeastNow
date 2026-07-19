import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, ApiError } from "../../lib/api";
import { formatClock, formatOrderNumber, formatPrice, maskPhone } from "../../lib/format";
import type { OrderDTO } from "../../lib/types";
import { usePolling } from "../../hooks/usePolling";
import { StatusBadge } from "../../components/OrderStatus";

const POLL_MS = 5000;

export function ROrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ order: OrderDTO }>(`/api/restaurant/orders/${id}`);
      setOrder(res.order);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setMissing(true);
      else throw err;
    }
  }, [id]);
  usePolling(load, POLL_MS);

  if (missing) {
    return (
      <main className="screen restaurant--message">
        <p>This order doesn't exist.</p>
        <button className="btn-retry" onClick={() => navigate("/")}>Back to orders</button>
      </main>
    );
  }
  if (!order) {
    return <main className="screen rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }

  const times: [string, string | null][] = [
    ["Placed", order.placedAt], ["Accepted", order.acceptedAt],
    ["Preparing", order.preparingAt], ["Ready", order.readyAt],
    ["Assigned", order.assignedAt], ["Out for delivery", order.outForDeliveryAt],
    ["Delivered", order.deliveredAt], ["Closed", order.closedAt],
  ];

  // Assignment progression, shown once the order is ready (auto-assign fires) or beyond.
  const showAssignment = ["ready", "assigned", "out_for_delivery", "delivered"].includes(order.status);
  const assignmentLine =
    order.status === "delivered" ? `Delivered by ${order.deliveryPartnerName ?? "your rider"}`
    : order.status === "out_for_delivery" ? `Out for delivery · ${order.deliveryPartnerName ?? "rider on the way"}`
    : order.deliveryPartnerName ? `Rider assigned: ${order.deliveryPartnerName}`
    : "Finding a rider…";

  return (
    <main className="screen rdetail printable">
      <header className="rdetail__head">
        <button className="restaurant__back rdetail__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h1 className="mono">{formatOrderNumber(order.orderNumber)}</h1>
        <StatusBadge status={order.status} />
        {order.rejectionReason && <p className="rdetail__reason">“{order.rejectionReason}”</p>}
      </header>

      <section className="receipt" aria-label="Items">
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

      <section className="rdetail__meta">
        <p><strong>Customer:</strong> {order.customerName} · <span className="mono">{maskPhone(order.customerPhone)}</span></p>
        <p><strong>Deliver to:</strong> {order.deliveryAddress}</p>
        {order.note && <p><strong>Note:</strong> {order.note}</p>}
      </section>

      {showAssignment && (
        <section className="rdetail__assignment" aria-label="Delivery assignment">
          <StatusBadge status={order.status} />
          <span className="rdetail__assignment-line">{assignmentLine}</span>
        </section>
      )}

      <section className="rdetail__times" aria-label="Timestamps">
        {times.filter(([, t]) => t !== null).map(([label, t]) => (
          <p key={label}><span>{label}</span><span className="mono">{formatClock(t!)}</span></p>
        ))}
      </section>

      <button type="button" className="btn-primary rdetail__print" onClick={() => window.print()}>Print receipt</button>
    </main>
  );
}
