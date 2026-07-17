import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

export interface TabDef {
  to: string; label: string; icon: ReactNode; end: boolean; badge?: number;
}

export function TabBar({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) => `tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}>
          <span className="tab-bar__icon">
            {tab.icon}
            {tab.badge ? <span className="tab-bar__badge mono">{tab.badge > 9 ? "9+" : tab.badge}</span> : null}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
