import type { MenuItem, PrismaClient, Rating, RestaurantProfile } from "@prisma/client";

export interface MenuItemInput {
  category: string; name: string; description: string; priceCents: number; isAvailable: boolean;
  imageUrl?: string | null;
}

export interface ProfileUpdate {
  name: string; description: string; address: string; cuisines: string[]; opensAt: string; closesAt: string;
  heroImageUrl?: string;
}

export interface OwnerRepository {
  findProfileByUserId(userId: string): Promise<RestaurantProfile | null>;
  approve(profileId: string, now: Date): Promise<RestaurantProfile>;
  updateProfile(profileId: string, data: ProfileUpdate): Promise<RestaurantProfile>;
  setOnline(profileId: string, isOnline: boolean): Promise<RestaurantProfile>;
  listMenu(restaurantId: string): Promise<MenuItem[]>;
  createMenuItem(restaurantId: string, data: MenuItemInput): Promise<MenuItem>;
  /** Ownership-guarded: null when the item doesn't belong to restaurantId. */
  updateMenuItem(restaurantId: string, itemId: string, data: Partial<MenuItemInput>): Promise<MenuItem | null>;
  deleteMenuItem(restaurantId: string, itemId: string): Promise<boolean>;
  listRatings(restaurantId: string, limit: number): Promise<Rating[]>;
}

export function createOwnerRepository(prisma: PrismaClient): OwnerRepository {
  return {
    findProfileByUserId(userId) {
      return prisma.restaurantProfile.findFirst({ where: { userId } });
    },
    approve(profileId, now) {
      return prisma.restaurantProfile.update({
        where: { id: profileId },
        data: { approvalStatus: "approved", approvedAt: now },
      });
    },
    updateProfile(profileId, data) {
      return prisma.restaurantProfile.update({ where: { id: profileId }, data });
    },
    setOnline(profileId, isOnline) {
      return prisma.restaurantProfile.update({ where: { id: profileId }, data: { isOnline } });
    },
    listMenu(restaurantId) {
      return prisma.menuItem.findMany({ where: { restaurantId }, orderBy: { position: "asc" } });
    },
    async createMenuItem(restaurantId, data) {
      const max = await prisma.menuItem.aggregate({ where: { restaurantId }, _max: { position: true } });
      return prisma.menuItem.create({
        data: { ...data, restaurantId, position: (max._max.position ?? 0) + 1 },
      });
    },
    async updateMenuItem(restaurantId, itemId, data) {
      const { count } = await prisma.menuItem.updateMany({ where: { id: itemId, restaurantId }, data });
      if (count === 0) return null;
      return prisma.menuItem.findUnique({ where: { id: itemId } });
    },
    async deleteMenuItem(restaurantId, itemId) {
      const { count } = await prisma.menuItem.deleteMany({ where: { id: itemId, restaurantId } });
      return count > 0;
    },
    listRatings(restaurantId, limit) {
      return prisma.rating.findMany({
        where: { restaurantId }, orderBy: { createdAt: "desc" }, take: limit,
      });
    },
  };
}
