import type { PrismaClient, Prisma, RestaurantProfile, MenuItem, Rating } from "@prisma/client";

export type RestaurantSort = "popular" | "rating" | "delivery_time";

export interface RestaurantListParams {
  search?: string;
  cuisine?: string;
  sort: RestaurantSort;
  page: number;
  pageSize: number;
}

export type RestaurantDetail = RestaurantProfile & { menuItems: MenuItem[]; recentRatings: Rating[] };
export type DishHit = MenuItem & { restaurant: { id: string; name: string } };

export interface RestaurantRepository {
  findMostPopular(limit: number): Promise<RestaurantProfile[]>;
  findTopRated(limit: number): Promise<RestaurantProfile[]>;
  findNewSince(since: Date, limit: number): Promise<RestaurantProfile[]>;
  findUnder30(limit: number): Promise<RestaurantProfile[]>;
  listCuisines(): Promise<string[]>;
  list(params: RestaurantListParams): Promise<{ restaurants: RestaurantProfile[]; total: number }>;
  findDetailById(id: string): Promise<RestaurantDetail | null>;
  searchRestaurants(q: string, limit: number): Promise<RestaurantProfile[]>;
  searchDishes(q: string, limit: number): Promise<DishHit[]>;
}

const ACTIVE = { isActive: true, approvalStatus: "approved" } as const;

const LIST_ORDER: Record<RestaurantSort, Prisma.RestaurantProfileOrderByWithRelationInput[]> = {
  popular: [{ orderCount: "desc" }, { name: "asc" }],
  rating: [{ avgRating: "desc" }, { ratingCount: "desc" }, { name: "asc" }],
  delivery_time: [{ estDeliveryMin: "asc" }, { orderCount: "desc" }, { name: "asc" }],
};

export function createRestaurantRepository(prisma: PrismaClient): RestaurantRepository {
  return {
    findMostPopular(limit) {
      return prisma.restaurantProfile.findMany({
        where: ACTIVE, orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    findTopRated(limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, ratingCount: { gt: 0 } },
        orderBy: [{ avgRating: "desc" }, { ratingCount: "desc" }, { name: "asc" }],
        take: limit,
      });
    },
    findNewSince(since, limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, approvedAt: { gte: since } },
        orderBy: { approvedAt: "desc" }, take: limit,
      });
    },
    findUnder30(limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, estDeliveryMin: { lte: 30 } },
        orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    async listCuisines() {
      const rows = await prisma.restaurantProfile.findMany({
        where: ACTIVE, select: { cuisines: true },
      });
      return [...new Set(rows.flatMap((r) => r.cuisines))].sort();
    },
    async list(params) {
      const where: Prisma.RestaurantProfileWhereInput = { ...ACTIVE };
      if (params.search) where.name = { contains: params.search, mode: "insensitive" };
      if (params.cuisine) where.cuisines = { has: params.cuisine };
      const [restaurants, total] = await Promise.all([
        prisma.restaurantProfile.findMany({
          where, orderBy: LIST_ORDER[params.sort],
          skip: (params.page - 1) * params.pageSize, take: params.pageSize,
        }),
        prisma.restaurantProfile.count({ where }),
      ]);
      return { restaurants, total };
    },
    async findDetailById(id) {
      const row = await prisma.restaurantProfile.findFirst({
        where: { id, ...ACTIVE },
        include: {
          menuItems: { orderBy: { position: "asc" } },
          ratings: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      });
      if (!row) return null;
      const { ratings, ...rest } = row;
      return { ...rest, recentRatings: ratings };
    },
    searchRestaurants(q, limit) {
      return prisma.restaurantProfile.findMany({
        where: { ...ACTIVE, name: { contains: q, mode: "insensitive" } },
        orderBy: [{ orderCount: "desc" }, { name: "asc" }], take: limit,
      });
    },
    searchDishes(q, limit) {
      return prisma.menuItem.findMany({
        where: { name: { contains: q, mode: "insensitive" }, restaurant: ACTIVE },
        include: { restaurant: { select: { id: true, name: true } } },
        orderBy: { name: "asc" }, take: limit,
      });
    },
  };
}
