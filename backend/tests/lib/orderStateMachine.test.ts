import { describe, it, expect } from "vitest";
import {
  canTransition, timestampFieldFor, REJECTION_REASONS,
  ORDER_EXPIRY_MS, AUTO_APPROVE_AFTER_MS, EXPIRY_REJECTION_REASON,
} from "../../src/lib/orderStateMachine";

describe("canTransition", () => {
  it("allows the restaurant-driven happy path", () => {
    expect(canTransition("placed", "accepted", "restaurant")).toBe(true);
    expect(canTransition("accepted", "preparing", "restaurant")).toBe(true);
    expect(canTransition("preparing", "ready", "restaurant")).toBe(true);
  });
  it("allows restaurant rejection and system expiry only from placed", () => {
    expect(canTransition("placed", "rejected", "restaurant")).toBe(true);
    expect(canTransition("placed", "rejected", "system")).toBe(true);
    expect(canTransition("accepted", "rejected", "restaurant")).toBe(false);
    expect(canTransition("accepted", "rejected", "system")).toBe(false);
  });
  it("allows customer cancel only from placed", () => {
    expect(canTransition("placed", "cancelled", "customer")).toBe(true);
    expect(canTransition("accepted", "cancelled", "customer")).toBe(false);
  });
  it("blocks actor mixups and skips", () => {
    expect(canTransition("placed", "accepted", "customer")).toBe(false);
    expect(canTransition("placed", "preparing", "restaurant")).toBe(false);
    expect(canTransition("placed", "ready", "restaurant")).toBe(false);
    expect(canTransition("ready", "delivered", "restaurant")).toBe(false); // post-ready disabled this phase
    expect(canTransition("rejected", "accepted", "restaurant")).toBe(false);
  });
});

describe("timestampFieldFor", () => {
  it("maps each target status to its timeline column", () => {
    expect(timestampFieldFor("accepted")).toBe("acceptedAt");
    expect(timestampFieldFor("preparing")).toBe("preparingAt");
    expect(timestampFieldFor("ready")).toBe("readyAt");
    expect(timestampFieldFor("rejected")).toBe("closedAt");
    expect(timestampFieldFor("cancelled")).toBe("closedAt");
    expect(timestampFieldFor("placed")).toBe(null);
  });
});

describe("constants", () => {
  it("locks the spec values", () => {
    expect(ORDER_EXPIRY_MS).toBe(120_000);
    expect(AUTO_APPROVE_AFTER_MS).toBe(60_000);
    expect(EXPIRY_REJECTION_REASON).toBe("Not accepted in time");
    expect(REJECTION_REASONS).toEqual(["Item unavailable", "Store too busy", "Closing soon", "Other"]);
  });
});
