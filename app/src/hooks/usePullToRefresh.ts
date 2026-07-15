import { useEffect, useRef, useState, type RefObject } from "react";

const THRESHOLD_PX = 70;

/** Minimal touch pull-to-refresh: when the window is scrolled to the top and
 *  the user drags down past the threshold, calls onRefresh once. */
export function usePullToRefresh(ref: RefObject<HTMLElement | null>, onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      if (e.touches[0].clientY - startY.current > THRESHOLD_PX) {
        startY.current = null;
        setRefreshing(true);
        void onRefresh().finally(() => setRefreshing(false));
      }
    };
    const onTouchEnd = () => { startY.current = null; };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, onRefresh]);

  return refreshing;
}
