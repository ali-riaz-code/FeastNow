import type { Response, NextFunction, RequestHandler } from "express";
import type { DeliveryRepository, PartnerView } from "../repositories/deliveryRepository";
import { createRequireAuth, type AuthenticatedRequest } from "./requireAuth";
import { asyncHandler } from "./asyncHandler";

export interface PartnerRequest extends AuthenticatedRequest {
  partner?: PartnerView;
}

/** requireAuth + resolve the caller's DeliveryPartnerProfile (403 without one).
 *  Role is implicit: only delivery accounts have a partner profile. */
export function createRequirePartner(jwtSecret: string, repo: DeliveryRepository): RequestHandler[] {
  const requireAuth = createRequireAuth(jwtSecret);
  const resolve = asyncHandler(async (req: PartnerRequest, res: Response, next: NextFunction) => {
    const partner = await repo.findByUserId(req.userId!);
    if (!partner) return res.status(403).json({ error: "Not a delivery account." });
    req.partner = partner;
    next();
  });
  return [requireAuth, resolve];
}
