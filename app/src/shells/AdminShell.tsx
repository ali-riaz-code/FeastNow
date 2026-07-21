import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { m } from "motion/react";
import { clearToken, redirectToLogin } from "../lib/session";
import { useMe } from "../AuthGate";
import { easeExpo } from "../lib/motion";
import { ADashboardScreen } from "../screens/admin/ADashboardScreen";
import { AApprovalsScreen } from "../screens/admin/AApprovalsScreen";
import { AUsersScreen } from "../screens/admin/AUsersScreen";
import { AModerationScreen } from "../screens/admin/AModerationScreen";
import { APromotionsScreen } from "../screens/admin/APromotionsScreen";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/approvals", label: "Approvals", end: false },
  { to: "/users", label: "Users", end: false },
  { to: "/moderation", label: "Moderation", end: false },
  { to: "/promotions", label: "Promotions", end: false },
];

function AdminSidebar() {
  const me = useMe();
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand serif">FeastNow</div>
      <nav className="admin-sidebar__nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `admin-navlink${isActive ? " admin-navlink--active" : ""}`}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <m.span className="admin-navlink__bar" layoutId="adminNav"
                    transition={{ type: "spring", stiffness: 520, damping: 38 }} aria-hidden="true" />
                )}
                {n.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="admin-sidebar__foot">
        <span className="admin-sidebar__who">{me.email}</span>
        <button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }}>Log out</button>
      </div>
    </aside>
  );
}

export function AdminShell() {
  const location = useLocation();
  // Break out of the 480px phone frame — this is a back-office.
  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("admin-root");
    return () => root?.classList.remove("admin-root");
  }, []);

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <m.main className="admin-main" key={location.pathname}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: easeExpo }}>
        <Routes location={location}>
          <Route path="/" element={<ADashboardScreen />} />
          <Route path="/approvals" element={<AApprovalsScreen />} />
          <Route path="/users" element={<AUsersScreen />} />
          <Route path="/moderation" element={<AModerationScreen />} />
          <Route path="/promotions" element={<APromotionsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </m.main>
    </div>
  );
}
