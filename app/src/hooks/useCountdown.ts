import { useEffect, useState } from "react";

/** Seconds until expiresAt (floor 0), ticking twice a second. Cosmetic only —
 *  the server enforces the real deadline (Global Constraints). */
export function useCountdown(expiresAt: string): number {
  const target = new Date(expiresAt).getTime();
  const remaining = () => Math.max(0, Math.ceil((target - Date.now()) / 1000));
  const [left, setLeft] = useState(remaining);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(remaining()), 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return left;
}
