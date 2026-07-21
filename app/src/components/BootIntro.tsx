import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "motion/react";

const KEY = "fn_intro_seen";

/** One-time-per-session intro curtain echoing the landing site. Never gates the
 *  app (rendered above it, self-removes). Skipped under reduced motion and on
 *  every load after the first in a session. */
export function BootIntro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(KEY) !== "1";
  });

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    if (reduce) { setShow(false); return; }
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [show, reduce]);

  if (reduce) return null;

  return (
    <AnimatePresence>
      {show && (
        <m.div className="boot-intro" aria-hidden="true"
          initial={{ y: 0 }} exit={{ y: "-108%" }}
          transition={{ duration: 0.85, ease: [0.7, 0, 0.3, 1], delay: 0.55 }}>
          <m.span className="boot-intro__hat"
            initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          <m.span className="boot-intro__word serif"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}>
            FeastNow
          </m.span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
