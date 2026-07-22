import type { ReactNode } from "react";
import { m } from "motion/react";
import { staggerParent, staggerChild } from "../lib/motion";

/** Staggered reveal for a list/section. Enhances an already-visible default: if
 *  JS/animation never runs, children still render (opacity animates from the
 *  variant, and reduced-motion users get it instantly via MotionConfig).
 *
 *  `inView` (default true) reveals on scroll-into-view — right for static
 *  content the user scrolls to. Pass `inView={false}` for lists whose contents
 *  are REPLACED at runtime (filtered/paginated grids): a one-shot whileInView
 *  fires on the initial/skeleton children and then never drives the real items
 *  that mount afterwards, leaving them stuck at opacity 0. A persistent
 *  `animate="show"` keeps driving every child that mounts, whenever it mounts. */
export function Reveal({ children, className = "", once = true, inView = true }:
  { children: ReactNode; className?: string; once?: boolean; inView?: boolean }) {
  const trigger = inView
    ? { whileInView: "show", viewport: { once, amount: 0.15 } }
    : { animate: "show" };
  return (
    <m.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      {...trigger}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className = "" }:
  { children: ReactNode; className?: string }) {
  return <m.div className={className} variants={staggerChild}>{children}</m.div>;
}
