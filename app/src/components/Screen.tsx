import { forwardRef, type ReactNode } from "react";
import { m } from "motion/react";
import { screenVariants } from "../lib/motion";

type ScreenProps = {
  children: ReactNode;
  className?: string;
} & React.ComponentProps<typeof m.main>;

/** Animated screen root. Drop-in for `<main className="screen">`, adds a
 *  fade+rise entrance and orchestrates staggered children that opt in with
 *  `variants={staggerChild}`. All extra props (ref, onScroll, etc.) pass through. */
export const Screen = forwardRef<HTMLElement, ScreenProps>(function Screen(
  { children, className = "", ...rest }, ref
) {
  return (
    <m.main
      ref={ref}
      className={`screen ${className}`.trim()}
      variants={screenVariants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </m.main>
  );
});
