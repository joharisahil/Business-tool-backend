/**
 * @controller purchaseInvoiceController.js
 * @description Purchase invoice lifecycle:
 *              DRAFT → APPROVED → POSTED → CANCELLED
 *              Posting handled by invoicePostingService (atomic).
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

import PurchaseInvoice from "../models/PurchaseInvoice.js";
import Vendor from "../models/Vendor.js";
import InventoryItem from "../models/InventoryItem.js";
import * as invoicePosting from "../services/invoicePostingService.js";
import * as taxService from "../services/taxService.js";
import * as auditService from "../services/auditService.js";

import {
  INVOICE_STATE,
  INVOICE_TRANSITIONS,
  PAYMENT_STATUS,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";


// ─────────────────────────────────────────────────────────
// Sequential Invoice Number
// ─────────────────────────────────────────────────────────

const generateInvoiceNumber = async (organizationId) => {
  const year = new Date().getFullYear();
  const prefix = `PI-${year}-`;

  const last = await PurchaseInvoice.findOne({
    organizationId,
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  const seq = last
    ? parseInt(last.invoiceNumber.split("-").pop(), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(5, "0")}`;
};


// ─────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────

export const listInvoices = asyncHandler(async (req, res) => {
  const {
    state,
    vendor_id,
    paymentStatus,
    search,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = { organizationId: req.user.organizationId };

  // Apply filters
  if (state && state !== 'ALL') filter.invoiceState = state;
  if (vendor_id) filter.vendor_id = vendor_id;
  if (paymentStatus && paymentStatus !== 'ALL') filter.paymentStatus = paymentStatus;

  // Date range filter
  if (fromDate || toDate) {
    filter.createdAt = {};
    if (fromDate) {
      const fromDateObj = new Date(fromDate);
      fromDateObj.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = fromDateObj;
    }
    if (toDate) {
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDateObj;
    }
  }

  // Parse pagination params
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get total count for pagination
  let total = await PurchaseInvoice.countDocuments(filter);
  
  // Build query with population
  let query = PurchaseInvoice.find(filter)
    .populate("vendor_id", "name gstin email phone")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  // Execute query
  let invoices = await query.lean();

  // Apply search filter (after population for text search)
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim();
    invoices = invoices.filter(inv => 
      inv.invoiceNumber?.toLowerCase().includes(searchLower) ||
      inv.vendor_id?.name?.toLowerCase().includes(searchLower) ||
      inv.vendor_id?.gstin?.toLowerCase().includes(searchLower)
    );
    
    // Recalculate total and re-paginate after search
    total = invoices.length;
    const startIndex = skip;
    const endIndex = startIndex + limitNum;
    invoices = invoices.slice(startIndex, endIndex);
  }

  // Format response to match frontend expectations
  const formattedInvoices = invoices.map(inv => ({
    id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    vendorId: inv.vendor_id?._id,
    vendorName: inv.vendor_id?.name,
    vendorGSTIN: inv.vendor_id?.gstin,
    items: inv.items,
    subtotal: inv.subtotal,
    gstAmount: inv.gstAmount,
    taxBreakdown: inv.taxBreakdown,
    grandTotal: inv.grandTotal,
    paymentStatus: inv.paymentStatus,
    invoiceState: inv.invoiceState,
    paidAmount: inv.paidAmount,
    outstandingAmount: inv.outstandingAmount,
    payments: inv.payments || [],
    notes: inv.notes,
    createdBy: inv.createdBy?.name,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  }));

  const totalPages = Math.ceil(total / limitNum);

  res.json({
    success: true,
    data: formattedInvoices,
    total: total,
    page: pageNum,
    pages: totalPages,
    limit: limitNum,
  });
});


// ─────────────────────────────────────────────────────────
// Get Single
// ─────────────────────────────────────────────────────────

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  }).populate("vendor_id createdBy approvedBy postedBy");

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Create Draft
// ─────────────────────────────────────────────────────────

export const createInvoice = asyncHandler(async (req, res) => {
  const { vendorId, items, notes } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_NO_ITEMS,
    });
  }

  const vendor = await Vendor.findOne({
    _id: vendorId,
    organizationId: req.user.organizationId,
  });

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: MSG.NOT_FOUND("Vendor"),
    });
  }

  // 🔥 STEP 1: Enrich items with inventory snapshot
  const enrichedItems = [];

  for (const item of items) {
    const inventoryItem = await InventoryItem.findOne({
      _id: item.itemId,
      organizationId: req.user.organizationId,
    });

    if (!inventoryItem) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory item",
      });
    }

    enrichedItems.push({
      item_id: inventoryItem._id,
      itemName: inventoryItem.name,
      itemSku: inventoryItem.sku,
      purchaseUnit_id: inventoryItem.purchaseUnit_id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstPercentage: item.gstPercentage,
      taxType: inventoryItem.taxType,
      isPerishable: inventoryItem.isPerishable,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || null,
    });
  }

  // 🔥 STEP 2: Now calculate totals
  const calc = taxService.calculateInvoiceTotals(enrichedItems);

  const invoiceNumber = await generateInvoiceNumber(req.user.organizationId);

  const invoice = await PurchaseInvoice.create({
    organizationId: req.user.organizationId,
    invoiceNumber,
    vendor_id: vendor._id,
    vendorName: vendor.name,
    items: calc.items,
    subtotal: calc.subtotal,
    gstAmount: calc.gstAmount,
    taxBreakdown: calc.taxBreakdown,
    grandTotal: calc.grandTotal,
    outstandingAmount: calc.grandTotal,
    invoiceState: INVOICE_STATE.DRAFT,
    paymentStatus: PAYMENT_STATUS.UNPAID,
    notes: notes || "",
    createdBy: req.user._id,
    stateLog: [
      {
        to: INVOICE_STATE.DRAFT,
        by: req.user._id,
        note: "Invoice created",
      },
    ],
  });

  res.status(201).json({ success: true, data: invoice });
});

// ─────────────────────────────────────────────────────────
// Update Draft
// ─────────────────────────────────────────────────────────

export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  if (invoice.invoiceState !== INVOICE_STATE.DRAFT) {
    return res.status(400).json({
      success: false,
      message: MSG.INVALID_STATE("Invoice", invoice.invoiceState),
    });
  }

  const before = invoice.toObject();
  const { items, notes, vendor_id } = req.body;

  if (items && items.length > 0) {
    const calc = taxService.calculateInvoiceTotals(items);
    invoice.items = calc.items;
    invoice.subtotal = calc.subtotal;
    invoice.gstAmount = calc.gstAmount;
    invoice.taxBreakdown = calc.taxBreakdown;
    invoice.grandTotal = calc.grandTotal;
    invoice.outstandingAmount = calc.grandTotal;
  }

  if (notes !== undefined) invoice.notes = notes;

  if (vendor_id) {
    const vendor = await Vendor.findOne({
      _id: vendor_id,
      organizationId: req.user.organizationId,
    });

    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: MSG.NOT_FOUND("Vendor") });
    }

    invoice.vendor_id = vendor._id;
    invoice.vendorName = vendor.name;
  }

  invoice.updatedBy = req.user._id;
  await invoice.save();

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.UPDATED,
    description: `Draft invoice ${invoice.invoiceNumber} updated`,
    before,
    after: invoice.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Approve
// ─────────────────────────────────────────────────────────

export const approveInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  const allowed = INVOICE_TRANSITIONS[invoice.invoiceState];

  if (!allowed.includes(INVOICE_STATE.APPROVED)) {
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_CANNOT_TRANSITION(
        invoice.invoiceState,
        INVOICE_STATE.APPROVED
      ),
    });
  }

  const before = invoice.toObject();

  invoice.invoiceState = INVOICE_STATE.APPROVED;
  invoice.approvedBy = req.user._id;
  invoice.approvedAt = new Date();
  invoice.updatedBy = req.user._id;

  invoice.stateLog.push({
    from: before.invoiceState,
    to: INVOICE_STATE.APPROVED,
    by: req.user._id,
    note: req.body?.note || "",
  });

  await invoice.save();

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.APPROVED,
    description: `Invoice ${invoice.invoiceNumber} approved`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: invoice });
});


// ─────────────────────────────────────────────────────────
// Post (Atomic)
// ─────────────────────────────────────────────────────────

export const postInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoicePosting.postInvoice({
    organizationId: req.user.organizationId,
    invoiceId: req.params.id,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    data: invoice,
    message: MSG.INVOICE_POST_SUCCESS,
  });
});


// ─────────────────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────────────────

export const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await PurchaseInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice) {
    return res
      .status(404)
      .json({ success: false, message: MSG.INVOICE_NOT_FOUND });
  }

  const allowed = INVOICE_TRANSITIONS[invoice.invoiceState];

  if (!allowed.includes(INVOICE_STATE.CANCELLED)) {
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_CANNOT_TRANSITION(
        invoice.invoiceState,
        INVOICE_STATE.CANCELLED
      ),
    });
  }

  if (invoice.invoiceState === INVOICE_STATE.POSTED) {
    return res.status(400).json({
      success: false,
      message:
        "Posted invoices cannot be cancelled directly. Use a credit note.",
    });
  }

  const before = invoice.toObject();

  invoice.invoiceState = INVOICE_STATE.CANCELLED;
  invoice.cancelledBy = req.user._id;
  invoice.cancelledAt = new Date();
  invoice.cancellationReason = req.body?.reason || "";
  invoice.updatedBy = req.user._id;

  invoice.stateLog.push({
    from: before.invoiceState,
    to: INVOICE_STATE.CANCELLED,
    by: req.user._id,
    note: req.body?.reason || "",
  });

  await invoice.save();

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.PURCHASE_INVOICE,
    entity_id: invoice._id,
    entityReference: invoice.invoiceNumber,
    action: AUDIT_ACTION.CANCELLED,
    description: `Invoice ${invoice.invoiceNumber} cancelled`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    data: invoice,
    message: MSG.INVOICE_CANCEL_SUCCESS,
  });
});
