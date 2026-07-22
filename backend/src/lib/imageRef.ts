// An "image reference" is either an uploaded image stored inline as a base64
// data URL (the owner-upload path — see app/src/lib/image.ts) or an https URL
// (the seeded demo images). Kept small enough to live in a Postgres text column
// and to fit under the express.json body limit.

/** ~3MB of base64 ≈ 2.2MB decoded — generous ceiling above what the client
 *  compressor emits (~0.1–0.5MB), while still bounding a hostile payload. */
export const MAX_IMAGE_REF_LEN = 3_000_000;

const DATA_URL = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

/** True for an https URL or a supported base64 image data URL within the cap. */
export function isValidImageRef(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IMAGE_REF_LEN) {
    return false;
  }
  if (value.startsWith("https://")) return true;
  return DATA_URL.test(value);
}
