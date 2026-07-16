import type { Order, OrderItem, OrderStatus } from "@prisma/client";
import type { OrderRepository, OrderWithItems, PlaceOrderInput } from "../../src/repositories/orderRepository";
import { timestampFieldFor, EXPIRY_REJECTION_REASON } from "../../src/lib/orderStateMachine";

let seq = 0;

export function makeOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  seq += 1;
  const id = `order-${seq}`;
  return {
    id, orderNumber: 1000 + seq, customerId: "u1", restaurantId: "rest-1",
    status: "placed" as OrderStatus, rejectionReason: null,
    note: "", deliveryAddress: "12 Demo Lane, Karachi",
    subtotalCents: 90000, deliveryFeeCents: 9900, totalCents: 99900,
    createdAt: new Date("2026-07-16T12:00:00Z"),
    acceptedAt: null, preparingAt: null, readyAt: null, closedAt: null,
    expiresAt: new Date("2026-07-16T12:02:00Z"), isDemo: false,
    items: [{
      id: `oi-${seq}`, orderId: id, menuItemId: `item-${seq}`,
      nameSnapshot: "Margherita", priceAtOrderCents: 45000, quantity: 2,
    } satisfies OrderItem],
    customer: { name: "Demo Customer", phone: "03001234567" },
    restaurant: { name: "Trattoria Demo" },
    ...overrides,
  };
}

export function createFakeOrderRepository(seedOrders: OrderWithItems[] = []): OrderRepository & { orders: OrderWithItems[] } {
  const orders = [...seedOrders];

  const expire = (o: OrderWithItems, now: Date): void => {
    if (o.status === "placed" && o.expiresAt.getTime() <= now.getTime()) {
      o.status = "rejected"; o.rejectionReason = EXPIRY_REJECTION_REASON; o.closedAt = now;
    }
  };

  return {
    orders,
    async create(input: PlaceOrderInput) {
      const { items, ...rest } = input;
      const o = makeOrder({
        ...rest,
        customer: { name: "Demo Customer", phone: "03001234567" },
        restaurant: { name: "Trattoria Demo" },
      });
      o.items = items.map((it, i) => ({ id: `${o.id}-oi-${i}`, orderId: o.id, ...it }));
      orders.push(o);
      return o;
    },
    async findById(id) { return orders.find((o) => o.id === id) ?? null; },
    async listForCustomer(customerId, page, pageSize) {
      const rows = orders.filter((o) => o.customerId === customerId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { orders: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
    },
    async listForRestaurant(restaurantId, statuses, q, page, pageSize) {
      let rows = orders.filter((o) => o.restaurantId === restaurantId && statuses.includes(o.status));
      if (q) {
        const n = Number.parseInt(q.replace(/\D/g, ""), 10);
        rows = rows.filter((o) => o.orderNumber === n || o.customer.name.toLowerCase().includes(q.toLowerCase()));
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { orders: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
    },
    async countByStatus(restaurantId) {
      const counts: Partial<Record<OrderStatus, number>> = {};
      for (const o of orders) if (o.restaurantId === restaurantId) counts[o.status] = (counts[o.status] ?? 0) + 1;
      return counts;
    },
    async transition(id, from, to, now, rejectionReason) {
      const o = orders.find((x) => x.id === id);
      if (!o || o.status !== from) return null; // guarded update semantics
      o.status = to;
      if (rejectionReason !== undefined) o.rejectionReason = rejectionReason;
      const field = timestampFieldFor(to);
      if (field) o[field] = now;
      return o;
    },
    async expireOverdue(now, scope) {
      let n = 0;
      for (const o of orders) {
        if (scope.restaurantId && o.restaurantId !== scope.restaurantId) continue;
        if (scope.customerId && o.customerId !== scope.customerId) continue;
        if (scope.orderId && o.id !== scope.orderId) continue;
        const before = o.status;
        expire(o, now);
        if (before !== o.status) n += 1;
      }
      return n;
    },
  };
}
