import type { ReactNode } from "react";
import { m } from "motion/react";
import { easeExpo } from "../lib/motion";

type AppHeaderProps = {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
};

/** Navy "awning" top bar shared by every shell. Cream ink on navy (AA). */
export function AppHeader({ title, subtitle, leading, actions, children, sticky }: AppHeaderProps) {
  return (
    <m.header
      className={`appbar${sticky ? " appbar--sticky" : ""}`}
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: easeExpo }}
    >
      <div className="appbar__row">
        {leading && <div className="appbar__leading">{leading}</div>}
        {(title || subtitle) && (
          <div className="appbar__titles">
            {title && <h1 className="appbar__title serif">{title}</h1>}
            {subtitle && <p className="appbar__subtitle">{subtitle}</p>}
          </div>
        )}
        {actions && <div className="appbar__actions">{actions}</div>}
      </div>
      {children && <div className="appbar__extra">{children}</div>}
    </m.header>
  );
}
