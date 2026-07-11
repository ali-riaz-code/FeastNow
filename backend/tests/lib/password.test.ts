import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "../../src/lib/password";

describe("password hashing", () => {
  it("produces a hash that is not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
  });

  it("comparePassword returns true for the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await comparePassword("correct horse battery staple", hash)).toBe(true);
  });

  it("comparePassword returns false for the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await comparePassword("wrong password", hash)).toBe(false);
  });
});
