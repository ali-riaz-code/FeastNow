import { describe, it, expect } from "vitest";
import { isOpenNow } from "../../src/lib/openHours";

// Karachi is UTC+5 year-round: 07:00Z = 12:00 PKT, 20:00Z = 01:00 PKT (+1 day).
const at = (utc: string) => new Date(utc);

describe("isOpenNow", () => {
  it("is open strictly inside a same-day window", () => {
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T07:00:00Z"))).toBe(true); // 12:00 PKT
  });

  it("is closed before opening and at/after closing (boundary times)", () => {
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T05:59:00Z"))).toBe(false); // 10:59 PKT
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T06:00:00Z"))).toBe(true);  // 11:00 PKT — opens
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T18:00:00Z"))).toBe(false); // 23:00 PKT — closes
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T17:59:00Z"))).toBe(true);  // 22:59 PKT
  });

  it("handles an overnight window (17:00–02:00)", () => {
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T19:00:00Z"))).toBe(true);  // 00:00 PKT
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T21:00:00Z"))).toBe(false); // 02:00 PKT — closed
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T13:00:00Z"))).toBe(true);  // 18:00 PKT
    expect(isOpenNow("17:00", "02:00", at("2026-07-14T07:00:00Z"))).toBe(false); // 12:00 PKT
  });

  it("treats identical open/close as open 24h", () => {
    expect(isOpenNow("00:00", "00:00", at("2026-07-14T07:00:00Z"))).toBe(true);
    expect(isOpenNow("09:30", "09:30", at("2026-07-14T20:00:00Z"))).toBe(true);
  });

  it("respects an explicit timezone argument", () => {
    // 07:00Z is 07:00 in UTC — before an 11:00 open in UTC, but 12:00 in Karachi.
    expect(isOpenNow("11:00", "23:00", at("2026-07-14T07:00:00Z"), "UTC")).toBe(false);
  });
});
