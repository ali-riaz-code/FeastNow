import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildSeedData } from "./seedData";
import { hashPassword } from "../src/lib/password";
import { EXPIRY_REJECTION_REASON } from "../src/lib/orderStateMachine";

// Idempotent demo seed (spec §3): deletes ONLY isDemo restaurants (menu items
// and ratings cascade), then recreates them. Never touches User/OtpChallenge
// or non-demo rows.
async function main() {
  const prisma = new PrismaClient();
  const data = buildSeedData(new Date());

  const { count: orderCount } = await prisma.order.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${orderCount} existing demo orders.`);
  const { count } = await prisma.restaurantProfile.deleteMany({ where: { isDemo: true } });
  console.log(`Removed ${count} existing demo restaurants.`);

  for (const r of data) {
    const { menuItems, reviews, ...profile } = r;
    await prisma.restaurantProfile.create({
      data: {
        ...profile,
        isDemo: true,
        isActive: true,
        approvalStatus: "approved", // schema default is pending, which would hide demo rows from browse

        menuItems: { create: menuItems },
        ratings: { create: reviews },
      },
    });
  }

  // Demo restaurant owner (spec §8) — idempotent via upsert; owns the first demo restaurant.
  const DEMO_OWNER_EMAIL = "owner@demo.feastnow.pk";
  const first = await prisma.restaurantProfile.findFirst({ where: { isDemo: true }, orderBy: { name: "asc" } });
  if (!first) throw new Error("Seed created no demo restaurants — cannot attach demo owner.");

  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: {},
    create: {
      name: "Demo Owner", email: DEMO_OWNER_EMAIL, phone: "03330000001",
      passwordHash: await hashPassword("Demo1234!"), role: "restaurant",
    },
  });
  await prisma.restaurantProfile.update({ where: { id: first.id }, data: { userId: owner.id } });

  // Demo customer (order author) + closed historical orders so History isn't empty.
  const demoCustomer = await prisma.user.upsert({
    where: { email: "customer@demo.feastnow.pk" },
    update: {},
    create: {
      name: "Demo Customer", email: "customer@demo.feastnow.pk", phone: "03330000002",
      passwordHash: await hashPassword("Demo1234!"), role: "customer",
    },
  });

  // Demo delivery partner — idempotent via upsert.
  const partnerUser = await prisma.user.upsert({
    where: { email: "rider@demo.feastnow" },
    update: {},
    create: {
      name: "Demo Rider", email: "rider@demo.feastnow", phone: "03009990000",
      passwordHash: await hashPassword("Demo1234!"), role: "delivery_partner",
    },
  });
  await prisma.deliveryPartnerProfile.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: { userId: partnerUser.id, vehicleType: "motorcycle", availabilityStatus: "offline", approvedAt: new Date() },
  });
  console.log(`Demo partner: rider@demo.feastnow / Demo1234!`);

  // Admin back-office account (FR-36) — idempotent via upsert.
  const ADMIN_EMAIL = "admin@demo.feastnow.pk";
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: "FeastNow Admin", email: ADMIN_EMAIL, phone: "03330000009",
      passwordHash: await hashPassword("Admin1234!"), role: "admin",
    },
  });
  console.log(`Admin: ${ADMIN_EMAIL} / Admin1234!`);

  const menu = await prisma.menuItem.findMany({ where: { restaurantId: first.id }, take: 2 });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const historical = [
    { status: "rejected" as const, rejectionReason: "Store too busy", placed: daysAgo(2) },
    { status: "rejected" as const, rejectionReason: EXPIRY_REJECTION_REASON, placed: daysAgo(1) },
    { status: "cancelled" as const, rejectionReason: null, placed: daysAgo(1) },
  ];
  for (const h of historical) {
    const subtotal = menu.reduce((s, m) => s + m.priceCents, 0);
    await prisma.order.create({
      data: {
        customerId: demoCustomer.id, restaurantId: first.id, status: h.status,
        rejectionReason: h.rejectionReason, note: "", deliveryAddress: "12 Demo Lane, Karachi",
        subtotalCents: subtotal, deliveryFeeCents: 9900, totalCents: subtotal + 9900,
        createdAt: h.placed, closedAt: new Date(h.placed.getTime() + 120_000),
        expiresAt: new Date(h.placed.getTime() + 120_000), isDemo: true,
        items: { create: menu.map((m) => ({ menuItemId: m.id, nameSnapshot: m.name, priceAtOrderCents: m.priceCents, quantity: 1 })) },
      },
    });
  }
  console.log(`Demo owner: ${DEMO_OWNER_EMAIL} / Demo1234! → "${first.name}" (+${historical.length} historical demo orders)`);

  const totals = {
    restaurants: await prisma.restaurantProfile.count({ where: { isDemo: true } }),
    menuItems: await prisma.menuItem.count(),
    ratings: await prisma.rating.count(),
  };
  console.log(`Seeded: ${JSON.stringify(totals)}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
