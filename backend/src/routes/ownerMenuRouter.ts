import { Router } from "express";
import type { MenuItem } from "@prisma/client";
import type { MenuItemInput, OwnerRepository } from "../repositories/ownerRepository";
import { createRequireOwner, type OwnerRequest } from "../middleware/requireOwner";
import { asyncHandler } from "../middleware/asyncHandler";

export interface OwnerMenuRouterDeps {
  ownerRepo: OwnerRepository;
  jwtSecret: string;
}

const MAX_NAME = 120;
const MAX_DESC = 500;
const MAX_PRICE_CENTS = 100_000_00; // Rs 100,000 — sanity ceiling

function toMenuItemDTO(m: MenuItem) {
  return {
    id: m.id, category: m.category, name: m.name, description: m.description,
    priceCents: m.priceCents, imageUrl: m.imageUrl, isAvailable: m.isAvailable, position: m.position,
  };
}

/** Validates a full create body; for PATCH, pass partial=true. Returns null on failure. */
function readItemInput(body: unknown, partial: boolean): Partial<MenuItemInput> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<MenuItemInput> = {};
  const bad = (cond: boolean) => cond;

  if (b.category !== undefined || !partial) {
    if (bad(typeof b.category !== "string" || !(b.category as string).trim())) return null;
    out.category = (b.category as string).trim();
  }
  if (b.name !== undefined || !partial) {
    if (bad(typeof b.name !== "string" || !(b.name as string).trim() || (b.name as string).length > MAX_NAME)) return null;
    out.name = (b.name as string).trim();
  }
  if (b.description !== undefined || !partial) {
    if (bad(typeof b.description !== "string" || (b.description as string).length > MAX_DESC)) return null;
    out.description = (b.description as string).trim();
  }
  if (b.priceCents !== undefined || !partial) {
    if (bad(!Number.isInteger(b.priceCents) || (b.priceCents as number) <= 0 || (b.priceCents as number) > MAX_PRICE_CENTS)) return null;
    out.priceCents = b.priceCents as number;
  }
  if (b.isAvailable !== undefined || !partial) {
    if (bad(typeof b.isAvailable !== "boolean")) return null;
    out.isAvailable = b.isAvailable as boolean;
  }
  return out;
}

export function createOwnerMenuRouter(deps: OwnerMenuRouterDeps): Router {
  const router = Router();
  const requireOwner = createRequireOwner(deps.jwtSecret, deps.ownerRepo);

  router.get("/menu", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const items = await deps.ownerRepo.listMenu(req.ownerProfile!.id);
    return res.status(200).json({ items: items.map(toMenuItemDTO) });
  }));

  router.post("/menu-items", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const input = readItemInput(req.body, false);
    if (!input) return res.status(400).json({ error: "Missing or invalid menu item details." });
    const item = await deps.ownerRepo.createMenuItem(req.ownerProfile!.id, input as MenuItemInput);
    return res.status(201).json({ item: toMenuItemDTO(item) });
  }));

  router.patch("/menu-items/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const input = readItemInput(req.body, true);
    if (!input || Object.keys(input).length === 0) {
      return res.status(400).json({ error: "Missing or invalid menu item details." });
    }
    const item = await deps.ownerRepo.updateMenuItem(req.ownerProfile!.id, req.params.id, input);
    if (!item) return res.status(404).json({ error: "Menu item not found." });
    return res.status(200).json({ item: toMenuItemDTO(item) });
  }));

  router.delete("/menu-items/:id", requireOwner, asyncHandler(async (req: OwnerRequest, res) => {
    const removed = await deps.ownerRepo.deleteMenuItem(req.ownerProfile!.id, req.params.id);
    if (!removed) return res.status(404).json({ error: "Menu item not found." });
    return res.status(204).end();
  }));

  return router;
}
