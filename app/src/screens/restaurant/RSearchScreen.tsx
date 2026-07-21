import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../../lib/api";
import { formatOrderNumber, formatPrice } from "../../lib/format";
import type { OrderDTO, OrdersListResponse, OwnerMenuItem } from "../../lib/types";
import { StatusBadge } from "../../components/OrderStatus";
import { Screen } from "../../components/Screen";
import { Reveal, RevealItem } from "../../components/Reveal";

const RECENT_KEY = "feastnow_rsearch_recent";
const RECENT_MAX = 8;
const DEBOUNCE_MS = 300;
type StatusChip = "all" | "new" | "preparing" | "ready" | "history";
const CHIPS: { key: StatusChip; label: string }[] = [
  { key: "all", label: "All" }, { key: "new", label: "New" }, { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" }, { key: "history", label: "History" },
];

function readRecent(): string[] {
  try { return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[]; } catch { return []; }
}
function pushRecent(q: string): void {
  const next = [q, ...readRecent().filter((r) => r !== q)].slice(0, RECENT_MAX);
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota — recents are a nicety */ }
}

export function RSearchScreen() {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<StatusChip>("all");
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [menu, setMenu] = useState<OwnerMenuItem[]>([]);
  const [recent, setRecent] = useState(readRecent);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu").then(({ items }) => setMenu(items)).catch(() => setMenu([]));
  }, []);

  const run = useCallback(async (query: string, tab: StatusChip) => {
    if (!query.trim()) { setOrders(null); return; }
    const res = await apiGet<OrdersListResponse>(`/api/restaurant/orders?tab=${tab}&q=${encodeURIComponent(query.trim())}&page=1`);
    setOrders(res.orders);
    pushRecent(query.trim());
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void run(q, chip).catch(() => setOrders([])), DEBOUNCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [q, chip, run]);

  const menuHits = q.trim()
    ? menu.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5)
    : [];

  return (
    <Screen className="rsearch">
      <input className="rmenu__search" type="search" value={q} autoFocus
        placeholder="Order # or customer name" aria-label="Search orders and menu"
        onChange={(e) => setQ(e.target.value)} />
      <div className="rsearch__chips" role="tablist" aria-label="Order status filter">
        {CHIPS.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={chip === c.key}
            className={`rsearch__chip${chip === c.key ? " rsearch__chip--active" : ""}`}
            onClick={() => setChip(c.key)}>{c.label}</button>
        ))}
      </div>

      {!q.trim() && recent.length > 0 && (
        <section className="rsearch__recent">
          <h2>Recent searches</h2>
          {recent.map((r) => (
            <button key={r} type="button" className="rsheet__option" onClick={() => setQ(r)}>{r}</button>
          ))}
        </section>
      )}

      {q.trim() && (
        <>
          <section aria-label="Matching orders">
            <h2>Orders</h2>
            {orders === null && <p className="rsearch__hint">Searching…</p>}
            {orders !== null && orders.length === 0 && <p className="rsearch__hint">No orders match “{q}”.</p>}
            <Reveal>
              {orders?.map((o) => (
                <RevealItem key={o.id}>
                  <Link to={`/orders/${o.id}`} className="rorder-card rsearch__hit">
                    <span className="mono">{formatOrderNumber(o.orderNumber)}</span>
                    <span>{o.customerName}</span>
                    <StatusBadge status={o.status} />
                    <span className="mono">{formatPrice(o.totalCents)}</span>
                  </Link>
                </RevealItem>
              ))}
            </Reveal>
          </section>
          <section aria-label="Matching menu items">
            <h2>Menu items</h2>
            {menuHits.length === 0 && <p className="rsearch__hint">No menu items match “{q}”.</p>}
            <Reveal>
              {menuHits.map((m) => (
                <RevealItem key={m.id}>
                  <Link to={`/menu/${m.id}`} className="rorder-card rsearch__hit">
                    <span>{m.name}</span>
                    <span className="mono">{formatPrice(m.priceCents)}</span>
                    <span className={m.isAvailable ? "status status--basil" : "status status--tomato"}>
                      {m.isAvailable ? "Available" : "Sold out"}
                    </span>
                  </Link>
                </RevealItem>
              ))}
            </Reveal>
          </section>
        </>
      )}
    </Screen>
  );
}
