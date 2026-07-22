// Client-side image compression. Restaurants pick a photo from their device;
// we downscale + re-encode to a JPEG data URL that gets stored inline in the
// existing image URL columns (no object storage). Keeps payloads small so the
// browse feed stays fast on low-end devices (NFR-1/NFR-5).

export class ImageError extends Error {}

export interface CompressOptions {
  /** Longest-edge cap in px; the image is scaled down to fit (never up). */
  maxDim: number;
  /** JPEG quality 0–1. */
  quality: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("That file couldn't be read as an image."));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageError("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

/** Read an image File and return a downscaled, compressed JPEG data URL. */
export async function compressImage(file: File, opts: CompressOptions): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("Please choose an image file (JPG, PNG, or WebP).");
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const { width, height } = img;
  const scale = Math.min(1, opts.maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("Your browser couldn't process that image.");
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", opts.quality);
  if (!out.startsWith("data:image/jpeg")) {
    throw new ImageError("Your browser couldn't process that image.");
  }
  return out;
}

// Presets: a wide hero/logo shot, a small square-ish menu thumbnail, and a
// small profile avatar (rendered at ~40–120px, so 400px covers retina).
export const HERO_PRESET: CompressOptions = { maxDim: 1000, quality: 0.72 };
export const THUMB_PRESET: CompressOptions = { maxDim: 640, quality: 0.72 };
export const AVATAR_PRESET: CompressOptions = { maxDim: 400, quality: 0.8 };
