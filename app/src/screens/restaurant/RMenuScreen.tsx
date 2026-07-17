import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiSend } from "../../lib/api";
import { formatPrice } from "../../lib/format";
import type { OwnerMenuItem } from "../../lib/types";

export function RMenuScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<OwnerMenuItem[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu")
      .then((res) => setItems(res.items))
      .catch(() => setError("Couldn't load your menu. Pull to retry."));
  }, []);

  const toggle = async (item: OwnerMenuItem) => {
    const next = !item.isAvailable;
    setItems((prev) => prev!.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i))); // optimistic
    try {
      await apiSend("PATCH", `/api/restaurant/menu-items/${item.id}`, { isAvailable: next });
    } catch {
      setItems((prev) => prev!.map((i) => (i.id === item.id ? { ...i, isAvailable: !next } : i))); // revert
    }
  };

  if (error) return <main className="screen rqueue"><div className="rqueue__empty"><p>{error}</p></div></main>;
  if (items === null) {
    return <main className="screen rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></main>;
  }
  if (items.length === 0) {
    return (
      <main className="screen rqueue">
        <div className="rqueue__empty">
          <p>Add your first item — your menu is what customers see.</p>
          <Link to="/menu/new" className="btn-primary">Add an item</Link>
        </div>
      </main>
    );
  }

  const filtered = q.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    : items;
  const groups = new Map<string, OwnerMenuItem[]>();
  for (const item of filtered) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  return (
    <main className="screen rmenu">
      <input className="rmenu__search" type="search" value={q} placeholder="Search your menu"
        aria-label="Search your menu" onChange={(e) => setQ(e.target.value)} />
      {filtered.length === 0 && <div className="rqueue__empty"><p>No items match “{q}”.</p></div>}
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="rmenu__group">
          <h2>{category}</h2>
          {list.map((item) => (
            <article key={item.id} className={`rmenu-row${item.isAvailable ? "" : " rmenu-row--off"}`}>
              {item.imageUrl
                ? <img className="rmenu-row__thumb" src={item.imageUrl} alt="" loading="lazy" />
                : <span className="rmenu-row__thumb rmenu-row__thumb--empty" aria-hidden="true" />}
              <button type="button" className="rmenu-row__text" onClick={() => navigate(`/menu/${item.id}`)}>
                <span className="rmenu-row__name">{item.name}</span>
                <span className="rmenu-row__price mono">{formatPrice(item.priceCents)}</span>
              </button>
              <button type="button" role="switch" aria-checked={item.isAvailable}
                aria-label={`${item.name} availability`}
                className={`rswitch${item.isAvailable ? " rswitch--on" : ""}`}
                onClick={() => void toggle(item)}>
                {item.isAvailable ? "Available" : "Sold out"}
              </button>
            </article>
          ))}
        </section>
      ))}
      <Link to="/menu/new" className="rfab" aria-label="Add menu item">+</Link>
    </main>
  );
}
