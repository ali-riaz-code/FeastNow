export interface Me { id: string; name: string; email: string; phone: string; }

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
