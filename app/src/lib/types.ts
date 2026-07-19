export type UserRole = "customer" | "restaurant" | "delivery_partner" | "admin";
export interface Me { id: string; name: string; email: string; phone: string; role: UserRole; }

export interface RestaurantCard {
  id: string; name: string; cuisines: string[]; avgRating: number;
  ratingCount: number; estDeliveryMin: number; heroImageUrl: string; isOpenNow: boolean;
}

export interface HomeSection { key: string; title: string; restaurants: RestaurantCard[]; }
export interface HomeResponse { cuisines: string[]; sections: HomeSection[]; }

export interface RestaurantListResponse {
  restaurants: RestaurantCard[]; page: number; pageSize: number; total: number;
}

export interface MenuItem {
  id: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean;
}
export interface MenuGroup { category: string; items: MenuItem[]; }
export interface Review {
  id: string; stars: number; reviewText: string; authorName: string; createdAt: string;
}
export interface RestaurantDetail {
  id: string; name: string; description: string; address: string; cuisines: string[];
  avgRating: number; ratingCount: number; estDeliveryMin: number; heroImageUrl: string;
  opensAt: string; closesAt: string; isOpenNow: boolean;
  menu: MenuGroup[]; reviews: Review[];
}

export interface DishHit {
  id: string; name: string; priceCents: number; imageUrl: string | null;
  isAvailable: boolean; restaurantId: string; restaurantName: string;
}
export interface SearchResponse { restaurants: RestaurantCard[]; dishes: DishHit[]; }

export type RestaurantSort = "popular" | "rating" | "delivery_time";

export type OrderStatus =
  | "placed" | "accepted" | "preparing" | "ready"
  | "assigned" | "out_for_delivery" | "delivered"
  | "rejected" | "cancelled";

export interface OrderItemDTO {
  id: string; nameSnapshot: string; priceAtOrderCents: number; quantity: number;
}

export interface OrderDTO {
  id: string; orderNumber: number; status: OrderStatus;
  rejectionReason: string | null; note: string; deliveryAddress: string;
  subtotalCents: number; deliveryFeeCents: number; totalCents: number;
  placedAt: string; acceptedAt: string | null; preparingAt: string | null;
  readyAt: string | null; closedAt: string | null; expiresAt: string;
  assignedAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null;
  payoutCents: number | null; deliveryPartnerName: string | null;
  restaurantName: string; customerName: string; customerPhone: string;
  items: OrderItemDTO[];
}

export interface OrdersListResponse {
  orders: OrderDTO[]; total: number; page: number; pageSize: number;
  counts?: { new: number; preparing: number; ready: number };
}

export interface OwnerProfile {
  id: string; name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; isOnline: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  avgRating: number; ratingCount: number; estDeliveryMin: number;
}

export interface OwnerMenuItem {
  id: string; category: string; name: string; description: string;
  priceCents: number; imageUrl: string | null; isAvailable: boolean; position: number;
}

export interface OwnerReview {
  id: string; stars: number; reviewText: string; authorName: string; createdAt: string;
}

// ---- Delivery partner ----
export type VehicleType = "bike" | "motorcycle" | "car";

export interface PartnerProfile {
  id: string; name: string; phone: string; vehicleType: VehicleType;
  availabilityStatus: "offline" | "online"; approved: boolean;
}

export interface DeliveryOfferDTO {
  id: string; orderNumber: number; restaurantName: string;
  pickupDistanceKm: number | null; dropoffDistanceKm: number | null;
  payoutCents: number; expiresAt: string;
}

export interface ActiveDeliveryDTO {
  order: OrderDTO; restaurantAddress: string; restaurantPhone: string | null;
  restaurantLat: number | null; restaurantLng: number | null;
  deliveryLat: number | null; deliveryLng: number | null; payoutCents: number | null;
}

export interface EarningsDTO {
  today: { cents: number; count: number };
  week: { cents: number; count: number };
  deliveries: { id: string; orderNumber: number; restaurantName: string; payoutCents: number; deliveredAt: string }[];
}

// ---- Admin ----
export interface AdminMetrics { activeOrders: number; newSignups24h: number; pendingApprovals: number; }
export interface AdminApprovalRow { id: string; name: string; cuisines: string[]; address: string; createdAt: string; }
export interface AdminRestaurantDetail {
  id: string; name: string; description: string; address: string; cuisines: string[];
  opensAt: string; closesAt: string; approvalStatus: "pending" | "approved" | "rejected";
  adminNote: string | null; createdAt: string;
}
export interface AdminUserRow { id: string; name: string; email: string; phone: string; role: UserRole; suspended: boolean; createdAt: string; }
export interface AdminReviewRow { id: string; stars: number; reviewText: string; authorName: string; createdAt: string; restaurantId: string; restaurantName: string; }
export type DiscountType = "percentage" | "fixed";
export interface AdminPromo { id: string; code: string; discountType: DiscountType; discountValue: number; active: boolean; expiresAt: string | null; }
