import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

// Upserts a known customer account for automated smoke tests.
// Usage (from backend/): TEST_USER_PASSWORD=<pw> npx tsx scripts/createTestUser.ts
async function main() {
  const password = process.env.TEST_USER_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("Set TEST_USER_PASSWORD (min 8 chars).");
  }
  const prisma = new PrismaClient();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email: "smoke.customer@feastnow.demo" },
    update: { passwordHash },
    create: {
      name: "Smoke Customer", email: "smoke.customer@feastnow.demo",
      phone: "+920000000001", passwordHash, role: "customer",
    },
  });
  console.log(`Test user ready: ${user.email}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
