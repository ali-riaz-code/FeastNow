import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, m } from "motion/react";
import { apiSend, ApiError, NetworkError } from "../lib/api";
import { cartSubtotal, DELIVERY_FEE_CENTS, loadCart, saveCart, setLineQuantity, useCart } from "../lib/cart";
import { formatPrice } from "../lib/format";
import { staggerChild } from "../lib/motion";
import type { OrderDTO, PromoValidationDTO } from "../lib/types";
import { AppHeader } from "../components/AppHeader";
import { Screen } from "../components/Screen";

const ADDRESS_KEY = "feastnow_address";

interface PlaceErrorBody { error?: string; message?: string; itemIds?: string[]; }

/**
 * Display-only discount for the current subtotal, using the validated promo's
 * terms. The server recomputes this authoritatively when the order is placed;
 * recomputing locally just keeps the total responsive as quantities change.
 */
function previewDiscount(promo: PromoValidationDTO, subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  const raw = promo.discountType === "percentage"
    ? Math.floor((subtotalCents * promo.discountValue) / 100)
    : promo.discountValue;
  return Math.max(0, Math.min(raw, subtotalCents));
}

export function CartScreen() {
  const cart = useCart();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [address, setAddress] = useState(() => {
    try { return window.localStorage.getItem(ADDRESS_KEY) ?? ""; } catch { return ""; }
  });
  const [addressError, setAddressError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [serverError, setServerError] = useState("");
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationDTO | null>(null);
  const [promoError, setPromoError] = useState("");
  const [checkingPromo, setCheckingPromo] = useState(false);

  if (!cart) {
    return (
      <Screen className="orders-empty">
        <AppHeader title="Your cart" />
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--brown)" strokeWidth="1.2" aria-hidden="true">
          <path d="M5 7h14l-1.5 12h-11Z" /><path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
        <h1 className="serif">Your basket is empty</h1>
        <p>Add something delicious from a restaurant.</p>
        <Link to="/" className="btn-primary">Browse restaurants</Link>
      </Screen>
    );
  }

  const changeQty = (menuItemId: string, delta: number) => {
    const line = cart.lines.find((l) => l.menuItemId === menuItemId);
    if (!line) return;
    saveCart(setLineQuantity(cart, menuItemId, line.quantity + delta));
    setUnavailableIds((ids) => ids.filter((id) => id !== menuItemId || line.quantity + delta > 0));
  };

  const removeUnavailable = () => {
    let next = loadCart();
    for (const id of unavailableIds) {
      if (!next) break;
      next = setLineQuantity(next, id, 0);
    }
    saveCart(next);
    setUnavailableIds([]);
    setServerError("");
  };

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoError("");
    setCheckingPromo(true);
    try {
      const promo = await apiSend<PromoValidationDTO>("POST", "/api/customer/orders/promo/validate", {
        code, subtotalCents: cartSubtotal(cart),
      });
      setAppliedPromo(promo);
      setPromoInput(promo.code);
    } catch (err) {
      setAppliedPromo(null);
      if (err instanceof ApiError) {
        const body = (err.body ?? {}) as PlaceErrorBody;
        setPromoError(body.message ?? "That promo code isn't valid.");
      } else if (err instanceof NetworkError) {
        setPromoError(err.message);
      } else {
        setPromoError("Couldn't check that code. Try again.");
      }
    } finally {
      setCheckingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError("");
  };

  const placeOrder = async () => {
    setAddressError("");
    setServerError("");
    if (!address.trim()) {
      setAddressError("Enter your delivery address.");
      return;
    }
    try { window.localStorage.setItem(ADDRESS_KEY, address.trim()); } catch { /* best-effort */ }
    setPlacing(true);
    try {
      const { order } = await apiSend<{ order: OrderDTO }>("POST", "/api/customer/orders", {
        restaurantId: cart.restaurantId,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
        note: note.trim(),
        deliveryAddress: address.trim(),
        promoCode: appliedPromo?.code ?? undefined,
      });
      saveCart(null);
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = (err.body ?? {}) as PlaceErrorBody;
        if (body.error === "items_unavailable") {
          setUnavailableIds(body.itemIds ?? []);
          setServerError(body.message ?? "Some items are no longer available.");
        } else if (body.error === "promo_invalid") {
          removePromo();
          setPromoError(body.message ?? "That promo code is no longer valid.");
          setServerError("Your promo code expired — remove it or try another, then place your order.");
        } else {
          setServerError(body.message ?? "This restaurant isn't taking orders right now.");
        }
      } else if (err instanceof NetworkError) {
        setServerError(err.message);
      } else {
        setServerError("Couldn't place your order. Try again.");
      }
    } finally {
      setPlacing(false);
    }
  };

  const subtotal = cartSubtotal(cart);
  const discount = appliedPromo ? previewDiscount(appliedPromo, subtotal) : 0;
  const total = subtotal + DELIVERY_FEE_CENTS - discount;
  return (
    <Screen className="cart">
      <AppHeader title="Your cart" />
      <h1 className="serif">Your basket</h1>
      <p className="cart__from">from <Link to={`/restaurant/${cart.restaurantId}`}>{cart.restaurantName}</Link></p>

      <section className="cart__lines" aria-label="Basket items">
        <AnimatePresence>
          {cart.lines.map((l) => (
            <m.div
              key={l.menuItemId}
              layout
              variants={staggerChild}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -24 }}
              className={`cart-line${unavailableIds.includes(l.menuItemId) ? " cart-line--unavailable" : ""}`}
            >
              <div className="cart-line__text">
                <p>{l.name}</p>
                {unavailableIds.includes(l.menuItemId) && <span className="cart-line__flag">No longer available</span>}
              </div>
              <div className="stepper" role="group" aria-label={`${l.name} quantity`}>
                <button type="button" className="stepper__btn" aria-label="Remove one" onClick={() => changeQty(l.menuItemId, -1)}>−</button>
                <span className="stepper__qty mono">{l.quantity}</span>
                <button type="button" className="stepper__btn" aria-label="Add one" onClick={() => changeQty(l.menuItemId, +1)}>+</button>
              </div>
              <span className="cart-line__price mono">{formatPrice(l.priceCents * l.quantity)}</span>
            </m.div>
          ))}
        </AnimatePresence>
      </section>

      <label className="cart__field">
        <span>Delivery address</span>
        <input type="text" value={address} autoComplete="street-address"
          onChange={(e) => setAddress(e.target.value)} placeholder="House, street, area" />
        {addressError && <span className="cart__error" role="alert">{addressError}</span>}
      </label>
      <label className="cart__field">
        <span>Note for the restaurant (optional)</span>
        <textarea value={note} maxLength={500} rows={2}
          onChange={(e) => setNote(e.target.value)} placeholder="e.g. extra spicy, ring the bell" />
      </label>

      <section className="cart__promo" aria-label="Promo code">
        {appliedPromo ? (
          <div className="cart__promo-applied">
            <div className="cart__promo-tag">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8Z" />
                <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" />
              </svg>
              <span><strong>{appliedPromo.code}</strong> applied</span>
            </div>
            <button type="button" className="cart__promo-remove" onClick={removePromo}>Remove</button>
          </div>
        ) : (
          <div className="cart__promo-entry">
            <input
              type="text" value={promoInput} autoCapitalize="characters" autoComplete="off"
              onChange={(e) => { setPromoInput(e.target.value); setPromoError(""); }}
              placeholder="Promo code"
              aria-label="Promo code"
            />
            <button
              type="button" className="cart__promo-apply"
              disabled={checkingPromo || !promoInput.trim()}
              onClick={() => void applyPromo()}
            >
              {checkingPromo ? "Checking…" : "Apply"}
            </button>
          </div>
        )}
        {promoError && <span className="cart__error" role="alert">{promoError}</span>}
      </section>

      <section className="cart__totals" aria-label="Price breakdown">
        <div><span>Subtotal</span><span className="mono">{formatPrice(subtotal)}</span></div>
        <div><span>Delivery fee</span><span className="mono">{formatPrice(DELIVERY_FEE_CENTS)}</span></div>
        {discount > 0 && (
          <div className="cart__totals-discount">
            <span>Discount ({appliedPromo!.code})</span>
            <span className="mono">−{formatPrice(discount)}</span>
          </div>
        )}
        <div className="cart__totals-total">
          <span>Total (cash)</span>
          <m.span key={total} className="mono" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {formatPrice(total)}
          </m.span>
        </div>
      </section>

      {serverError && (
        <p className="cart__server-error" role="alert">
          {serverError}
          {unavailableIds.length > 0 && (
            <button type="button" className="btn-retry" onClick={removeUnavailable}>Remove unavailable items</button>
          )}
        </p>
      )}

      <m.button
        type="button"
        className="btn-primary cart__place"
        disabled={placing}
        whileTap={{ scale: 0.97 }}
        onClick={() => void placeOrder()}
      >
        {placing ? "Placing your order…" : "Place order — cash on delivery"}
      </m.button>
    </Screen>
  );
}
