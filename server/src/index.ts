import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/replace.js";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Set port
const PORT = process.env.SERVER_PORT || 3001;

// Routes
app.use("/api", routes);
app.get("/health", (req, res) => res.json({ ok: true, message: "Server healthy" }));

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
