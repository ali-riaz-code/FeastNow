import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function createRequireAuth(jwtSecret: string) {
  return function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    try {
      const payload = verifyToken(token, jwtSecret);
      req.userId = payload.userId;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
  };
}
