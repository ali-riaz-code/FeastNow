import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served at /app/ on the existing Vercel site (spec §5).
export default defineConfig({
  plugins: [react()],
  base: "/app/",
});
