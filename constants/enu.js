/**
 * @file enums.js
 * @description All enumeration constants for the Inventory & Accounting module.
 *              Import from this file to ensure type-safety across the entire backend.
 */

// ─────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────
const ROLES = Object.freeze({
  MD:         'MD',         // Managing Director – highest authority, cross-hotel access
  GM:         'GM',         // General Manager  – hotel-level operational & financial control
  ACCOUNTANT: 'ACCOUNTANT', // Manage invoices & payments
  FRONT_DESK: 'FRONT_DESK', // Draft-only access
});

/**
 * Hierarchy index: higher number = higher authority.
 * Used in authorize middleware to compare caller vs target role.
 */
const ROLE_HIERARCHY = Object.freeze({
  [ROLES.FRONT_DESK]: 0,
  [ROLES.ACCOUNTANT]: 1,
  [ROLES.GM]:         2,
  [ROLES.MD]:         3,
});

// ─────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────
const UNIT_TYPES = Object.freeze([
  'KG', 'G', 'L', 'ML', 'PCS', 'BOX', 'PACK', 'DOZEN', 'BOTTLE', 'CAN', 'SACHET', 'PLATE',
  'METER', 'FEET', 'INCH', 'CM', 'YARD', 'TON', 'QUINTAL', 'BAG', 'ROLL', 'PAIR', 'SET',
]);

const UNIT_CATEGORY = Object.freeze({
  MEASUREMENT: 'MEASUREMENT',
  PACKAGING:   'PACKAGING',
  COUNTING:    'COUNTING',
});

// ─────────────────────────────────────────────────────────
// INVOICE STATES
// ─────────────────────────────────────────────────────────
const INVOICE_STATE = Object.freeze({
  DRAFT:     'DRAFT',
  APPROVED:  'APPROVED',
  POSTED:    'POSTED',
  CANCELLED: 'CANCELLED',
});

/** Allowed forward transitions only. Backward transitions require reversal. */
const INVOICE_TRANSITIONS = Object.freeze({
  [INVOICE_STATE.DRAFT]:     [INVOICE_STATE.APPROVED, INVOICE_STATE.CANCELLED],
  [INVOICE_STATE.APPROVED]:  [INVOICE_STATE.POSTED,   INVOICE_STATE.CANCELLED],
  [INVOICE_STATE.POSTED]:    [],   // Immutable – use credit note / reversal
  [INVOICE_STATE.CANCELLED]: [],   // Terminal state
});

// ─────────────────────────────────────────────────────────
// PAYMENT
// ─────────────────────────────────────────────────────────
const PAYMENT_STATUS = Object.freeze({
  UNPAID:  'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID:    'PAID',
});

const PAYMENT_METHOD = Object.freeze({
  CASH:          'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE:        'CHEQUE',
  UPI:           'UPI',
  NEFT:          'NEFT',
  RTGS:          'RTGS',
});

const PAYMENT_TERMS = Object.freeze({
  IMMEDIATE: 'IMMEDIATE',
  NET_15:    'NET_15',
  NET_30:    'NET_30',
  NET_45:    'NET_45',
  NET_60:    'NET_60',
});

// ─────────────────────────────────────────────────────────
// STOCK / TRANSACTION
// ─────────────────────────────────────────────────────────
const TRANSACTION_TYPE = Object.freeze({
  IN:         'IN',
  OUT:        'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
});

const REFERENCE_TYPE = Object.freeze({
  PURCHASE:    'PURCHASE',
  ROOM_USAGE:  'ROOM_USAGE',
  WASTAGE:     'WASTAGE',
  MANUAL:      'MANUAL',
  ADJUSTMENT:  'ADJUSTMENT',
  CREDIT_NOTE: 'CREDIT_NOTE',
});

const ADJUSTMENT_REASON = Object.freeze({
  DAMAGED:       'DAMAGED',
  EXPIRED:       'EXPIRED',
  THEFT:         'THEFT',
  CORRECTION:    'CORRECTION',
  OPENING_STOCK: 'OPENING_STOCK',
  OTHER:         'OTHER',
});

// ─────────────────────────────────────────────────────────
// ACCOUNTING / LEDGER
// ─────────────────────────────────────────────────────────
const LEDGER_ACCOUNT_TYPE = Object.freeze({
  ASSET:     'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY:    'EQUITY',
  REVENUE:   'REVENUE',
  EXPENSE:   'EXPENSE',
});

const JOURNAL_ENTRY_TYPE = Object.freeze({
  DEBIT:  'DEBIT',
  CREDIT: 'CREDIT',
});

const JOURNAL_REFERENCE_TYPE = Object.freeze({
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SALES_INVOICE:    'SALES_INVOICE',
  PAYMENT:          'PAYMENT',
  SALES_PAYMENT:    'SALES_PAYMENT',
  CREDIT_NOTE:      'CREDIT_NOTE',
  SALES_CREDIT_NOTE:'SALES_CREDIT_NOTE',
  ADJUSTMENT:       'ADJUSTMENT',
  REVERSAL:         'REVERSAL',
  OPENING_BALANCE:  'OPENING_BALANCE',
});

// ─────────────────────────────────────────────────────────
// TAX
// ─────────────────────────────────────────────────────────
const TAX_TYPE = Object.freeze({
  CGST: 'CGST',
  SGST: 'SGST',
  IGST: 'IGST',
  NONE: 'NONE',
});

/** Standard GST slab rates (%) */
const GST_RATES = Object.freeze([0, 5, 12, 18, 28]);

// ─────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────
const AUDIT_ENTITY_TYPE = Object.freeze({
  PURCHASE_INVOICE:  'PURCHASE_INVOICE',
  SALES_INVOICE:     'SALES_INVOICE',
  PAYMENT:           'PAYMENT',
  SALES_PAYMENT:     'SALES_PAYMENT',
  CREDIT_NOTE:       'CREDIT_NOTE',
  SALES_CREDIT_NOTE: 'SALES_CREDIT_NOTE',
  STOCK_TRANSACTION: 'STOCK_TRANSACTION',
  STOCK_ADJUSTMENT:  'STOCK_ADJUSTMENT',
  JOURNAL_ENTRY:     'JOURNAL_ENTRY',
  VENDOR:            'VENDOR',
  CUSTOMER:          'CUSTOMER',
  INVENTORY_ITEM:    'INVENTORY_ITEM',
  INVENTORY_BATCH:   'INVENTORY_BATCH',
  LEDGER_ACCOUNT:    'LEDGER_ACCOUNT',
  UNIT:              'UNIT',
  USER:              'USER',
});

const AUDIT_ACTION = Object.freeze({
  CREATED:          'CREATED',
  UPDATED:          'UPDATED',
  APPROVED:         'APPROVED',
  POSTED:           'POSTED',
  CANCELLED:        'CANCELLED',
  REVERSED:         'REVERSED',
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  ACTIVATED:        'ACTIVATED',
  DEACTIVATED:      'DEACTIVATED',
  STOCK_IN:         'STOCK_IN',
  STOCK_OUT:        'STOCK_OUT',
  ADJUSTED:         'ADJUSTED',
  BATCH_CREATED:    'BATCH_CREATED',
  BATCH_CONSUMED:   'BATCH_CONSUMED',
});

// ─────────────────────────────────────────────────────────
// DEFAULT LEDGER ACCOUNT CODES
// Used in invoicePostingService to resolve accounts by code
// ─────────────────────────────────────────────────────────
const DEFAULT_LEDGER_CODES = Object.freeze({
  INVENTORY_ASSET:      '1100', // Inventory / Stock Account
  ACCOUNTS_RECEIVABLE:  '1300', // Accounts Receivable – Customers
  GST_INPUT_CGST:       '1210', // Input Tax Credit – CGST
  GST_INPUT_SGST:       '1220', // Input Tax Credit – SGST
  GST_INPUT_IGST:       '1230', // Input Tax Credit – IGST
  ACCOUNTS_PAYABLE:     '2100', // Accounts Payable – Vendors
  GST_OUTPUT_CGST:      '2110', // Output GST – CGST
  GST_OUTPUT_SGST:      '2120', // Output GST – SGST
  GST_OUTPUT_IGST:      '2130', // Output GST – IGST
  ADVANCE_FROM_GUESTS:  '2300', // Customer Advances (overpayment)
  ROOM_REVENUE:         '4100', // Room Revenue
  FB_REVENUE:           '4200', // F&B Revenue
  OTHER_REVENUE:        '4300', // Other Revenue
  COGS:                 '5100', // Cost of Goods Sold
  CASH:                 '1010', // Cash in Hand
  BANK:                 '1020', // Bank Account
});

// ─────────────────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────────────────
const CUSTOMER_TYPE = Object.freeze({
  WALK_IN:    'WALK_IN',
  CORPORATE:  'CORPORATE',
  TRAVEL_AGENT: 'TRAVEL_AGENT',
  ONLINE:     'ONLINE',
  EMPLOYEE:   'EMPLOYEE',
});

// ─────────────────────────────────────────────────────────
// SALES INVOICE
// ─────────────────────────────────────────────────────────
const SALES_INVOICE_STATE = Object.freeze({
  DRAFT:     'DRAFT',
  APPROVED:  'APPROVED',
  POSTED:    'POSTED',
  CANCELLED: 'CANCELLED',
});

const SALES_INVOICE_TRANSITIONS = Object.freeze({
  [SALES_INVOICE_STATE.DRAFT]:     [SALES_INVOICE_STATE.APPROVED, SALES_INVOICE_STATE.CANCELLED],
  [SALES_INVOICE_STATE.APPROVED]:  [SALES_INVOICE_STATE.POSTED,   SALES_INVOICE_STATE.CANCELLED],
  [SALES_INVOICE_STATE.POSTED]:    [],
  [SALES_INVOICE_STATE.CANCELLED]: [],
});

const SALES_CATEGORY = Object.freeze({
  ROOM:      'ROOM',
  FNB:       'FNB',
  MINIBAR:   'MINIBAR',
  LAUNDRY:   'LAUNDRY',
  SPA:       'SPA',
  BANQUET:   'BANQUET',
  OTHER:     'OTHER',
});

const SALES_PAYMENT_STATUS = Object.freeze({
  UNPAID:  'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID:    'PAID',
  ADVANCE: 'ADVANCE',
});

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  UNIT_TYPES,
  UNIT_CATEGORY,
  INVOICE_STATE,
  INVOICE_TRANSITIONS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  PAYMENT_TERMS,
  TRANSACTION_TYPE,
  REFERENCE_TYPE,
  ADJUSTMENT_REASON,
  LEDGER_ACCOUNT_TYPE,
  JOURNAL_ENTRY_TYPE,
  JOURNAL_REFERENCE_TYPE,
  TAX_TYPE,
  GST_RATES,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
  DEFAULT_LEDGER_CODES,
  CUSTOMER_TYPE,
  SALES_INVOICE_STATE,
  SALES_INVOICE_TRANSITIONS,
  SALES_CATEGORY,
  SALES_PAYMENT_STATUS,
};