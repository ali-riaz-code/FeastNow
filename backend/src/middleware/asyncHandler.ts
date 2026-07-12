import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async Express route handler so a rejected promise is forwarded to
 * `next(err)` instead of escaping unhandled. Express 4 does not catch
 * rejections from async handlers on its own, so without this wrapper a real
 * failure (SMTP error, DB error, etc.) can crash the process.
 */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
