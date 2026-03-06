/**
 * @routes inventory/index.js
 * @description Master router — mounts all sub-routes with auth middleware.
 */
'use strict';

const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../constants/enums');

const GM_MD      = [ROLES.GM, ROLES.MD];
const MD         = [ROLES.MD];
const ACCT_UP    = [ROLES.ACCOUNTANT, ROLES.GM, ROLES.MD]; // Accountant and above
const ALL_ROLES  = [ROLES.FRONT_DESK, ROLES.ACCOUNTANT, ROLES.GM, ROLES.MD];

// ── Controllers ───────────────────────────────────────────────────
const categoryCtrl      = require('../controllers/categoryController');
const itemCtrl          = require('../controllers/inventoryItemController');
const vendorCtrl        = require('../controllers/vendorController');
const invoiceCtrl       = require('../controllers/purchaseInvoiceController');
const paymentCtrl       = require('../controllers/paymentController');
const stockCtrl         = require('../controllers/stockController');
const adjustmentCtrl    = require('../controllers/stockAdjustmentController');
const ledgerCtrl        = require('../controllers/ledgerController');
const journalCtrl       = require('../controllers/journalController');
const creditNoteCtrl    = require('../controllers/creditNoteController');
const auditCtrl         = require('../controllers/auditController');
const dashboardCtrl     = require('../controllers/dashboardController');
const customerCtrl      = require('../controllers/customerController');
const salesInvoiceCtrl  = require('../controllers/salesInvoiceController');
const salesPaymentCtrl  = require('../controllers/salesPaymentController');
const salesCreditCtrl   = require('../controllers/salesCreditNoteController');
const salesReportCtrl   = require('../controllers/salesReportController');
const unitCtrl          = require('../controllers/unitController');

// Apply JWT protection to all routes
router.use(protect);

// ── Dashboard ─────────────────────────────────────────────────────
router.get('/dashboard', authorize(...GM_MD), dashboardCtrl.getDashboard);

// ── Categories ────────────────────────────────────────────────────
router.get   ('/categories',       authorize(...GM_MD), categoryCtrl.listCategories);
router.post  ('/categories',       authorize(...GM_MD), categoryCtrl.createCategory);
router.put   ('/categories/:id',   authorize(...GM_MD), categoryCtrl.updateCategory);
router.patch ('/categories/:id/toggle', authorize(...GM_MD), categoryCtrl.toggleCategory);

// ── Inventory Items ───────────────────────────────────────────────
router.get   ('/items',              authorize(...GM_MD), itemCtrl.listItems);
router.get   ('/items/:id',          authorize(...GM_MD), itemCtrl.getItem);
router.post  ('/items',              authorize(...GM_MD), itemCtrl.createItem);
router.put   ('/items/:id',          authorize(...GM_MD), itemCtrl.updateItem);
router.patch ('/items/:id/toggle',   authorize(...GM_MD), itemCtrl.toggleItem);
router.get   ('/items/:id/stock-history', authorize(...GM_MD), itemCtrl.getStockHistory);

// ── Vendors ───────────────────────────────────────────────────────
router.get   ('/vendors',              authorize(...GM_MD), vendorCtrl.listVendors);
router.get   ('/vendors/:id',          authorize(...GM_MD), vendorCtrl.getVendor);
router.post  ('/vendors',              authorize(...GM_MD), vendorCtrl.createVendor);
router.put   ('/vendors/:id',          authorize(...GM_MD), vendorCtrl.updateVendor);
router.patch ('/vendors/:id/toggle',   authorize(...GM_MD), vendorCtrl.toggleVendor);
router.get   ('/vendors/:id/ledger',   authorize(...GM_MD), vendorCtrl.getVendorLedger);
router.get   ('/vendors/:vendorId/outstanding', authorize(...GM_MD), paymentCtrl.getVendorOutstanding);

// ── Purchase Invoices ─────────────────────────────────────────────
router.get   ('/invoices',             authorize(...GM_MD), invoiceCtrl.listInvoices);
router.get   ('/invoices/:id',         authorize(...GM_MD), invoiceCtrl.getInvoice);
router.post  ('/invoices',             authorize(...GM_MD), invoiceCtrl.createInvoice);
router.put   ('/invoices/:id',         authorize(...GM_MD), invoiceCtrl.updateInvoice);   // DRAFT only
router.patch ('/invoices/:id/approve', authorize(...GM_MD), invoiceCtrl.approveInvoice);
router.patch ('/invoices/:id/post',    authorize(...GM_MD), invoiceCtrl.postInvoice);
router.patch ('/invoices/:id/cancel',  authorize(...GM_MD), invoiceCtrl.cancelInvoice);

// ── Payments ──────────────────────────────────────────────────────
router.post  ('/invoices/:invoiceId/payments', authorize(...GM_MD), paymentCtrl.recordPayment);
router.get   ('/invoices/:invoiceId/payments', authorize(...GM_MD), paymentCtrl.getPaymentHistory);

// ── Stock ─────────────────────────────────────────────────────────
router.get   ('/stock/summary',   authorize(...GM_MD), stockCtrl.getStockSummary);
router.get   ('/stock/transactions', authorize(...GM_MD), stockCtrl.getTransactions);
router.get   ('/stock/expiry',    authorize(...GM_MD), stockCtrl.getExpiryDashboard);
router.post  ('/stock/mark-expired', authorize(...MD),  stockCtrl.markExpiredBatches); // MD-only cron trigger

// ── Stock Adjustments ─────────────────────────────────────────────
router.post  ('/stock/adjustments', authorize(...GM_MD), adjustmentCtrl.createAdjustment);
router.get   ('/stock/adjustments', authorize(...GM_MD), adjustmentCtrl.listAdjustments);

// ── Credit Notes ──────────────────────────────────────────────────
router.post  ('/credit-notes',    authorize(...GM_MD), creditNoteCtrl.createCreditNote);
router.get   ('/credit-notes',    authorize(...GM_MD), creditNoteCtrl.listCreditNotes);

// ── General Ledger ────────────────────────────────────────────────
router.get   ('/ledger/accounts',          authorize(...GM_MD), ledgerCtrl.listAccounts);
router.post  ('/ledger/accounts',          authorize(...MD),    ledgerCtrl.createAccount);
router.post  ('/ledger/accounts/seed',     authorize(...MD),    ledgerCtrl.seedAccounts);
router.get   ('/ledger/trial-balance',     authorize(...GM_MD), ledgerCtrl.getTrialBalance);
router.get   ('/ledger/accounts/:id/drilldown', authorize(...GM_MD), ledgerCtrl.getAccountDrilldown);

// ── Journal Entries ───────────────────────────────────────────────
router.get   ('/journal',         authorize(...GM_MD), journalCtrl.listJournalEntries);
router.get   ('/journal/:id',     authorize(...GM_MD), journalCtrl.getJournalEntry);
router.post  ('/journal/:id/reverse', authorize(...MD), journalCtrl.reverseEntry); // MD only

// ── Audit Trail ───────────────────────────────────────────────────
router.get   ('/audit',           authorize(...GM_MD), auditCtrl.getAuditLogs);

// ══════════════════════════════════════════════════════════════════
// SALES & RECEIVABLES MODULE
// ══════════════════════════════════════════════════════════════════

// ── Customers ─────────────────────────────────────────────────────
router.get   ('/customers',              authorize(...ALL_ROLES),  customerCtrl.listCustomers);
router.get   ('/customers/:id',          authorize(...ALL_ROLES),  customerCtrl.getCustomer);
router.post  ('/customers',              authorize(...ACCT_UP),    customerCtrl.createCustomer);
router.put   ('/customers/:id',          authorize(...ACCT_UP),    customerCtrl.updateCustomer);
router.patch ('/customers/:id/toggle',   authorize(...GM_MD),      customerCtrl.toggleCustomer);

// ── Sales Invoices ────────────────────────────────────────────────
router.get   ('/sales/invoices',             authorize(...ALL_ROLES),  salesInvoiceCtrl.listInvoices);
router.get   ('/sales/invoices/:id',         authorize(...ALL_ROLES),  salesInvoiceCtrl.getInvoice);
router.post  ('/sales/invoices',             authorize(...ALL_ROLES),  salesInvoiceCtrl.createInvoice);  // Front desk can draft
router.put   ('/sales/invoices/:id',         authorize(...ACCT_UP),    salesInvoiceCtrl.updateInvoice);  // DRAFT only
router.patch ('/sales/invoices/:id/approve', authorize(...ACCT_UP),    salesInvoiceCtrl.approveInvoice);
router.patch ('/sales/invoices/:id/post',    authorize(...GM_MD),      salesInvoiceCtrl.postInvoice);
router.patch ('/sales/invoices/:id/cancel',  authorize(...ACCT_UP),    salesInvoiceCtrl.cancelInvoice);

// ── Sales Payments ────────────────────────────────────────────────
router.post  ('/sales/invoices/:invoiceId/payments', authorize(...ACCT_UP),  salesPaymentCtrl.recordPayment);
router.get   ('/sales/invoices/:invoiceId/payments', authorize(...ALL_ROLES),salesPaymentCtrl.getPaymentHistory);
router.get   ('/customers/:customerId/outstanding',  authorize(...ALL_ROLES),salesPaymentCtrl.getCustomerOutstanding);

// ── Sales Credit Notes ────────────────────────────────────────────
router.post  ('/sales/credit-notes',    authorize(...ACCT_UP), salesCreditCtrl.createSalesCreditNote);
router.get   ('/sales/credit-notes',    authorize(...ALL_ROLES), salesCreditCtrl.listSalesCreditNotes);

// ── Sales Reports ─────────────────────────────────────────────────
router.get   ('/sales/reports/summary',          authorize(...ACCT_UP), salesReportCtrl.getSalesSummary);
router.get   ('/sales/reports/gst',              authorize(...ACCT_UP), salesReportCtrl.getGSTReport);
router.get   ('/sales/reports/receivable-aging',  authorize(...ACCT_UP), salesReportCtrl.getReceivableAging);
router.get   ('/sales/reports/daily-collection',  authorize(...ACCT_UP), salesReportCtrl.getDailyCollection);
router.get   ('/customers/:customerId/ledger',    authorize(...ALL_ROLES), salesReportCtrl.getCustomerLedger);

// ══════════════════════════════════════════════════════════════════
// UNIT MASTER
// ══════════════════════════════════════════════════════════════════
router.get   ('/units',                authorize(...ALL_ROLES), unitCtrl.listUnits);
router.get   ('/units/:id',            authorize(...ALL_ROLES), unitCtrl.getUnit);
router.post  ('/units',                authorize(...GM_MD),     unitCtrl.createUnit);
router.put   ('/units/:id',            authorize(...GM_MD),     unitCtrl.updateUnit);
router.patch ('/units/:id/toggle',     authorize(...GM_MD),     unitCtrl.toggleUnit);
router.post  ('/units/convert',        authorize(...ALL_ROLES), unitCtrl.previewConversion);
router.get   ('/units/:id/related',    authorize(...ALL_ROLES), unitCtrl.getRelatedUnits);

module.exports = router;