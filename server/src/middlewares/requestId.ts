import { type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = reqId;
  // Expose request id to clients
  try {
    res.setHeader('X-Request-Id', reqId);
  } catch (e) {
    // ignore header set errors
  }
  next();
};

export default requestIdMiddleware;
