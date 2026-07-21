import type { ReactNode } from "react";
import { m } from "motion/react";
import { staggerParent, staggerChild } from "../lib/motion";

/** Staggered in-view reveal for a list/section. Enhances an already-visible
 *  default: if JS/animation never runs, children still render (opacity animates
 *  from the variant, and reduced-motion users get it instantly via MotionConfig). */
export function Reveal({ children, className = "", once = true }:
  { children: ReactNode; className?: string; once?: boolean }) {
  return (
    <m.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.15 }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className = "" }:
  { children: ReactNode; className?: string }) {
  return <m.div className={className} variants={staggerChild}>{children}</m.div>;
}
