import { describe, it, expect } from "vitest";
import { generateOtp, hashOtp, compareOtp } from "../../src/lib/otp";

describe("otp", () => {
  it("generateOtp returns a 6-digit numeric string", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("compareOtp returns true for the correct code", async () => {
    const hash = await hashOtp("123456");
    expect(await compareOtp("123456", hash)).toBe(true);
  });

  it("compareOtp returns false for the wrong code", async () => {
    const hash = await hashOtp("123456");
    expect(await compareOtp("654321", hash)).toBe(false);
  });
});
