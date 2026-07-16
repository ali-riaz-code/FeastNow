import { test, expect } from "@playwright/test";

const API = process.env.API_BASE_URL ?? "http://localhost:3000";
const EMAIL = "smoke.customer@feastnow.demo";
const PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

test("browse smoke: feed → detail → search", async ({ page, request }) => {
  expect(PASSWORD, "Set TEST_USER_PASSWORD").not.toBe("");

  // Login via API (UI login flow was verified in the auth phase).
  const login = await request.post(`${API}/api/auth/login`, {
    data: { identifier: EMAIL, password: PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { token } = await login.json() as { token: string };
  await page.addInitScript((t: string) => localStorage.setItem("feastnow_token", t), token);

  // Home feed renders sections with cards.
  await page.goto("/app/");
  await expect(page.getByRole("heading", { name: "Most Popular Near You" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Top Rated" })).toBeVisible();
  await expect(page.locator(".restaurant-card").first()).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/home.png", fullPage: true });

  // Restaurant detail: menu categories + reviews.
  await page.locator(".restaurant-card").first().click();
  await expect(page.locator(".menu-category").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".menu-row__price").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/restaurant.png", fullPage: true });

  // Search: grouped results, dish carries restaurant.
  await page.goto("/app/search");
  await page.getByLabel("Search restaurants, cuisines, dishes").fill("biryani");
  await expect(page.getByRole("heading", { name: "Dishes" })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "tests/screenshots/search.png", fullPage: true });
  await page.locator(".dish-hit").first().click();
  await expect(page.locator(".menu-category").first()).toBeVisible();
});
