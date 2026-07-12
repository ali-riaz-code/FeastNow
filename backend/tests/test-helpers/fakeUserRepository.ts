import type { User } from "@prisma/client";
import type { UserRepository } from "../../src/repositories/userRepository";

export function createFakeUserRepository(seed: User[] = []): UserRepository & { users: User[] } {
  const users = [...seed];
  let nextId = seed.length + 1;

  return {
    users,
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
      const user: User = {
        id: `user-${nextId++}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: "customer",
        createdAt: new Date(),
      } as User;
      users.push(user);
      return user;
    },
  };
}
