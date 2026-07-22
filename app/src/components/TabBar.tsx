import { NavLink, matchPath, useLocation } from "react-router-dom";
import { m } from "motion/react";
import type { ReactNode } from "react";

export interface TabDef {
  to: string; label: string; icon: ReactNode; end: boolean; badge?: number;
}

export function TabBar({ tabs }: { tabs: TabDef[] }) {
  const { pathname } = useLocation();
  // Mirror NavLink's own active logic so the pill tracks the highlighted tab.
  const activeIndex = tabs.findIndex((t) => matchPath({ path: t.to, end: t.end }, pathname));

  return (
    <nav className="tab-bar" aria-label="Main">
      {/* ONE pill, a direct child of the bar — never nested inside a tab.
          It lives in the bar's single stacking context and always paints
          beneath every tab's label, so sliding it across neighbouring tabs
          can never cover their names. */}
      {activeIndex >= 0 && (
        <m.span
          className="tab-bar__pill"
          aria-hidden="true"
          initial={false}
          animate={{ left: `${((activeIndex + 0.5) / tabs.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        />
      )}
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) => `tab-bar__tab${isActive ? " tab-bar__tab--active" : ""}`}>
          {({ isActive }) => (
            <>
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
