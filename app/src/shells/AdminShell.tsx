import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { clearToken, redirectToLogin } from "../lib/session";
import { useMe } from "../AuthGate";
import { ADashboardScreen } from "../screens/admin/ADashboardScreen";
import { AApprovalsScreen } from "../screens/admin/AApprovalsScreen";
import { AUsersScreen } from "../screens/admin/AUsersScreen";

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
            {n.label}
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
  // Break out of the 480px phone frame — this is a back-office.
  useEffect(() => {
    const root = document.getElementById("root");
    root?.classList.add("admin-root");
    return () => root?.classList.remove("admin-root");
  }, []);

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<ADashboardScreen />} />
          <Route path="/approvals" element={<AApprovalsScreen />} />
          <Route path="/users" element={<AUsersScreen />} />
          <Route path="/moderation" element={<div className="admin-screen">Moderation</div>} />
          <Route path="/promotions" element={<div className="admin-screen">Promotions</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
