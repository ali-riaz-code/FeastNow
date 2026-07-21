// backend/prisma/backfillGeocode.ts
// One-off: geocode existing non-demo restaurants that have no coordinates.
// Run: cd backend && npx tsx prisma/backfillGeocode.ts
import { PrismaClient } from "@prisma/client";
import { geocodeAddress } from "../src/lib/geocode";

const prisma = new PrismaClient();

async function main() {
  const targets = await prisma.restaurantProfile.findMany({
    where: { isDemo: false, OR: [{ lat: null }, { lng: null }] },
  });
  console.log(`Backfilling ${targets.length} restaurant(s)...`);
  for (const r of targets) {
    const coords = await geocodeAddress(r.address);
    if (!coords) { console.log(`  ✗ ${r.name}: geocode failed (${r.address})`); continue; }
    await prisma.restaurantProfile.update({ where: { id: r.id }, data: coords });
    console.log(`  ✓ ${r.name}: ${coords.lat}, ${coords.lng}`);
    await new Promise((res) => setTimeout(res, 1100)); // Nominatim: ≤1 req/sec
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
