import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { createSearchRouter } from "../../src/routes/searchRouter";
import { createFakeRestaurantRepository, makeRestaurant, makeMenuItem } from "../test-helpers/fakeRestaurantRepository";
import { signToken } from "../../src/lib/jwt";

const JWT_SECRET = "test-secret";
const auth = { Authorization: `Bearer ${signToken({ userId: "u1" }, JWT_SECRET)}` };

function buildApp(data: Parameters<typeof createFakeRestaurantRepository>[0] = []) {
  const app = express();
  app.use("/api/search", createSearchRouter({
    restaurantRepo: createFakeRestaurantRepository(data), jwtSecret: JWT_SECRET,
  }));
  return app;
}

describe("GET /api/search", () => {
  it("requires auth", async () => {
    expect((await request(buildApp()).get("/api/search?q=biryani")).status).toBe(401);
  });

  it("groups matches into restaurants and dishes; dish hits carry their restaurant", async () => {
    const adda = makeRestaurant({ name: "Biryani Adda" });
    const karahi = makeRestaurant({ name: "Karahi Khaas" });
    const dish = makeMenuItem(karahi.id, { name: "Chicken Biryani", priceCents: 42000 });
    const res = await request(buildApp([
      { profile: adda }, { profile: karahi, menuItems: [dish] },
    ])).get("/api/search?q=biryani").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.restaurants.map((r: { id: string }) => r.id)).toEqual([adda.id]);
    expect(res.body.restaurants[0]).toHaveProperty("isOpenNow");
    expect(res.body.dishes).toEqual([{
      id: dish.id, name: "Chicken Biryani", priceCents: 42000, imageUrl: null,
      isAvailable: true, restaurantId: karahi.id, restaurantName: "Karahi Khaas",
    }]);
  });

  it("returns empty groups for queries shorter than 2 chars", async () => {
    const res = await request(buildApp([{ profile: makeRestaurant() }]))
      .get("/api/search?q=%20b%20").set(auth); // " b " trims to 1 char
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ restaurants: [], dishes: [] });
  });

  it("returns empty groups when nothing matches", async () => {
    const res = await request(buildApp([{ profile: makeRestaurant({ name: "Karahi Khaas" }) }]))
      .get("/api/search?q=sushi").set(auth);
    expect(res.body).toEqual({ restaurants: [], dishes: [] });
  });
});
