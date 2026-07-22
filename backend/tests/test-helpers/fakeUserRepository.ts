import type { User } from "@prisma/client";
import type {
  DeliveryPartnerSignup,
  RestaurantOwnerSignup,
  UserRepository,
} from "../../src/repositories/userRepository";

export function createFakeUserRepository(
  seed: User[] = [],
): UserRepository & {
  users: User[];
  lastRestaurantOwner: RestaurantOwnerSignup | null;
  lastDeliveryPartner: DeliveryPartnerSignup | null;
} {
  const users = [...seed];
  let nextId = seed.length + 1;
  let lastRestaurantOwner: RestaurantOwnerSignup | null = null;
  let lastDeliveryPartner: DeliveryPartnerSignup | null = null;

  function makeUser(
    data: { name: string; email: string; phone: string; passwordHash: string },
    role: User["role"] = "customer",
  ): User {
    return {
      id: `user-${nextId++}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role,
      avatarUrl: null,
      createdAt: new Date(),
    } as User;
  }

  return {
    users,
    get lastRestaurantOwner() {
      return lastRestaurantOwner;
    },
    get lastDeliveryPartner() {
      return lastDeliveryPartner;
    },
    async findById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async findByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async findByEmailOrPhone(identifier) {
      return users.find((u) => u.email === identifier || u.phone === identifier) ?? null;
    },
    async create(data) {
      const user = makeUser(data);
      users.push(user);
      return user;
    },
    async updateAvatar(id, avatarUrl) {
      const user = users.find((u) => u.id === id);
      if (!user) throw new Error(`No user ${id}`);
      user.avatarUrl = avatarUrl;
      return user;
    },
    async createRestaurantOwner(data) {
      lastRestaurantOwner = data;
      const user = makeUser(data, "restaurant");
      users.push(user);
      return user;
    },
    async createDeliveryPartner(data) {
      lastDeliveryPartner = data;
      const user = makeUser(data, "delivery_partner");
      users.push(user);
      return user;
    },
  };
}
