import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createRestaurantsRouter } from "../../src/routes/restaurantsRouter";
import { createFakeRestaurantRepository, makeRestaurant, makeMenuItem, makeRating } from "../test-helpers/fakeRestaurantRepository";
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

describe("GET /api/restaurants/:id", () => {
  it("returns profile, menu grouped by category in position order, and recent reviews", async () => {
    const r = makeRestaurant({ name: "Karahi Khaas", opensAt: "00:00", closesAt: "00:00" });
    const menuItems = [
      makeMenuItem(r.id, { category: "Starters", name: "Samosa", position: 1 }),
      makeMenuItem(r.id, { category: "Mains", name: "Karahi", position: 2 }),
      makeMenuItem(r.id, { category: "Starters", name: "Kebab", position: 3 }),
    ];
    const ratings = Array.from({ length: 6 }, (_, i) =>
      makeRating(r.id, { stars: 5, createdAt: new Date(2026, 0, i + 1) }));
    const res = await request(buildApp([{ profile: r, menuItems, ratings }]))
      .get(`/api/restaurants/${r.id}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Karahi Khaas");
    expect(res.body.isOpenNow).toBe(true);
    expect(res.body.menu.map((g: { category: string }) => g.category)).toEqual(["Starters", "Mains"]);
    expect(res.body.menu[0].items.map((i: { name: string }) => i.name)).toEqual(["Samosa", "Kebab"]);
    expect(res.body.menu[0].items[0]).toEqual({
      id: menuItems[0].id, name: "Samosa", description: "Tasty.",
      priceCents: 45000, imageUrl: null, isAvailable: true,
    });
    expect(res.body.reviews).toHaveLength(5); // capped at 5 most recent
    expect(new Date(res.body.reviews[0].createdAt).getTime())
      .toBeGreaterThan(new Date(res.body.reviews[4].createdAt).getTime());
  });

  it("404s for unknown and inactive restaurants", async () => {
    const retired = makeRestaurant({ isActive: false });
    const app = buildApp([{ profile: retired }]);
    expect((await request(app).get("/api/restaurants/nope").set(auth)).status).toBe(404);
    expect((await request(app).get(`/api/restaurants/${retired.id}`).set(auth)).status).toBe(404);
  });

  it("requires auth", async () => {
    expect((await request(buildApp()).get("/api/restaurants/x")).status).toBe(401);
  });
});
