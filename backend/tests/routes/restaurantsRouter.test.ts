import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createRestaurantsRouter } from "../../src/routes/restaurantsRouter";
import { createFakeRestaurantRepository, makeRestaurant } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/restaurants", createRestaurantsRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

describe("GET /api/restaurants", () => {
  it("requires auth", async () => {
    const res = await request(buildApp()).get("/api/restaurants");
    expect(res.status).toBe(401);
  });

  it("defaults to popular sort, page 1, pageSize 12 and returns card DTOs", async () => {
    const data = Array.from({ length: 15 }, (_, i) =>
      ({ profile: makeRestaurant({ orderCount: 1000 - i }) }));
    const res = await request(buildApp(data)).get("/api/restaurants").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(12);
    expect(res.body.total).toBe(15);
    expect(res.body.restaurants).toHaveLength(12);
    expect(res.body.restaurants[0].id).toBe(data[0].profile.id); // highest orderCount first
    expect(res.body.restaurants[0]).toHaveProperty("isOpenNow", true);
  });

  it("paginates", async () => {
    const data = Array.from({ length: 15 }, (_, i) =>
      ({ profile: makeRestaurant({ orderCount: 1000 - i }) }));
    const res = await request(buildApp(data)).get("/api/restaurants?page=2").set(auth);
    expect(res.body.page).toBe(2);
    expect(res.body.restaurants).toHaveLength(3);
  });

  it("filters by search and cuisine together", async () => {
    const bbqPit = makeRestaurant({ name: "Smoky BBQ Pit", cuisines: ["BBQ"] });
    const bbqShack = makeRestaurant({ name: "Grill Shack", cuisines: ["BBQ"] });
    const pizza = makeRestaurant({ name: "Smoky Pizza", cuisines: ["Pizza"] });
    const res = await request(buildApp([{ profile: bbqPit }, { profile: bbqShack }, { profile: pizza }]))
      .get("/api/restaurants?search=smoky&cuisine=BBQ").set(auth);
    expect(res.body.restaurants.map((r: { id: string }) => r.id)).toEqual([bbqPit.id]);
  });

  it("sorts by rating and delivery_time", async () => {
    const best = makeRestaurant({ avgRating: 4.9, estDeliveryMin: 50 });
    const fastest = makeRestaurant({ avgRating: 3.5, estDeliveryMin: 15 });
    const data = [{ profile: best }, { profile: fastest }];
    const byRating = await request(buildApp(data)).get("/api/restaurants?sort=rating").set(auth);
    expect(byRating.body.restaurants[0].id).toBe(best.id);
    const bySpeed = await request(buildApp(data)).get("/api/restaurants?sort=delivery_time").set(auth);
    expect(bySpeed.body.restaurants[0].id).toBe(fastest.id);
  });

  it("rejects bad sort/page values with 400", async () => {
    expect((await request(buildApp()).get("/api/restaurants?sort=cheapest").set(auth)).status).toBe(400);
    expect((await request(buildApp()).get("/api/restaurants?page=0").set(auth)).status).toBe(400);
    expect((await request(buildApp()).get("/api/restaurants?page=abc").set(auth)).status).toBe(400);
  });
});
