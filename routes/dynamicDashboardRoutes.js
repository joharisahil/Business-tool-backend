import express from "express";
import {
  getDashboardSummary,
  getDashboardSales,
  getDashboardPayments,
  getCustomerDashboard,
  getDashboardInsights,
} from "../controllers/dyanamicDashboardController.js";
import { protect, authorize } from "../utils/authMiddleware.js";
import { ROLES } from "../constants/enums.js";

const router = express.Router();

// Roles allowed
const ALLOWED_ROLES = [ROLES.ADMIN, ROLES.MANAGER];

// ─────────────────────────────────────────────
// Apply Auth to All Routes
// ─────────────────────────────────────────────
router.use(protect);

// ─────────────────────────────────────────────
// 📊 DASHBOARD SUMMARY (KPI Cards)
// ─────────────────────────────────────────────
router.get(
  "/summary",
  authorize(...ALLOWED_ROLES),
  getDashboardSummary
);

// ─────────────────────────────────────────────
// 📋 SALES (Paginated + Filters)
// ─────────────────────────────────────────────
router.get(
  "/sales",
  authorize(...ALLOWED_ROLES),
  getDashboardSales
);

// ─────────────────────────────────────────────
// 💰 PAYMENTS (Paginated + Filters)
// ─────────────────────────────────────────────
router.get(
  "/payments",
  authorize(...ALLOWED_ROLES),
  getDashboardPayments
);

// ─────────────────────────────────────────────
// 👤 CUSTOMER DASHBOARD (Summary + Invoices)
// ─────────────────────────────────────────────
router.get(
  "/customer/:id",
  authorize(...ALLOWED_ROLES),
  getCustomerDashboard
);

// ─────────────────────────────────────────────
// 🧠 INSIGHTS (Top customer, stats, etc.)
// ─────────────────────────────────────────────
router.get(
  "/insights",
  authorize(...ALLOWED_ROLES),
  getDashboardInsights
);

export default router;