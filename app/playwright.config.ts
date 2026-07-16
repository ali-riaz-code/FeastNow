import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 }, // phone frame
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/app/",
    reuseExistingServer: true,
  },
});
