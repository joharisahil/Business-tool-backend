import express from "express";

import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import inventoryModuleRoutes from "./inventoryModuleRoutes.js";
import dynamicDashboardRoutes from "./dynamicDashboardRoutes.js"

const router = express.Router();

// Core Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/inventory", inventoryModuleRoutes);
router.use("/inventory", dynamicDashboardRoutes);
export default router;