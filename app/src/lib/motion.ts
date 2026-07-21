// Shared motion config. Import `m` (not `motion`) at call sites so LazyMotion
// tree-shakes the bundle. Reduced motion is handled globally by MotionConfig
// reducedMotion="user" (see App.tsx) plus the CSS block in global.css.
import { domMax } from "motion/react";
import type { Variants, Transition } from "motion/react";

export { domMax };

export const easeExpo = [0.16, 1, 0.3, 1] as const;
export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };

// Whole-screen entrance: fade + rise, and orchestrate children.
export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.42, ease: easeExpo, when: "beforeChildren", staggerChildren: 0.055 },
  },
};

// Parent that staggers its children (for lists/rows). Use with staggerChild.
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeExpo } },
};

// Single element reveal-up.
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeExpo } },
};

// Pop-in for badges / modals / hex-style accents.
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 480, damping: 30 } },
};

// Bottom-sheet / offer slide-up.
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeExpo } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: easeExpo } },
};
