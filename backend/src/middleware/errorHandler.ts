import type { NextFunction, Request, Response } from "express";

/**
 * Terminal error-handling middleware. Must be registered last (after all
 * routers) and must keep the 4-arg signature so Express recognizes it as an
 * error handler rather than a normal middleware.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
}
