/** How often to re-share location while online (mirrors backend LOCATION_PING_MS). */
export const LOCATION_PING_MS = 10_000;

export interface Coords { lat: number; lng: number; }

/** One-shot high-accuracy position read. Rejects if unavailable or denied. */
export function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no_geolocation"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  });
}
