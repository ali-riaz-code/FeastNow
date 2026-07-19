import type { Order, OrderItem, OrderStatus, PrismaClient, Prisma } from "@prisma/client";
import { timestampFieldFor, EXPIRY_REJECTION_REASON } from "../lib/orderStateMachine";

export interface PlaceOrderInput {
  customerId: string; restaurantId: string; note: string; deliveryAddress: string;
  deliveryLat?: number | null; deliveryLng?: number | null;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  expiresAt: Date; isDemo: boolean;
  items: { menuItemId: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number }[];
}

export type OrderWithItems = Order & {
  items: OrderItem[];
  customer: { name: string; phone: string };
  restaurant: { name: string };
  deliveryPartner: { name: string } | null;
};

export interface OrderRepository {
  create(input: PlaceOrderInput): Promise<OrderWithItems>;
  findById(id: string): Promise<OrderWithItems | null>;
  listForCustomer(customerId: string, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  listForRestaurant(restaurantId: string, statuses: OrderStatus[], q: string | undefined, page: number, pageSize: number): Promise<{ orders: OrderWithItems[]; total: number }>;
  countByStatus(restaurantId: string): Promise<Partial<Record<OrderStatus, number>>>;
  /** Guarded transition: applies only while status === from. Null = guard lost (caller 409s). */
  transition(id: string, from: OrderStatus, to: OrderStatus, now: Date, rejectionReason?: string): Promise<OrderWithItems | null>;
  /** Lazy expiry sweep (spec §3): finalize overdue placed orders in scope. */
  expireOverdue(now: Date, scope: { restaurantId?: string; customerId?: string; orderId?: string }): Promise<number>;
}

const INCLUDE = {
  items: true,
  customer: { select: { name: true, phone: true } },
  restaurant: { select: { name: true } },
  deliveryPartner: { select: { name: true } },
} satisfies Prisma.OrderInclude;

export function createOrderRepository(prisma: PrismaClient): OrderRepository {
  return {
    create(input) {
      const { items, ...order } = input;
      return prisma.order.create({
        data: { ...order, items: { create: items } },
        include: INCLUDE,
      });
    },
    findById(id) {
      return prisma.order.findUnique({ where: { id }, include: INCLUDE });
    },
    async listForCustomer(customerId, page, pageSize) {
      const where = { customerId };
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where, include: INCLUDE, orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize, take: pageSize,
        }),
        prisma.order.count({ where }),
      ]);
      return { orders, total };
    },
    async listForRestaurant(restaurantId, statuses, q, page, pageSize) {
      const where: Prisma.OrderWhereInput = { restaurantId, status: { in: statuses } };
      if (q) {
        const n = Number.parseInt(q.replace(/\D/g, ""), 10);
        where.OR = [
          ...(Number.isNaN(n) ? [] : [{ orderNumber: n }]),
          { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
        ];
      }
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where, include: INCLUDE, orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize, take: pageSize,
        }),
        prisma.order.count({ where }),
      ]);
      return { orders, total };
    },
    async countByStatus(restaurantId) {
      const rows = await prisma.order.groupBy({
        by: ["status"], where: { restaurantId }, _count: { _all: true },
      });
      return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    },
    async transition(id, from, to, now, rejectionReason) {
      const data: Prisma.OrderUpdateManyMutationInput = { status: to };
      if (rejectionReason !== undefined) data.rejectionReason = rejectionReason;
      const field = timestampFieldFor(to);
      if (field) data[field] = now;
      const { count } = await prisma.order.updateMany({ where: { id, status: from }, data });
      if (count === 0) return null;
      return prisma.order.findUnique({ where: { id }, include: INCLUDE });
    },
    async expireOverdue(now, scope) {
      const { count } = await prisma.order.updateMany({
        where: {
          status: "placed", expiresAt: { lte: now },
          ...(scope.restaurantId ? { restaurantId: scope.restaurantId } : {}),
          ...(scope.customerId ? { customerId: scope.customerId } : {}),
          ...(scope.orderId ? { id: scope.orderId } : {}),
        },
        data: { status: "rejected", rejectionReason: EXPIRY_REJECTION_REASON, closedAt: now },
      });
      return count;
    },
  };
}
