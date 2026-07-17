import { useEffect } from "react";

/** Visibility-aware polling (spec §4): runs fn now and every intervalMs while
 *  the tab is visible; a poll failure is silent (next tick retries). fn MUST
 *  be referentially stable (useCallback) or the loop restarts every render. */
export function usePolling(fn: () => Promise<void>, intervalMs: number): void {
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (!document.hidden) {
        try { await fn(); } catch { /* silent — stale indicator is the caller's job */ }
      }
      timer = window.setTimeout(() => void tick(), intervalMs);
    };
    void tick();
    const onVisibility = () => {
      if (!document.hidden && !stopped) {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fn, intervalMs]);
}
