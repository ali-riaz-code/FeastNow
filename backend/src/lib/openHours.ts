const MARKETPLACE_TIME_ZONE = "Asia/Karachi";

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesOfDayIn(timeZone: string, now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
  const [h, m] = parts.split(":").map(Number);
  return (h % 24) * 60 + m; // en-GB can render midnight as "24:00"
}

/**
 * "HH:mm" local open/close window. Equal open/close = open 24h; close earlier
 * than open = overnight window. Evaluated in the marketplace timezone so the
 * answer doesn't depend on where the server runs.
 */
export function isOpenNow(
  opensAt: string,
  closesAt: string,
  now: Date = new Date(),
  timeZone: string = MARKETPLACE_TIME_ZONE
): boolean {
  const open = parseHHMM(opensAt);
  const close = parseHHMM(closesAt);
  if (open === close) return true;
  const minutes = minutesOfDayIn(timeZone, now);
  if (open < close) return minutes >= open && minutes < close;
  return minutes >= open || minutes < close;
}
