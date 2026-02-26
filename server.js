import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

import routes from "./routes/index.js";
import { errorHandler } from "./utils/errorHandler.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1", routes);

// Health check (recommended even for inventory)
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    message: "Inventory API running ✅",
    time: new Date().toISOString(),
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI_PRODUCTION)
  .then(() => {
    console.log("✅ MongoDB Connected");

    app.listen(PORT, () => {
      console.log(`🚀 Inventory server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Mongo connection failed:", err.message);
  });