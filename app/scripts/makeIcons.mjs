// One-off: rasterize the landing favicon into PWA icons.
// Run from app/: npm i -D sharp && node scripts/makeIcons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp("../landing/favicon.svg", { density: 300 })
    .resize(size, size, { fit: "contain", background: "#0F2C56" })
    .flatten({ background: "#0F2C56" })
    .png()
    .toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png written`);
}
