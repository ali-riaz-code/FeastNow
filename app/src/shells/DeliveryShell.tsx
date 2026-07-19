import { Navigate, Route, Routes } from "react-router-dom";
import { PartnerProvider } from "../PartnerContext";
import { TabBar, type TabDef } from "../components/TabBar";
import { DActiveDeliveryScreen } from "../screens/delivery/DActiveDeliveryScreen";
import { DAvailabilityScreen } from "../screens/delivery/DAvailabilityScreen";
import { DEarningsScreen } from "../screens/delivery/DEarningsScreen";
import { DProfileScreen } from "../screens/delivery/DProfileScreen";
import { AssignmentOfferWatcher } from "../screens/delivery/AssignmentOfferModal";

const TruckIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
  </svg>
);
const PowerIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 3v9" /><path d="M6.6 6.6a8 8 0 1 0 10.8 0" />
  </svg>
);
const WalletIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 7h15v11H3z" /><path d="M18 11h3v4h-3z" /><path d="M3 7l12-3v3" />
  </svg>
);
const UserIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" />
  </svg>
);

export const DELIVERY_TABS: TabDef[] = [
  { to: "/", label: "Active", icon: TruckIcon, end: true },
  { to: "/availability", label: "Availability", icon: PowerIcon, end: false },
  { to: "/earnings", label: "Earnings", icon: WalletIcon, end: false },
  { to: "/profile", label: "Profile", icon: UserIcon, end: false },
];

function DeliveryRoutes() {
  return (
    <>
      <AssignmentOfferWatcher />
      <Routes>
        <Route path="/" element={<DActiveDeliveryScreen />} />
        <Route path="/availability" element={<DAvailabilityScreen />} />
        <Route path="/earnings" element={<DEarningsScreen />} />
        <Route path="/profile" element={<DProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar tabs={DELIVERY_TABS} />
    </>
  );
}

export function DeliveryShell() {
  return (
    <div className="shell">
      <PartnerProvider>
        <DeliveryRoutes />
      </PartnerProvider>
    </div>
  );
}
