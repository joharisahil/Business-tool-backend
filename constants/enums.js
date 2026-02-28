/**
 * @file enums.js
 * @description All enumeration constants for the Inventory & Accounting module.
 */

// ─────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
});

export const ROLE_HIERARCHY = Object.freeze({
  [ROLES.STAFF]: 1,
  [ROLES.MANAGER]: 2,
  [ROLES.ADMIN]: 3,
});
// export const ROLES = Object.freeze({
//   MD: "MD",
//   GM: "GM",
// });

// export const ROLE_HIERARCHY = Object.freeze({
//   [ROLES.GM]: 1,
//   [ROLES.MD]: 2,
// });

// ─────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────
export const UNIT_TYPES = Object.freeze([
  "KG",
  "G",
  "L",
  "ML",
  "PCS",
  "BOX",
  "PACK",
  "DOZEN",
  "BOTTLE",
  "CAN",
  "SACHET",
  "PLATE",
]);

// ─────────────────────────────────────────────────────────
// INVOICE STATES
// ─────────────────────────────────────────────────────────
export const INVOICE_STATE = Object.freeze({
  DRAFT: "DRAFT",
  APPROVED: "APPROVED",
  POSTED: "POSTED",
  CANCELLED: "CANCELLED",
});

export const INVOICE_TRANSITIONS = Object.freeze({
  [INVOICE_STATE.DRAFT]: [INVOICE_STATE.APPROVED, INVOICE_STATE.CANCELLED],
  [INVOICE_STATE.APPROVED]: [INVOICE_STATE.POSTED, INVOICE_STATE.CANCELLED],
  [INVOICE_STATE.POSTED]: [],
  [INVOICE_STATE.CANCELLED]: [],
});

// ─────────────────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────────────────
export const PAYMENT_STATUS = Object.freeze({
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
});

export const PAYMENT_METHOD = Object.freeze({
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  CHEQUE: "CHEQUE",
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
});

export const PAYMENT_TERMS = Object.freeze({
  IMMEDIATE: "IMMEDIATE",
  NET_15: "NET_15",
  NET_30: "NET_30",
  NET_45: "NET_45",
  NET_60: "NET_60",
});

// ─────────────────────────────────────────────────────────
// STOCK / TRANSACTION
// ─────────────────────────────────────────────────────────
export const TRANSACTION_TYPE = Object.freeze({
  IN: "IN",
  OUT: "OUT",
  ADJUSTMENT: "ADJUSTMENT",
});

export const REFERENCE_TYPE = Object.freeze({
  PURCHASE: "PURCHASE",
  ROOM_USAGE: "ROOM_USAGE",
  WASTAGE: "WASTAGE",
  MANUAL: "MANUAL",
  ADJUSTMENT: "ADJUSTMENT",
  CREDIT_NOTE: "CREDIT_NOTE",
  SALES: "SALES",
  SALES_CREDIT_NOTE: "SALES_CREDIT_NOTE",
});

export const ADJUSTMENT_REASON = Object.freeze({
  DAMAGED: "DAMAGED",
  EXPIRED: "EXPIRED",
  THEFT: "THEFT",
  CORRECTION: "CORRECTION",
  OPENING_STOCK: "OPENING_STOCK",
  OTHER: "OTHER",
});

// ─────────────────────────────────────────────────────────
// ACCOUNTING / LEDGER
// ─────────────────────────────────────────────────────────
export const LEDGER_ACCOUNT_TYPE = Object.freeze({
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  REVENUE: "REVENUE",
  EXPENSE: "EXPENSE",
});

export const JOURNAL_ENTRY_TYPE = Object.freeze({
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
});

export const JOURNAL_REFERENCE_TYPE = Object.freeze({
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  PAYMENT: "PAYMENT",
  CREDIT_NOTE: "CREDIT_NOTE",
  ADJUSTMENT: "ADJUSTMENT",
  REVERSAL: "REVERSAL",
  OPENING_BALANCE: "OPENING_BALANCE",
  SALES_INVOICE: "SALES_INVOICE",
  SALES_CREDIT_NOTE: "SALES_CREDIT_NOTE",
});

// ─────────────────────────────────────────────────────────
// TAX
// ─────────────────────────────────────────────────────────
export const TAX_TYPE = Object.freeze({
  CGST: "CGST",
  SGST: "SGST",
  IGST: "IGST",
  NONE: "NONE",
});

export const GST_RATES = Object.freeze([0, 5, 12, 18, 28]);

// ─────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────
export const AUDIT_ENTITY_TYPE = Object.freeze({
  PURCHASE_INVOICE: "PURCHASE_INVOICE",
  PAYMENT: "PAYMENT",
  CREDIT_NOTE: "CREDIT_NOTE",
  STOCK_TRANSACTION: "STOCK_TRANSACTION",
  STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT",
  JOURNAL_ENTRY: "JOURNAL_ENTRY",
  VENDOR: "VENDOR",
  INVENTORY_ITEM: "INVENTORY_ITEM",
  INVENTORY_BATCH: "INVENTORY_BATCH",
  LEDGER_ACCOUNT: "LEDGER_ACCOUNT",
  USER: "USER",
  SALES_INVOICE: "SALES_INVOICE",
  SALES_CREDIT_NOTE: "SALES_CREDIT_NOTE",
});

export const AUDIT_ACTION = Object.freeze({
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  APPROVED: "APPROVED",
  POSTED: "POSTED",
  CANCELLED: "CANCELLED",
  REVERSED: "REVERSED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  ACTIVATED: "ACTIVATED",
  DEACTIVATED: "DEACTIVATED",
  STOCK_IN: "STOCK_IN",
  STOCK_OUT: "STOCK_OUT",
  ADJUSTED: "ADJUSTED",
  BATCH_CREATED: "BATCH_CREATED",
  BATCH_CONSUMED: "BATCH_CONSUMED",
});

// ─────────────────────────────────────────────────────────
// DEFAULT LEDGER ACCOUNT CODES
// ─────────────────────────────────────────────────────────
export const DEFAULT_LEDGER_CODES = Object.freeze({
  INVENTORY_ASSET: "1100",

  GST_INPUT_CGST: "1210",
  GST_INPUT_SGST: "1220",
  GST_INPUT_IGST: "1230",

  ACCOUNTS_PAYABLE: "2100",
  ACCOUNTS_RECEIVABLE: "1300",

  CASH: "1010",
  BANK: "1020",

  // 🔥 SALES SYSTEM
  SALES_REVENUE: "4100",
  SALES_RETURN: "4200",

  GST_OUTPUT_CGST: "2110",
  GST_OUTPUT_SGST: "2120",
  GST_OUTPUT_IGST: "2130",

  COGS_EXPENSE: "5100",
});
