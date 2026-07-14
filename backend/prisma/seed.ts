import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildSeedData } from "./seedData";

// Idempotent demo seed (spec §3): deletes ONLY isDemo restaurants (menu items
// and ratings cascade), then recreates them. Never touches User/OtpChallenge
// or non-demo rows.
async function main() {
  const prisma = new PrismaClient();
  const data = buildSeedData(new Date());

  const { count } = await prisma.restaurantProfile.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${count} existing demo restaurants.`);

  for (const r of data) {
    const { menuItems, reviews, ...profile } = r;
    await prisma.restaurantProfile.create({
      data: {
        ...profile,
        isDemo: true,
        isActive: true,
        menuItems: { create: menuItems },
        ratings: { create: reviews },
      },
    });
  }

  const totals = {
    restaurants: await prisma.restaurantProfile.count({ where: { isDemo: true } }),
    menuItems: await prisma.menuItem.count(),
    ratings: await prisma.rating.count(),
  };
  console.log(`Seeded: ${JSON.stringify(totals)}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
