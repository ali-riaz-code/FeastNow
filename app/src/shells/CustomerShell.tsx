import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { TabBar, type TabDef } from "../components/TabBar";
import { cartCount, useCart } from "../lib/cart";
import { CartScreen } from "../screens/CartScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { OrderDetailScreen } from "../screens/OrderDetailScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { RestaurantScreen } from "../screens/RestaurantScreen";
import { SearchScreen } from "../screens/SearchScreen";

const HomeIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
  </svg>
);
const OrdersIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
  </svg>
);
const CartIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 7h14l-1.5 12h-11Z" /><path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
const ProfileIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export function CustomerShell() {
  const cart = useCart();
  const location = useLocation();
  const tabs: TabDef[] = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: "/cart", label: "Cart", icon: CartIcon, end: false, badge: cartCount(cart) },
    { to: "/orders", label: "Orders", icon: OrdersIcon, end: false },
    { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  ];
  return (
    <div className="shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/restaurant/:id" element={<RestaurantScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/cart" element={<CartScreen />} />
          <Route path="/orders" element={<OrdersScreen />} />
          <Route path="/orders/:id" element={<OrderDetailScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
        </Routes>
      </AnimatePresence>
      <TabBar tabs={tabs} />
    </div>
  );
}
