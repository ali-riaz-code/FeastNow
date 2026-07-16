import "dotenv/config";

// Usage (from backend/):
//   $env:TOKEN = "<jwt>"; $env:BASE = "https://feastnow.onrender.com"; npx tsx scripts/measureLatency.ts
async function main() {
  const BASE = process.env.BASE ?? "http://localhost:3000";
  const TOKEN = process.env.TOKEN;
  if (!TOKEN) throw new Error("Set TOKEN to a valid JWT (login via /api/auth/login).");

  const TARGETS = [
    "/api/customer/home",
    "/api/restaurants?page=1",
    "/api/restaurants?search=karahi",
    "/api/search?q=biryani",
  ];
  const RUNS = 5;

  async function timeOnce(path: string): Promise<number> {
    const start = performance.now();
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    await res.text();
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return performance.now() - start;
  }

  for (const path of TARGETS) {
    await timeOnce(path); // warm-up (Render cold start / connection setup)
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) times.push(await timeOnce(path));
    times.sort((a, b) => a - b);
    const median = times[Math.floor(RUNS / 2)].toFixed(0);
    const max = times[RUNS - 1].toFixed(0);
    console.log(`${path}  median ${median}ms  max ${max}ms  (${RUNS} runs after warm-up)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
