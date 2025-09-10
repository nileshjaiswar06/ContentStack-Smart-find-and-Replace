import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/replace.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestLoggerMiddleware, helmetMiddleware, readLimiter, writeLimiter } from "./middlewares/requestSecurity.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// CORS configuration with allowlist
const allow = (process.env.CORS_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ 
  origin: (origin, cb) => {
    if (!origin || allow.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware
requestLoggerMiddleware(app);
app.use(helmetMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Set port
const PORT = process.env.SERVER_PORT || 3001;

// Routes
// Apply read/write rate limiters: allow more GETs, stricter on writes
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return readLimiter(req, res, next);
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return writeLimiter(req, res, next);
  return next();
});
app.use("/api", routes);
app.get("/health", (req, res) => res.json({ ok: true, message: "Server healthy" }));

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err);
});
