/**
 * @routes inventory/index.js
 * @description Master router — mounts all sub-routes with auth middleware.
 */

import express from "express";
import { protect, authorize } from "../utils/authMiddleware.js";
import { ROLES } from "../constants/enums.js";

// ── Controllers ───────────────────────────────────────────────────
import * as categoryCtrl from "../controllers/categoryController.js";
import * as itemCtrl from "../controllers/inventoryItemController.js";
import * as vendorCtrl from "../controllers/vendorController.js";
import * as invoiceCtrl from "../controllers/purchaseInvoiceController.js";
import * as paymentCtrl from "../controllers/paymentController.js";
import * as stockCtrl from "../controllers/stockController.js";
import * as adjustmentCtrl from "../controllers/stockAdjustmentController.js";
import * as ledgerCtrl from "../controllers/ledgerController.js";
import * as journalCtrl from "../controllers/journalController.js";
import * as creditNoteCtrl from "../controllers/creditNoteController.js";
import * as auditCtrl from "../controllers/auditController.js";
import * as dashboardCtrl from "../controllers/dashboardController.js";

const router = express.Router();

const ADMIN_ONLY = [ROLES.ADMIN];
const MANAGER_ADMIN = [ROLES.ADMIN, ROLES.MANAGER];

// Apply JWT protection to all routes
router.use(protect);

// ── Dashboard ─────────────────────────────────────────────────────
router.get("/dashboard", authorize(...MANAGER_ADMIN), dashboardCtrl.getDashboard);

// ── Categories ────────────────────────────────────────────────────
router.get("/categories", authorize(...MANAGER_ADMIN), categoryCtrl.listCategories);
router.post("/categories", authorize(...MANAGER_ADMIN), categoryCtrl.createCategory);
router.put("/categories/:id", authorize(...MANAGER_ADMIN), categoryCtrl.updateCategory);
router.patch(
  "/categories/:id/toggle",
  authorize(...MANAGER_ADMIN),
  categoryCtrl.toggleCategory,
);

// ── Inventory Items ───────────────────────────────────────────────
router.get("/items", authorize(...MANAGER_ADMIN), itemCtrl.listItems);
router.get("/items/:id", authorize(...MANAGER_ADMIN), itemCtrl.getItem);
router.post("/items", authorize(...MANAGER_ADMIN), itemCtrl.createItem);
router.put("/items/:id", authorize(...MANAGER_ADMIN), itemCtrl.updateItem);
router.patch("/items/:id/toggle", authorize(...MANAGER_ADMIN), itemCtrl.toggleItem);
router.get(
  "/items/:id/stock-history",
  authorize(...MANAGER_ADMIN),
  itemCtrl.getStockHistory,
);

// ── Vendors ───────────────────────────────────────────────────────
router.get("/vendors", authorize(...MANAGER_ADMIN), vendorCtrl.listVendors);
router.get("/vendors/:id", authorize(...MANAGER_ADMIN), vendorCtrl.getVendor);
router.post("/vendors", authorize(...MANAGER_ADMIN), vendorCtrl.createVendor);
router.put("/vendors/:id", authorize(...MANAGER_ADMIN), vendorCtrl.updateVendor);
router.patch(
  "/vendors/:id/toggle",
  authorize(...MANAGER_ADMIN),
  vendorCtrl.toggleVendor,
);
router.get(
  "/vendors/:id/ledger",
  authorize(...MANAGER_ADMIN),
  vendorCtrl.getVendorLedger,
);
router.get(
  "/vendors/:vendorId/outstanding",
  authorize(...MANAGER_ADMIN),
  paymentCtrl.getVendorOutstanding,
);

// ── Purchase Invoices ─────────────────────────────────────────────
router.get("/invoices", authorize(...MANAGER_ADMIN), invoiceCtrl.listInvoices);
router.get("/invoices/:id", authorize(...MANAGER_ADMIN), invoiceCtrl.getInvoice);
router.post("/invoices", authorize(...MANAGER_ADMIN), invoiceCtrl.createInvoice);
router.put("/invoices/:id", authorize(...MANAGER_ADMIN), invoiceCtrl.updateInvoice);
router.patch(
  "/invoices/:id/approve",
  authorize(...MANAGER_ADMIN),
  invoiceCtrl.approveInvoice,
);
router.patch(
  "/invoices/:id/post",
  authorize(...MANAGER_ADMIN),
  invoiceCtrl.postInvoice,
);
router.patch(
  "/invoices/:id/cancel",
  authorize(...MANAGER_ADMIN),
  invoiceCtrl.cancelInvoice,
);

// ── Payments ──────────────────────────────────────────────────────
router.post(
  "/invoices/:invoiceId/payments",
  authorize(...MANAGER_ADMIN),
  paymentCtrl.recordPayment,
);
router.get(
  "/invoices/:invoiceId/payments",
  authorize(...MANAGER_ADMIN),
  paymentCtrl.getPaymentHistory,
);

// ── Stock ─────────────────────────────────────────────────────────
router.get("/stock/summary", authorize(...MANAGER_ADMIN), stockCtrl.getStockSummary);
router.get(
  "/stock/transactions",
  authorize(...MANAGER_ADMIN),
  stockCtrl.getTransactions,
);
router.get("/stock/expiry", authorize(...MANAGER_ADMIN), stockCtrl.getExpiryDashboard);
router.post(
  "/stock/mark-expired",
  authorize(...MANAGER_ADMIN),
  stockCtrl.markExpiredBatches,
);

// ── Stock Adjustments ─────────────────────────────────────────────
router.post(
  "/stock/adjustments",
  authorize(...MANAGER_ADMIN),
  adjustmentCtrl.createAdjustment,
);
router.get(
  "/stock/adjustments",
  authorize(...MANAGER_ADMIN),
  adjustmentCtrl.listAdjustments,
);

// ── Credit Notes ──────────────────────────────────────────────────
router.post(
  "/credit-notes",
  authorize(...MANAGER_ADMIN),
  creditNoteCtrl.createCreditNote,
);
router.get(
  "/credit-notes",
  authorize(...MANAGER_ADMIN),
  creditNoteCtrl.listCreditNotes,
);

// ── General Ledger ────────────────────────────────────────────────
router.get("/ledger/accounts", authorize(...MANAGER_ADMIN), ledgerCtrl.listAccounts);
router.post("/ledger/accounts", authorize(...MANAGER_ADMIN), ledgerCtrl.createAccount);
router.post("/ledger/accounts/seed", authorize(...MANAGER_ADMIN), ledgerCtrl.seedAccounts);
router.get(
  "/ledger/trial-balance",
  authorize(...MANAGER_ADMIN),
  ledgerCtrl.getTrialBalance,
);
router.get(
  "/ledger/accounts/:id/drilldown",
  authorize(...MANAGER_ADMIN),
  ledgerCtrl.getAccountDrilldown,
);

// ── Journal Entries ───────────────────────────────────────────────
router.get("/journal", authorize(...MANAGER_ADMIN), journalCtrl.listJournalEntries);
router.get("/journal/:id", authorize(...MANAGER_ADMIN), journalCtrl.getJournalEntry);
router.post("/journal/:id/reverse", authorize(...MANAGER_ADMIN), journalCtrl.reverseEntry);

// ── Audit Trail ───────────────────────────────────────────────────
router.get("/audit", authorize(...MANAGER_ADMIN), auditCtrl.getAuditLogs);

export default router;
