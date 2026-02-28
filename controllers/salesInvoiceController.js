import SalesInvoice from "../models/SalesInvoice.js";
import InventoryItem from "../models/InventoryItem.js";

import * as taxService from "../services/taxService.js";
import * as auditService from "../services/auditService.js";
import * as salesPostingService from "../services/salesPostingService.js";

import { asyncHandler } from "../utils/asyncHandler.js";

import {
  INVOICE_STATE,
  INVOICE_TRANSITIONS,
  PAYMENT_STATUS,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

const generateInvoiceNumber = async (organizationId) => {
  const year = new Date().getFullYear();
  const prefix = `SI-${year}-`;

  const last = await SalesInvoice.findOne({
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
export const listSalesInvoices = asyncHandler(async (req, res) => {
  const { state, page = 1, limit = 20 } = req.query;

  const filter = { organizationId: req.user.organizationId };
  if (state) filter.invoiceState = state;

  const skip = (page - 1) * limit;

  const total = await SalesInvoice.countDocuments(filter);

  const invoices = await SalesInvoice.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  res.json({
    success: true,
    data: invoices,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  });
});
export const getSalesInvoice = asyncHandler(async (req, res) => {
  const invoice = await SalesInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({
      success: false,
      message: MSG.INVOICE_NOT_FOUND,
    });

  res.json({ success: true, data: invoice });
});
export const createSalesInvoice = asyncHandler(async (req, res) => {
  const { customerName, customerGSTIN, items, notes , paymentMode} = req.body;

  if (!items || items.length === 0)
    return res.status(400).json({
      success: false,
      message: "Sales invoice must contain items.",
    });

  const enrichedItems = [];

  for (const item of items) {
    const inventoryItem = await InventoryItem.findOne({
      _id: item.itemId,
      organizationId: req.user.organizationId,
    });

    if (!inventoryItem)
      return res.status(400).json({
        success: false,
        message: "Invalid inventory item.",
      });

    enrichedItems.push({
      item_id: inventoryItem._id,
      itemName: inventoryItem.name,
      itemSku: inventoryItem.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstPercentage: item.gstPercentage,
    });
  }

  const calc = taxService.calculateInvoiceTotals(enrichedItems);

  const invoiceNumber = await generateInvoiceNumber(req.user.organizationId);

  const invoice = await SalesInvoice.create({
    organizationId: req.user.organizationId,
    invoiceNumber,
    customerName,
    customerGSTIN,
    items: calc.items,
    subtotal: calc.subtotal,
    gstAmount: calc.gstAmount,
    taxBreakdown: calc.taxBreakdown,
    grandTotal: calc.grandTotal,
    paymentMode,
    outstandingAmount: calc.grandTotal,
    paymentStatus: PAYMENT_STATUS.UNPAID,
    createdBy: req.user._id,
    notes,
    stateLog: [
      {
        to: INVOICE_STATE.DRAFT,
        by: req.user._id,
        note: "Sales invoice created",
      },
    ],
  });

  res.status(201).json({ success: true, data: invoice });
});
export const approveSalesInvoice = asyncHandler(async (req, res) => {
  const invoice = await SalesInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({ success: false, message: MSG.INVOICE_NOT_FOUND });

  const allowed = INVOICE_TRANSITIONS[invoice.invoiceState];

  if (!allowed.includes(INVOICE_STATE.APPROVED))
    return res.status(400).json({
      success: false,
      message: MSG.INVOICE_CANNOT_TRANSITION(
        invoice.invoiceState,
        INVOICE_STATE.APPROVED
      ),
    });

  invoice.invoiceState = INVOICE_STATE.APPROVED;
  invoice.approvedBy = req.user._id;
  invoice.approvedAt = new Date();

  invoice.stateLog.push({
    from: INVOICE_STATE.DRAFT,
    to: INVOICE_STATE.APPROVED,
    by: req.user._id,
  });

  await invoice.save();

  res.json({ success: true, data: invoice });
});
export const postSalesInvoiceController = asyncHandler(async (req, res) => {
  const invoice = await salesPostingService.postSalesInvoice({
    organizationId: req.user.organizationId,
    invoiceId: req.params.id,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    data: invoice,
    message: "Sales invoice posted successfully.",
  });
});
export const cancelSalesInvoice = asyncHandler(async (req, res) => {
  const invoice = await SalesInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({ success: false, message: MSG.INVOICE_NOT_FOUND });

  if (invoice.invoiceState === INVOICE_STATE.POSTED)
    return res.status(400).json({
      success: false,
      message: "Posted invoice cannot be cancelled. Use Sales Credit Note.",
    });

  invoice.invoiceState = INVOICE_STATE.CANCELLED;
  invoice.cancelledBy = req.user._id;
  invoice.cancelledAt = new Date();

  await invoice.save();

  res.json({
    success: true,
    data: invoice,
    message: "Sales invoice cancelled.",
  });
});


//temp
export const recordSalesPayment = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { amount, method, reference } = req.body;

  const invoice = await SalesInvoice.findOne({
    _id: invoiceId,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({
      success: false,
      message: "Sales invoice not found",
    });

  if (invoice.invoiceState !== INVOICE_STATE.POSTED)
    return res.status(400).json({
      success: false,
      message: "Only POSTED invoices can receive payments",
    });

  if (amount > invoice.outstandingAmount)
    return res.status(400).json({
      success: false,
      message: "Payment exceeds outstanding amount",
    });

  // Update invoice
  invoice.paidAmount += amount;
  invoice.outstandingAmount -= amount;

  if (invoice.outstandingAmount === 0) {
    invoice.paymentStatus = PAYMENT_STATUS.PAID;
  } else {
    invoice.paymentStatus = PAYMENT_STATUS.PARTIAL;
  }

  // Save payment snapshot
  invoice.paymentMethod = method;
  invoice.paymentReference = reference;
  invoice.paymentDate = new Date();

  await invoice.save();

  res.status(200).json({
    success: true,
    data: invoice,
  });
});

export const getSalesPaymentHistory = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const invoice = await SalesInvoice.findOne({
    _id: invoiceId,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({
      success: false,
      message: "Sales invoice not found",
    });

  res.status(200).json({
    success: true,
    data: {
      paidAmount: invoice.paidAmount,
      outstandingAmount: invoice.outstandingAmount,
      paymentMethod: invoice.paymentMethod,
      paymentReference: invoice.paymentReference,
      paymentDate: invoice.paymentDate,
    },
  });
});