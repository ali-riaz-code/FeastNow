import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress } from "../../src/lib/geocode";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("geocodeAddress", () => {
  it("returns lat/lng from the first Nominatim result", async () => {
    stubFetch(async () => new Response(JSON.stringify([{ lat: "24.8607", lon: "67.0011" }]), { status: 200 }));
    expect(await geocodeAddress("Karachi")).toEqual({ lat: 24.8607, lng: 67.0011 });
  });

  it("returns null when there are no results", async () => {
    stubFetch(async () => new Response(JSON.stringify([]), { status: 200 }));
    expect(await geocodeAddress("nowhere")).toBeNull();
  });

  it("returns null on a non-200 response", async () => {
    stubFetch(async () => new Response("nope", { status: 500 }));
    expect(await geocodeAddress("x")).toBeNull();
  });

  it("returns null (never throws) when fetch rejects", async () => {
    stubFetch(async () => { throw new Error("network down"); });
    expect(await geocodeAddress("x")).toBeNull();
  });
});
