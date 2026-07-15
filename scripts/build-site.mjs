// Assembles the deployed site: landing/* at the root + the SPA under /app/.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";

execSync("npm ci", { cwd: "app", stdio: "inherit" });
execSync("npm run build", { cwd: "app", stdio: "inherit" });

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
cpSync("landing", "dist", { recursive: true });
cpSync("app/dist", "dist/app", { recursive: true });
console.log("Site assembled in dist/");
