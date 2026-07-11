import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/lib/jwt";

const SECRET = "test-secret";

describe("jwt", () => {
  it("verifyToken returns the original payload for a valid token", () => {
    const token = signToken({ userId: "user-123" }, SECRET);
    expect(verifyToken(token, SECRET)).toMatchObject({ userId: "user-123" });
  });

  it("verifyToken throws for a token signed with a different secret", () => {
    const token = signToken({ userId: "user-123" }, "other-secret");
    expect(() => verifyToken(token, SECRET)).toThrow();
  });
});
