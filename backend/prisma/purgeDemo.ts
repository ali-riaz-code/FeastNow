import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Pre-launch cleanup (spec §3): hard-deletes isDemo restaurants; MenuItem and
// Rating rows cascade. Only run once no orders reference demo rows.
async function main() {
  const prisma = new PrismaClient();
  const { count } = await prisma.restaurantProfile.deleteMany({ where: { isDemo: true } });
  console.log(`Purged ${count} demo restaurants (menu items and ratings cascaded).`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
