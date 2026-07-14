import type { RestaurantProfile } from "@prisma/client";
import { isOpenNow } from "./openHours";

export interface RestaurantCardDTO {
  id: string;
  name: string;
  cuisines: string[];
  avgRating: number;
  ratingCount: number;
  estDeliveryMin: number;
  heroImageUrl: string;
  isOpenNow: boolean;
}

export function toRestaurantCard(r: RestaurantProfile, now: Date = new Date()): RestaurantCardDTO {
  return {
    id: r.id,
    name: r.name,
    cuisines: r.cuisines,
    avgRating: r.avgRating,
    ratingCount: r.ratingCount,
    estDeliveryMin: r.estDeliveryMin,
    heroImageUrl: r.heroImageUrl,
    isOpenNow: isOpenNow(r.opensAt, r.closesAt, now),
  };
}
