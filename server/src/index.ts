import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/replace.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Set port
const PORT = process.env.SERVER_PORT || 3001;

// Routes
app.use("/api", routes);
app.get("/health", (req, res) => res.json({ ok: true, message: "Server healthy" }));

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
