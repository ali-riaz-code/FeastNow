import type { PrismaClient, User } from "@prisma/client";

// Pending restaurants are hidden from browse until approved, so a neutral
// placeholder hero is fine until imagery upload exists (SRS: future-only).
const DEFAULT_HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=60";

export interface RestaurantOwnerSignup {
  name: string; email: string; phone: string; passwordHash: string;
  businessName: string; businessAddress: string; cuisine: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  create(data: { name: string; email: string; phone: string; passwordHash: string }): Promise<User>;
  /** User (role restaurant) + pending RestaurantProfile in one transaction (FR-2). */
  createRestaurantOwner(data: RestaurantOwnerSignup): Promise<User>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  return {
    findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },
    findByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },
    findByEmailOrPhone(identifier) {
      return prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { phone: identifier }] },
      });
    },
    create(data) {
      return prisma.user.create({ data });
    },
    createRestaurantOwner(data) {
      const { businessName, businessAddress, cuisine, ...user } = data;
      return prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { ...user, role: "restaurant" } });
        await tx.restaurantProfile.create({
          data: {
            userId: created.id,
            name: businessName,
            description: "",
            address: businessAddress,
            cuisines: [cuisine],
            opensAt: "11:00",
            closesAt: "23:00",
            estDeliveryMin: 30,
            heroImageUrl: DEFAULT_HERO_IMAGE_URL,
            approvalStatus: "pending",
            approvedAt: null,
            isActive: true,
            isDemo: false,
          },
        });
        return created;
      });
    },
  };
}
