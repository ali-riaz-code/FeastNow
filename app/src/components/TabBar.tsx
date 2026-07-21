import { NavLink } from "react-router-dom";
import { m } from "motion/react";
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
          {({ isActive }) => (
            <>
              {isActive && (
                <m.span className="tab-bar__pill" layoutId="tabPill"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }} aria-hidden="true" />
              )}
              <m.span className="tab-bar__icon"
                animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                {tab.icon}
                {tab.badge ? <span className="tab-bar__badge mono">{tab.badge > 9 ? "9+" : tab.badge}</span> : null}
              </m.span>
              <span>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
