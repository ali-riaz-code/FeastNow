# Phase 1 latency verification (NFR-1)

**Date:** 2026-07-16 · **Data:** 20 seeded demo restaurants (~220 menu items, ~110 ratings)
**Method:** backend/scripts/measureLatency.ts — 5 timed runs per endpoint after 1 warm-up, median/max recorded.

| Endpoint | Local median | Local max | Render median | Render max |
|---|---|---|---|---|
| GET /api/customer/home | 210ms | 225ms | 793ms | 879ms |
| GET /api/restaurants?page=1 | 94ms | 205ms | 558ms | 889ms |
| GET /api/restaurants?search=karahi | 88ms | 165ms | 549ms | 561ms |
| GET /api/search?q=biryani | 165ms | 364ms | 785ms | 1293ms |

**Verdict:** NFR-1 (~2s search budget) **PASS** at seed scale. Every median and every max on both local (Supabase-backed dev server) and production (Render free tier) is comfortably under the 2000ms budget — the worst single observation across all 40 timed requests was 1293ms (Render, `/api/search?q=biryani` max).

**Local vs. Render analysis:** Render medians run roughly 4-9x local medians (e.g. `/api/customer/home`: 210ms → 793ms), but the *ratio* is broadly consistent across all four endpoints rather than concentrated on one — this is the signature of fixed network/infra overhead (cross-region TLS handshake + Render free-tier compute, both hitting the same Supabase Postgres instance from different network paths) rather than a query-specific problem. No endpoint disproportionately spiked, no evidence of a missing index or N+1 query was observed at seed scale. If Render latency grows non-uniformly as data scales, that would be the signal to look at query plans; at seed scale it does not warrant one.

**Caveat (spec §9):** verified only at seed scale — re-benchmark as data grows.
