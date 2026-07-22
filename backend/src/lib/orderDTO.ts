import type { OrderStatus } from "@prisma/client";
import type { OrderWithItems } from "../repositories/orderRepository";

export interface OrderItemDTO {
  id: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number;
}

export interface OrderDTO {
  id: string; orderNumber: number; status: OrderStatus;
  rejectionReason: string | null; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; discountCents: number; totalCents: number;
  promoCode: string | null;
  placedAt: string; acceptedAt: string | null; preparingAt: string | null;
  readyAt: string | null; closedAt: string | null; expiresAt: string;
  assignedAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null;
  payoutCents: number | null; deliveryPartnerName: string | null;
  restaurantName: string; customerName: string; customerPhone: string;
  items: OrderItemDTO[];
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toOrderDTO(o: OrderWithItems): OrderDTO {
  return {
    id: o.id, orderNumber: o.orderNumber, status: o.status,
    rejectionReason: o.rejectionReason, note: o.note, deliveryAddress: o.deliveryAddress,
    subtotalCents: o.subtotalCents, deliveryFeeCents: o.deliveryFeeCents,
    discountCents: o.discountCents, totalCents: o.totalCents, promoCode: o.promoCode?.code ?? null,
    placedAt: o.createdAt.toISOString(), acceptedAt: iso(o.acceptedAt),
    preparingAt: iso(o.preparingAt), readyAt: iso(o.readyAt), closedAt: iso(o.closedAt),
    expiresAt: o.expiresAt.toISOString(),
    assignedAt: iso(o.assignedAt), outForDeliveryAt: iso(o.outForDeliveryAt), deliveredAt: iso(o.deliveredAt),
    payoutCents: o.payoutCents ?? null, deliveryPartnerName: o.deliveryPartner?.name ?? null,
    restaurantName: o.restaurant.name, customerName: o.customer.name, customerPhone: o.customer.phone,
    items: o.items.map((i) => ({
      id: i.id, nameSnapshot: i.nameSnapshot, priceAtOrderCents: i.priceAtOrderCents, quantity: i.quantity,
    })),
  };
}
