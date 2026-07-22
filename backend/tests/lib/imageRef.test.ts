import { describe, it, expect } from "vitest";
import { isValidImageRef, MAX_IMAGE_REF_LEN } from "../../src/lib/imageRef";

describe("isValidImageRef", () => {
  it("accepts https URLs (seeded demo images)", () => {
    expect(isValidImageRef("https://images.unsplash.com/photo-123?w=800")).toBe(true);
  });

  it("accepts supported base64 image data URLs (owner uploads)", () => {
    expect(isValidImageRef("data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==")).toBe(true);
    expect(isValidImageRef("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isValidImageRef("data:image/webp;base64,UklGRhoAAAA=")).toBe(true);
  });

  it("rejects non-image data URLs and unsupported schemes", () => {
    expect(isValidImageRef("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isValidImageRef("http://insecure.example/x.jpg")).toBe(false);
    expect(isValidImageRef("javascript:alert(1)")).toBe(false);
    expect(isValidImageRef("")).toBe(false);
  });

  it("rejects payloads over the size cap", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_REF_LEN);
    expect(isValidImageRef(huge)).toBe(false);
  });
});
