import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { m, AnimatePresence } from "motion/react";
import { OwnerProvider, useOwner } from "../OwnerContext";
import { apiSend } from "../lib/api";
import type { OwnerProfile } from "../lib/types";
import { TabBar, type TabDef } from "../components/TabBar";
import { AppHeader } from "../components/AppHeader";
import { slideUp } from "../lib/motion";
import { ROrdersScreen } from "../screens/restaurant/ROrdersScreen";
import { ROrderDetailScreen } from "../screens/restaurant/ROrderDetailScreen";
import { RMenuScreen } from "../screens/restaurant/RMenuScreen";
import { RMenuItemEditScreen } from "../screens/restaurant/RMenuItemEditScreen";
import { RSearchScreen } from "../screens/restaurant/RSearchScreen";
import { RProfileScreen } from "../screens/restaurant/RProfileScreen";
import { NewOrderWatcher } from "../screens/restaurant/IncomingOrderAlert";

const QueueIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2Z" /><path d="M9 7h6M9 11h6" />
  </svg>
);
const MenuIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 5h16M4 12h16M4 19h10" />
  </svg>
);
const SearchIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const StoreIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 9 5.5 4h13L20 9" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" />
  </svg>
);

export const RESTAURANT_TABS: TabDef[] = [
  { to: "/", label: "Orders", icon: QueueIcon, end: true },
  { to: "/menu", label: "Menu", icon: MenuIcon, end: false },
  { to: "/search", label: "Search", icon: SearchIcon, end: false },
  { to: "/profile", label: "Profile", icon: StoreIcon, end: false },
];

function RTopBar() {
  const { profile, setProfile } = useOwner();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    const next = !profile.isOnline;
    if (!next && !window.confirm("Go offline? Customers won't be able to order until you come back online.")) return;
    setBusy(true);
    try {
      const { profile: updated } = await apiSend<{ profile: OwnerProfile }>("PATCH", "/api/restaurant/store-status", { isOnline: next });
      setProfile(updated);
    } catch {
      window.alert("Couldn't update your store status. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppHeader
      title={profile.name}
      actions={
        <button
          type="button"
          className={`rtoggle${profile.isOnline ? " rtoggle--on" : ""}`}
          role="switch" aria-checked={profile.isOnline} disabled={busy}
          onClick={() => void toggle()}
        >
          <m.span className="rtoggle__knob" layout aria-hidden="true" />
          {profile.isOnline ? "Online" : "Offline"}
        </button>
      }
    />
  );
}

function OfflineBanner() {
  const { profile } = useOwner();
  if (profile.isOnline) return null;
  return (
    <m.p className="rbanner" role="status" variants={slideUp} initial="hidden" animate="show">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
      </svg>
      You're offline — new orders are paused.
    </m.p>
  );
}

function RestaurantRoutes() {
  const location = useLocation();
  return (
    <>
      <RTopBar />
      <OfflineBanner />
      <NewOrderWatcher />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<ROrdersScreen />} />
          <Route path="/orders/:id" element={<ROrderDetailScreen />} />
          <Route path="/menu" element={<RMenuScreen />} />
          <Route path="/menu/new" element={<RMenuItemEditScreen />} />
          <Route path="/menu/:id" element={<RMenuItemEditScreen />} />
          <Route path="/search" element={<RSearchScreen />} />
          <Route path="/profile" element={<RProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <TabBar tabs={RESTAURANT_TABS} />
    </>
  );
}

export function RestaurantShell() {
  return (
    <div className="shell">
      <OwnerProvider>
        <RestaurantRoutes />
      </OwnerProvider>
    </div>
  );
}
