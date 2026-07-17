import { Navigate, Route, Routes } from "react-router-dom";
import { TabBar, type TabDef } from "../components/TabBar";

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

function ComingSoon({ name }: { name: string }) {
  return (
    <main className="screen rplaceholder">
      <h1>{name}</h1>
      <p>This screen ships later in this phase.</p>
    </main>
  );
}

export function RestaurantShell() {
  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<ComingSoon name="Orders" />} />
        <Route path="/menu" element={<ComingSoon name="Menu" />} />
        <Route path="/search" element={<ComingSoon name="Search" />} />
        <Route path="/profile" element={<ComingSoon name="Profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar tabs={RESTAURANT_TABS} />
    </div>
  );
}
