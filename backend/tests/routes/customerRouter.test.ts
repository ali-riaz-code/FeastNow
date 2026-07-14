import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createCustomerRouter } from "../../src/routes/customerRouter";
import { createFakeRestaurantRepository, makeRestaurant } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/customer", createCustomerRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

describe("GET /api/customer/home", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).get("/api/customer/home");
    expect(res.status).toBe(401);
  });

  it("returns ordered sections of RestaurantCardDTOs plus the cuisine list", async () => {
    const popular = makeRestaurant({ name: "Popular Place", orderCount: 999, avgRating: 4.9, estDeliveryMin: 20, approvedAt: daysAgo(5), cuisines: ["BBQ"] });
    const old = makeRestaurant({ name: "Old Slow Place", orderCount: 10, avgRating: 3.1, estDeliveryMin: 55, approvedAt: daysAgo(200), cuisines: ["Pakistani"] });
    const res = await request(buildApp([{ profile: popular }, { profile: old }]))
      .get("/api/customer/home").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.cuisines).toEqual(["BBQ", "Pakistani"]);
    expect(res.body.sections.map((s: { key: string }) => s.key))
      .toEqual(["most_popular", "top_rated", "new_on_feastnow", "under_30"]);
    const mostPopular = res.body.sections[0];
    expect(mostPopular.title).toBe("Most Popular Near You");
    expect(mostPopular.restaurants[0]).toEqual({
      id: popular.id, name: "Popular Place", cuisines: ["BBQ"], avgRating: 4.9,
      ratingCount: popular.ratingCount, estDeliveryMin: 20,
      heroImageUrl: popular.heroImageUrl, isOpenNow: true,
    });
    // new_on_feastnow contains only the recently approved restaurant
    const fresh = res.body.sections.find((s: { key: string }) => s.key === "new_on_feastnow");
    expect(fresh.restaurants.map((r: { id: string }) => r.id)).toEqual([popular.id]);
    // under_30 excludes the 55-minute restaurant
    const under30 = res.body.sections.find((s: { key: string }) => s.key === "under_30");
    expect(under30.restaurants.map((r: { id: string }) => r.id)).toEqual([popular.id]);
  });

  it("omits sections with no data instead of sending empty rows", async () => {
    // Unrated, slow, old restaurant → only most_popular qualifies
    const lone = makeRestaurant({ ratingCount: 0, estDeliveryMin: 45, approvedAt: daysAgo(300) });
    const res = await request(buildApp([{ profile: lone }])).get("/api/customer/home").set(auth);
    expect(res.body.sections.map((s: { key: string }) => s.key)).toEqual(["most_popular"]);
  });

  it("hides inactive (retired demo) restaurants everywhere", async () => {
    const retired = makeRestaurant({ isActive: false });
    const res = await request(buildApp([{ profile: retired }])).get("/api/customer/home").set(auth);
    expect(res.body.sections).toEqual([]);
    expect(res.body.cuisines).toEqual([]);
  });
});
