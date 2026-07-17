import type { MenuItem, Rating, RestaurantProfile } from "@prisma/client";
import type { MenuItemInput, OwnerRepository, ProfileUpdate } from "../../src/repositories/ownerRepository";
import { makeMenuItem, makeRating, makeRestaurant } from "./fakeRestaurantRepository";

export interface FakeOwnerData {
  profile: RestaurantProfile;
  menuItems?: MenuItem[];
  ratings?: Rating[];
}

export function createFakeOwnerRepository(data: FakeOwnerData[]): OwnerRepository & { data: FakeOwnerData[] } {
  const byId = (id: string) => data.find((d) => d.profile.id === id);
  let itemSeq = 0;

  return {
    data,
    async findProfileByUserId(userId) {
      return data.find((d) => d.profile.userId === userId)?.profile ?? null;
    },
    async approve(profileId, now) {
      const p = byId(profileId)!.profile;
      p.approvalStatus = "approved"; p.approvedAt = now;
      return p;
    },
    async updateProfile(profileId, patch: ProfileUpdate) {
      const p = byId(profileId)!.profile;
      Object.assign(p, patch);
      return p;
    },
    async setOnline(profileId, isOnline) {
      const p = byId(profileId)!.profile;
      p.isOnline = isOnline;
      return p;
    },
    async listMenu(restaurantId) {
      return [...(byId(restaurantId)?.menuItems ?? [])].sort((a, b) => a.position - b.position);
    },
    async createMenuItem(restaurantId, input: MenuItemInput) {
      itemSeq += 1;
      const d = byId(restaurantId)!;
      d.menuItems ??= [];
      const item: MenuItem = {
        id: `new-item-${itemSeq}`, restaurantId, imageUrl: null,
        position: d.menuItems.length + 1, ...input,
      };
      d.menuItems.push(item);
      return item;
    },
    async updateMenuItem(restaurantId, itemId, patch) {
      const item = byId(restaurantId)?.menuItems?.find((m) => m.id === itemId);
      if (!item) return null;
      Object.assign(item, patch);
      return item;
    },
    async deleteMenuItem(restaurantId, itemId) {
      const d = byId(restaurantId);
      const before = d?.menuItems?.length ?? 0;
      if (d?.menuItems) d.menuItems = d.menuItems.filter((m) => m.id !== itemId);
      return (d?.menuItems?.length ?? 0) < before;
    },
    async listRatings(restaurantId, limit) {
      return (byId(restaurantId)?.ratings ?? [])
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },
  };
}

/** Owner-scoped fixture: an approved, online, owned restaurant. */
export function makeOwnedRestaurant(userId = "owner-1") {
  const profile = makeRestaurant({ userId, opensAt: "00:00", closesAt: "00:00" });
  return {
    profile,
    menuItems: [makeMenuItem(profile.id), makeMenuItem(profile.id)],
    ratings: [makeRating(profile.id)],
  } satisfies FakeOwnerData;
}
