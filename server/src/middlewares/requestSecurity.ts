// server/src/middlewares/requestSecurity.ts
import expressRateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { logger } from "../utils/logger.js";

// Read vs Write limiters
export const readLimiter = expressRateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX_READS || 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests" }
});

export const writeLimiter = expressRateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX_WRITES || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many write requests" }
});

// Helmet options — allow toggling CSP enforcement in non-production for easier demos
const _helmetOptions: any = process.env.NODE_ENV === "production"
  ? { crossOriginResourcePolicy: { policy: "cross-origin" } }
  : { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } };

export const helmetMiddleware = helmet(_helmetOptions);

// Request logger middleware using morgan -> winston; skip health checks to avoid log noise
export function requestLoggerMiddleware(app: any) {
  app.use(morgan("combined", {
    skip: (req: any) => req.url.includes("/health"),
    stream: { write: (message: string) => logger.info(message.trim()) }
  }));
}

// Backwards-compatible default export for simple wiring
export const securityMiddlewares = [
  helmetMiddleware
];
