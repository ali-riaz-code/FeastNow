import { Link } from "react-router-dom";
import type { RestaurantCard } from "../lib/types";
import { formatRating } from "../lib/format";

export function RestaurantCardView({ restaurant }: { restaurant: RestaurantCard }) {
  const r = restaurant;
  return (
    <Link to={`/restaurant/${r.id}`} className={`restaurant-card${r.isOpenNow ? "" : " restaurant-card--closed"}`}>
      <div className="restaurant-card__media">
        <img src={r.heroImageUrl} alt="" loading="lazy" />
        {!r.isOpenNow && (
          <span className="closed-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
            </svg>
            Closed now
          </span>
        )}
      </div>
      <div className="restaurant-card__body">
        <h3 className="restaurant-card__name serif">{r.name}</h3>
        <p className="restaurant-card__cuisines">{r.cuisines.join(" · ")}</p>
        <p className="restaurant-card__meta mono">
          <span className="restaurant-card__rating">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
            </svg>
            {formatRating(r.avgRating)}
          </span>
          <span aria-hidden="true">·</span>
          <span>({r.ratingCount})</span>
          <span aria-hidden="true">·</span>
          <span>{r.estDeliveryMin} min</span>
        </p>
      </div>
    </Link>
  );
}
