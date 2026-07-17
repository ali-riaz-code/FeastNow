import { useSyncExternalStore } from "react";

export interface CartLine { menuItemId: string; name: string; priceCents: number; quantity: number; }
export interface Cart { restaurantId: string; restaurantName: string; lines: CartLine[]; }

/** Display-only mirror of the server's flat fee — the server recomputes everything. */
export const DELIVERY_FEE_CENTS = 9900;

const CART_KEY = "feastnow_cart";
const CART_EVENT = "feastnow:cart";

function read(): Cart | null {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cart;
    return Array.isArray(parsed.lines) && parsed.lines.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

let current: Cart | null = read();

export function loadCart(): Cart | null {
  return current;
}

export function saveCart(cart: Cart | null): void {
  current = cart;
  try {
    if (cart) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    else window.localStorage.removeItem(CART_KEY);
  } catch { /* storage full/blocked — in-memory cart still works this session */ }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function cartCount(cart: Cart | null): number {
  return cart?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;
}

export function cartSubtotal(cart: Cart | null): number {
  return cart?.lines.reduce((n, l) => n + l.priceCents * l.quantity, 0) ?? 0;
}

export function setLineQuantity(cart: Cart, menuItemId: string, quantity: number): Cart | null {
  const lines = cart.lines
    .map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  return lines.length === 0 ? null : { ...cart, lines };
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY) { current = read(); cb(); }
  };
  window.addEventListener(CART_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): Cart | null {
  return useSyncExternalStore(subscribe, loadCart);
}
