import { Link } from "react-router-dom";

export function OrdersScreen() {
  return (
    <main className="screen orders-empty">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--brown)" strokeWidth="1.2" aria-hidden="true">
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
      </svg>
      <h1 className="serif">No orders yet</h1>
      <p>Your orders will show up here.</p>
      <Link to="/" className="btn-primary">Browse restaurants</Link>
    </main>
  );
}
