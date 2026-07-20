export type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>;

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 5000;

// Best-effort geocode via OpenStreetMap Nominatim (free, no API key).
// Never throws: a geocode failure must not block restaurant signup.
export const geocodeAddress: GeocodeFn = async (address) => {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FeastNow/1.0 (support@feastnow.pk)" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
