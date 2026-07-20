import { describe, it, expect, vi } from "vitest";
import { createUserRepository } from "../../src/repositories/userRepository";

it("creates a delivery partner profile with approvedAt null (pending)", async () => {
  const created: any[] = [];
  const tx = {
    user: { create: vi.fn(async ({ data }: any) => ({ id: "u1", ...data })) },
    deliveryPartnerProfile: { create: vi.fn(async ({ data }: any) => { created.push(data); return data; }) },
  };
  const prisma: any = { $transaction: async (fn: any) => fn(tx) };
  const repo = createUserRepository(prisma);
  await repo.createDeliveryPartner({ name: "R", email: "r@x.co", phone: "1", passwordHash: "h", vehicleType: "bike" });
  expect(created[0].approvedAt).toBeNull();
});
