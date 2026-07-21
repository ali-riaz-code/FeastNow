import { useCallback, useEffect, useState } from "react";
import { m } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { staggerParent, staggerChild } from "../../lib/motion";
import type { AdminReviewRow } from "../../lib/types";

export function AModerationScreen() {
  const [q, setQ] = useState("");
  const [reviews, setReviews] = useState<AdminReviewRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    setReviews(await apiGet<{ reviews: AdminReviewRow[] }>(`/api/admin/reviews?${params.toString()}`).then((r) => r.reviews));
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (r: AdminReviewRow) => {
    if (!window.confirm(`Remove this review of ${r.restaurantName}? This can't be undone.`)) return;
    setBusyId(r.id);
    try { await apiSend("DELETE", `/api/admin/reviews/${r.id}`); await load(); }
    catch { window.alert("Couldn't remove this review."); }
    finally { setBusyId(null); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Moderation</h1>
      <SearchBar value={q} onChange={setQ} placeholder="Search reviews by restaurant" />
      <m.ul className="admin-list admin-list--wide" variants={staggerParent} initial="hidden" animate="show">
        {reviews.map((r) => (
          <m.li key={r.id} className="admin-card admin-reviewrow" variants={staggerChild}>
            <div className="admin-reviewrow__body">
              <span className="admin-reviewrow__head">
                <span className="admin-reviewrow__stars mono">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                <span className="admin-row__sub">{r.restaurantName} · {r.authorName}</span>
              </span>
              <p className="admin-reviewrow__text">{r.reviewText}</p>
            </div>
            <m.button whileTap={{ scale: 0.99 }} className="btn-danger" disabled={busyId === r.id} onClick={() => void remove(r)}>Remove</m.button>
          </m.li>
        ))}
      </m.ul>
      {reviews.length === 0 && <p className="admin-muted">No reviews found.</p>}
    </div>
  );
}
