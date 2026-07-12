import type { PrismaClient, User } from "@prisma/client";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  create(data: { name: string; email: string; phone: string; passwordHash: string }): Promise<User>;
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
  };
}
