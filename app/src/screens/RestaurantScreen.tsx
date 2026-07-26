import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { m, useScroll, useTransform } from "motion/react";
import { apiGet, ApiError, NetworkError } from "../lib/api";
import type { MenuItem, RestaurantDetail } from "../lib/types";
import { formatPrice, formatRating } from "../lib/format";
import { loadCart, saveCart, setLineQuantity, useCart, cartCount, cartSubtotal } from "../lib/cart";
import { Screen } from "../components/Screen";
import { Reveal, RevealItem } from "../components/Reveal";

const INITIAL_REVIEWS_SHOWN = 3;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; detail: RestaurantDetail };

export function RestaurantScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [allReviews, setAllReviews] = useState(false);
  const categoryRefs = useRef(new Map<string, HTMLElement>());
  const cart = useCart();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 240], [0, 60]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    apiGet<RestaurantDetail>(`/api/restaurants/${id}`)
      .then((detail) => {
        if (cancelled) return;
        setState({ status: "ready", detail });
        setActiveCategory(detail.menu[0]?.category ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setState({ status: "missing" });
        else setState({ status: "error", message: err instanceof NetworkError ? err.message : "Couldn't load this restaurant." });
      });
    return () => { cancelled = true; };
  }, [id]);

  if (state.status === "loading") {
    return <Screen className="restaurant"><div className="restaurant__hero-skeleton" aria-label="Loading" role="status" /></Screen>;
  }
  if (state.status === "missing") {
    return (
      <Screen className="restaurant restaurant--message">
        <p>This restaurant is no longer available.</p>
        <button className="btn-retry" onClick={() => navigate("/")}>Back to Home</button>
      </Screen>
    );
  }
  if (state.status === "error") {
    return (
      <Screen className="restaurant restaurant--message">
        <p>{state.message}</p>
        <button className="btn-retry" onClick={() => navigate(0)}>Try again</button>
      </Screen>
    );
  }

  const r = state.detail;
  const reviewsShown = allReviews ? r.reviews : r.reviews.slice(0, INITIAL_REVIEWS_SHOWN);

  const cartForThis = cart && cart.restaurantId === id ? cart : null;
  const qtyOf = (menuItemId: string) => cartForThis?.lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;

  const changeQty = (item: MenuItem, delta: number) => {
    let base = loadCart();
    if (base && base.restaurantId !== r.id) {
      if (!window.confirm(`Start a new basket? Your items from ${base.restaurantName} will be removed.`)) return;
      base = null;
    }
    if (!base) base = { restaurantId: r.id, restaurantName: r.name, lines: [] };
    const existing = base.lines.find((l) => l.menuItemId === item.id);
    if (!existing && delta > 0) {
      saveCart({ ...base, lines: [...base.lines, { menuItemId: item.id, name: item.name, priceCents: item.priceCents, quantity: 1 }] });
    } else if (existing) {
      saveCart(setLineQuantity(base, item.id, existing.quantity + delta));
    }
  };

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    categoryRefs.current.get(category)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Screen className="restaurant">
      <div className="restaurant__hero" ref={heroRef}>
        <m.img src={r.heroImageUrl} alt="" style={{ y: heroY }} />
        <button className="restaurant__back" aria-label="Go back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      <div className="restaurant__info-band">
        <header className="restaurant__head">
          <h1 className="serif">{r.name}</h1>
          <p className="restaurant__cuisines">{r.cuisines.join(" · ")}</p>
          <p className="restaurant__meta mono">
            <span className="restaurant__rating">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
              </svg>
              {formatRating(r.avgRating)}
            </span>
            {" "}({r.ratingCount} reviews) · {r.estDeliveryMin} min
          </p>
          <p className="restaurant__address">{r.address}</p>
          <p className="restaurant__hours mono">Open {r.opensAt} – {r.closesAt}</p>
          {!r.isOpenNow && (
            <p className="restaurant__closed-banner" role="status">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
              </svg>
              Closed now — you can browse the menu
            </p>
          )}
        </header>
      </div>

      <nav className="category-tabs" aria-label="Menu categories">
        {r.menu.map((group) => (
          <button key={group.category} type="button"
            className={`category-tabs__tab${group.category === activeCategory ? " category-tabs__tab--active" : ""}`}
            onClick={() => scrollToCategory(group.category)}>
            {group.category}
          </button>
        ))}
      </nav>

      {r.menu.map((group) => (
        <section key={group.category} className="menu-category"
          ref={(el) => { if (el) categoryRefs.current.set(group.category, el); }}>
          <h2 className="serif menu-category__title">{group.category}</h2>
          <Reveal>
            {group.items.map((item) => (
              <RevealItem key={item.id}>
                <article className={`menu-row${item.isAvailable ? "" : " menu-row--unavailable"}`}>
                  <div className="menu-row__text">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p className="menu-row__price mono">{formatPrice(item.priceCents)}</p>
                    {!item.isAvailable && <span className="menu-row__unavailable-label">Unavailable</span>}
                  </div>
                  <div className="menu-row__actions">
                    {qtyOf(item.id) === 0 ? (
                      <m.button type="button" className="stepper__add"
                        disabled={!item.isAvailable || !r.isOpenNow}
                        aria-label={`Add ${item.name} to basket`}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => changeQty(item, +1)}>+</m.button>
                    ) : (
                      <div className="stepper" role="group" aria-label={`${item.name} quantity`}>
                        <button type="button" className="stepper__btn" aria-label="Remove one" onClick={() => changeQty(item, -1)}>−</button>
                        <span className="stepper__qty mono">{qtyOf(item.id)}</span>
                        <button type="button" className="stepper__btn" aria-label="Add one" onClick={() => changeQty(item, +1)}>+</button>
                      </div>
                    )}
                  </div>
                  {item.imageUrl && <img className="menu-row__thumb" src={item.imageUrl} alt="" loading="lazy" />}
                </article>
              </RevealItem>
            ))}
          </Reveal>
        </section>
      ))}

      <section className="reviews">
        <h2 className="serif">Reviews</h2>
        {reviewsShown.map((review) => (
          <article key={review.id} className="review">
            <div className="review__stars" aria-label={`${review.stars} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <svg key={i} viewBox="0 0 24 24" width="13" height="13"
                  className={i < review.stars ? undefined : "review__star--empty"}
                  fill={i < review.stars ? "currentColor" : "none"}
                  stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="m12 2 3 6.6 7 .9-5.2 4.9 1.4 7-6.2-3.6L5.8 21.4l1.4-7L2 9.5l7-.9Z" />
                </svg>
              ))}
            </div>
            <p className="review__text">{review.reviewText}</p>
            <p className="review__author">{review.authorName}</p>
          </article>
        ))}
        {!allReviews && r.reviews.length > INITIAL_REVIEWS_SHOWN && (
          <button className="btn-retry" onClick={() => setAllReviews(true)}>
            See all ({r.reviews.length})
          </button>
        )}
      </section>

      {cartForThis && (
        <Link to="/cart" className="basket-bar">
          <span className="basket-bar__count mono">{cartCount(cartForThis)}</span>
          <span>View basket</span>
          <span className="basket-bar__total mono">{formatPrice(cartSubtotal(cartForThis))}</span>
        </Link>
      )}
    </Screen>
  );
}
