import { Route, Routes } from "react-router-dom";
import { TabBar, type TabDef } from "../components/TabBar";
import { HomeScreen } from "../screens/HomeScreen";
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
const ProfileIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

export function CustomerShell() {
  const tabs: TabDef[] = [
    { to: "/", label: "Home", icon: HomeIcon, end: true },
    { to: "/orders", label: "Orders", icon: OrdersIcon, end: false },
    { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  ];
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/restaurant/:id" element={<RestaurantScreen />} />
        <Route path="/search" element={<SearchScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
      </Routes>
      <TabBar tabs={tabs} />
    </div>
  );
}
