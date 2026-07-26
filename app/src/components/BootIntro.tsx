import { useEffect, useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "motion/react";

const KEY = "fn_intro_seen";
const WORD = "FeastNow".split("");
// Matches the landing curtain easing (GSAP expo.inOut ≈ this cubic-bezier).
const EASE_EXPO_INOUT = [0.87, 0, 0.13, 1] as const;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** One-time-per-session intro curtain — a faithful echo of the landing site's
 *  intro (chef-hat, letters rise, gold "buon appetito!", curved lift). Never
 *  gates the app (rendered above it, self-removes). Skipped under reduced
 *  motion and on every load after the first in a session. */
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
          initial={{ y: 0 }} exit={{ y: "-112%" }}
          transition={{ duration: 0.9, ease: EASE_EXPO_INOUT, delay: 0.55 }}>
          <div className="boot-intro__inner">
            <m.svg className="boot-intro__hat" viewBox="0 0 64 64"
              initial={{ y: -34, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}>
              <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z"
                fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z"
                fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
              <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48"
                fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M32 39.8 L32.99 42.64 L35.99 42.70 L33.60 44.52 L34.47 47.40 L32 45.68 L29.53 47.40 L30.40 44.52 L28.01 42.70 L31.01 42.64 Z"
                fill="var(--gold)" />
            </m.svg>
            <p className="boot-intro__word serif">
              {WORD.map((ch, i) => (
                <m.span key={i} className="boot-intro__letter"
                  initial={{ y: 44, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 + i * 0.045 }}>
                  {ch}
                </m.span>
              ))}
            </p>
            <m.p className="boot-intro__script script"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.6 }}>
              buon appetito!
            </m.p>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
