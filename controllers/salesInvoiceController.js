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
  const {
    customer_id,
    customerName,
    customerGSTIN,
    items,
    notes,
    paymentMode,
  } = req.body;

  if (!customer_id) {
    return res.status(400).json({
      success: false,
      message: "Customer is required.",
    });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Sales invoice must contain items.",
    });
  }

  const enrichedItems = [];

  for (const item of items) {
    const inventoryItem = await InventoryItem.findOne({
      _id: item.itemId,
      organizationId: req.user.organizationId,
    });

    if (!inventoryItem) {
      return res.status(400).json({
        success: false,
        message: "Invalid inventory item.",
      });
    }

    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const discount = Number(item.discount || 0);
    const gstPercentage = Number(item.gstPercentage || 0);

    const lineSubtotal = quantity * unitPrice;
    const taxableAmount = lineSubtotal - discount;

    const cgstAmount = (taxableAmount * gstPercentage) / 200;
    const sgstAmount = (taxableAmount * gstPercentage) / 200;
    const igstAmount = 0;

    const totalAmount =
      taxableAmount + cgstAmount + sgstAmount + igstAmount;

    enrichedItems.push({
      item_id: inventoryItem._id,
      itemName: inventoryItem.name,
      itemSku: inventoryItem.sku,

      description: item.description || inventoryItem.name,
      category: item.category || "GOODS",

      quantity,
      unitPrice,
      discount,

      taxableAmount,
      gstPercentage,

      cgstAmount,
      sgstAmount,
      igstAmount,

      totalAmount,

      deductStock: item.deductStock ?? true,
    });
  }

  // Calculate totals
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  enrichedItems.forEach((item) => {
    subtotal += item.taxableAmount;
    totalDiscount += item.discount || 0;
    totalTax += item.cgstAmount + item.sgstAmount + item.igstAmount;
  });

  const grandTotal = subtotal + totalTax;

  const invoiceNumber = await generateInvoiceNumber(
    req.user.organizationId
  );

  const invoice = await SalesInvoice.create({
    organizationId: req.user.organizationId,
    invoiceNumber,

    customer_id,
    customerName,
    customerGSTIN,

    items: enrichedItems,

    subtotal,
    totalDiscount,

    taxBreakdown: {
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      igst: 0,
      totalTax,
    },

    grandTotal,
    outstandingAmount: grandTotal,

    paymentMode,
    paymentStatus: PAYMENT_STATUS.UNPAID,

    notes,

    createdBy: req.user._id,

    stateLog: [
      {
        to: INVOICE_STATE.DRAFT,
        by: req.user._id,
        note: "Sales invoice created",
      },
    ],
  });

  res.status(201).json({
    success: true,
    data: invoice,
  });
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
export const postSalesInvoice = asyncHandler(async (req, res) => {
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

export const updateSalesInvoice = asyncHandler(async (req, res) => {
  const invoice = await SalesInvoice.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!invoice)
    return res.status(404).json({
      success: false,
      message: MSG.INVOICE_NOT_FOUND,
    });

  // Only draft invoices can be edited
  if (invoice.invoiceState !== INVOICE_STATE.DRAFT)
    return res.status(400).json({
      success: false,
      message: "Only DRAFT invoices can be edited.",
    });

  const { items, notes, customerName, customerGSTIN, paymentMode } = req.body;

  // Update simple fields
  if (notes !== undefined) invoice.notes = notes;
  if (customerName !== undefined) invoice.customerName = customerName;
  if (customerGSTIN !== undefined) invoice.customerGSTIN = customerGSTIN;
  if (paymentMode !== undefined) invoice.paymentMode = paymentMode;

  // If items changed → recalculate totals
  if (items && items.length > 0) {
    const calc = taxService.calculateInvoiceTotals(items);

    invoice.items = calc.items;
    invoice.subtotal = calc.subtotal;
    invoice.gstAmount = calc.gstAmount;
    invoice.taxBreakdown = calc.taxBreakdown;
    invoice.grandTotal = calc.grandTotal;

    // adjust outstanding based on already paid amount
    invoice.outstandingAmount = calc.grandTotal - (invoice.paidAmount || 0);
  }

  invoice.updatedBy = req.user._id;

  await invoice.save();

  res.json({
    success: true,
    data: invoice,
  });
});

export const getCustomerOutstanding = asyncHandler(async (req, res) => {
  const { customerId } = req.params;

  const invoices = await SalesInvoice.find({
    organizationId: req.user.organizationId,
    customer_id: customerId,
    invoiceState: INVOICE_STATE.POSTED,
    outstandingAmount: { $gt: 0 },
  }).sort({ createdAt: -1 });

  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + invoice.outstandingAmount,
    0
  );

  res.json({
    success: true,
    data: {
      customerId,
      totalOutstanding,
      invoices,
    },
  });
});
// /**
//  * @controller salesInvoiceController.js
//  * @description Sales invoice CRUD, state transitions, and listing.
//  */
// 'use strict';

// const mongoose      = require('mongoose');
// const SalesInvoice  = require('../models/SalesInvoice');
// const Customer      = require('../models/Customer');
// const taxService    = require('../services/taxService');
// const auditService  = require('../services/auditService');
// const salesPostingService = require('../services/salesInvoicePostingService');

// const {
//   SALES_INVOICE_STATE,
//   SALES_INVOICE_TRANSITIONS,
//   AUDIT_ENTITY_TYPE,
//   AUDIT_ACTION,
// } = require('../constants/enums');

// // ── Sequential invoice number generator ──────────────────────────
// async function generateSalesInvoiceNumber(organizationId) {
//   const year   = new Date().getFullYear();
//   const prefix = `Organization-SAL-${year}-`;
//   const last   = await SalesInvoice
//     .findOne({ organizationId, invoiceNumber: { $regex: `^${prefix}` } })
//     .sort({ invoiceNumber: -1 })
//     .select('invoiceNumber');
//   let seq = 1;
//   if (last) {
//     const parts = last.invoiceNumber.split('-');
//     seq = parseInt(parts[parts.length - 1], 10) + 1;
//   }
//   return `${prefix}${String(seq).padStart(4, '0')}`;
// }

// // ── Duplicate prevention ─────────────────────────────────────────
// function generateDuplicateKey(invoice) {
//   return `${invoice.customer_id}_${invoice.items.map(i => `${i.description}_${i.quantity}_${i.unitPrice}`).join('|')}`;
// }

// exports.listInvoices = async (req, res) => {
//   try {
//     const { state, customer_id, paymentStatus, fromDate, toDate, page = 1, limit = 50 } = req.query;
//     const filter = { organizationId: req.user.organizationId };
//     if (state)         filter.invoiceState = state;
//     if (customer_id)   filter.customer_id = customer_id;
//     if (paymentStatus) filter.paymentStatus = paymentStatus;
//     if (fromDate || toDate) {
//       filter.createdAt = {};
//       if (fromDate) filter.createdAt.$gte = new Date(fromDate);
//       if (toDate)   filter.createdAt.$lte = new Date(toDate);
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const [data, total] = await Promise.all([
//       SalesInvoice.find(filter)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(parseInt(limit))
//         .populate('customer_id', 'name email phone customerType'),
//       SalesInvoice.countDocuments(filter),
//     ]);

//     res.json({ success: true, data, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// exports.getInvoice = async (req, res) => {
//   try {
//     const invoice = await SalesInvoice
//       .findOne({ _id: req.params.id, organizationId: req.user.organizationId })
//       .populate('customer_id', 'name email phone gstin customerType');
//     if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });
//     res.json({ success: true, data: invoice });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// exports.createInvoice = async (req, res) => {
//   try {
//     const { customer_id, items, roomNumber, bookingRef, notes, paymentTerms } = req.body;
//     const organizationId = req.user.organizationId;

//     const customer = await Customer.findOne({ _id: customer_id, organizationId });
//     if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

//     // Recalculate totals server-side
//     let subtotal = 0, totalDiscount = 0;
//     const taxBreakdown = { cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
//     const processedItems = items.map(item => {
//       const lineSubtotal = item.quantity * item.unitPrice;
//       const discount     = item.discount || 0;
//       const taxable      = lineSubtotal - discount;
//       const gstPct       = item.gstPercentage || 0;
//       const isInterState = false; // Simplified — resolve via GSTIN comparison in production
//       const halfRate     = gstPct / 2;
//       const cgst = isInterState ? 0 : parseFloat((taxable * halfRate / 100).toFixed(2));
//       const sgst = isInterState ? 0 : parseFloat((taxable * halfRate / 100).toFixed(2));
//       const igst = isInterState ? parseFloat((taxable * gstPct / 100).toFixed(2)) : 0;
//       const total = parseFloat((taxable + cgst + sgst + igst).toFixed(2));

//       subtotal += taxable;
//       totalDiscount += discount;
//       taxBreakdown.cgst += cgst;
//       taxBreakdown.sgst += sgst;
//       taxBreakdown.igst += igst;
//       taxBreakdown.totalTax += cgst + sgst + igst;

//       return {
//         ...item,
//         taxableAmount: taxable,
//         cgstAmount: cgst,
//         sgstAmount: sgst,
//         igstAmount: igst,
//         totalAmount: total,
//       };
//     });

//     const grandTotal = parseFloat((subtotal + taxBreakdown.totalTax).toFixed(2));
//     const invoiceNumber = await generateSalesInvoiceNumber(organizationId);

//     const invoice = await SalesInvoice.create({
//       organizationId,
//       invoiceNumber,
//       customer_id,
//       customerName:  customer.name,
//       customerGSTIN: customer.gstin || '',
//       roomNumber:    roomNumber || '',
//       bookingRef:    bookingRef || '',
//       items:         processedItems,
//       subtotal:      parseFloat(subtotal.toFixed(2)),
//       totalDiscount: parseFloat(totalDiscount.toFixed(2)),
//       taxBreakdown,
//       grandTotal,
//       outstandingAmount: grandTotal,
//       paymentTerms:  paymentTerms || customer.paymentTerms,
//       notes:         notes || '',
//       stateLog:      [{ to: SALES_INVOICE_STATE.DRAFT, by: req.user._id, note: 'Invoice created' }],
//       createdBy:     req.user._id,
//       updatedBy:     req.user._id,
//     });

//     await auditService.log({
//       organizationId,
//       entityType:      AUDIT_ENTITY_TYPE.SALES_INVOICE,
//       entity_id:       invoice._id,
//       entityReference: invoiceNumber,
//       action:          AUDIT_ACTION.CREATED,
//       description:     `Sales invoice ${invoiceNumber} created for ${customer.name}. Total: ₹${grandTotal}`,
//       after:           invoice.toObject(),
//       user:            req.user,
//       ipAddress:       req.ip,
//     });

//     res.status(201).json({ success: true, data: invoice });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// exports.updateInvoice = async (req, res) => {
//   try {
//     const invoice = await SalesInvoice.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
//     if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });
//     if (invoice.invoiceState !== SALES_INVOICE_STATE.DRAFT) {
//       return res.status(400).json({ success: false, message: 'Only DRAFT invoices can be edited.' });
//     }

//     const allowed = ['items', 'roomNumber', 'bookingRef', 'notes', 'paymentTerms', 'customer_id'];
//     for (const key of allowed) {
//       if (req.body[key] !== undefined) invoice[key] = req.body[key];
//     }
//     invoice.updatedBy = req.user._id;
//     await invoice.save();

//     res.json({ success: true, data: invoice });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// exports.approveInvoice = async (req, res) => {
//   try {
//     const invoice = await SalesInvoice.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
//     if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });

//     const allowed = SALES_INVOICE_TRANSITIONS[invoice.invoiceState];
//     if (!allowed || !allowed.includes(SALES_INVOICE_STATE.APPROVED)) {
//       return res.status(400).json({ success: false, message: `Cannot approve invoice in ${invoice.invoiceState} state.` });
//     }

//     await SalesInvoice.updateOne(
//       { _id: invoice._id },
//       {
//         $set: { invoiceState: SALES_INVOICE_STATE.APPROVED, approvedBy: req.user._id, approvedAt: new Date(), updatedBy: req.user._id },
//         $push: { stateLog: { from: invoice.invoiceState, to: SALES_INVOICE_STATE.APPROVED, by: req.user._id, note: 'Invoice approved' } },
//       }
//     );

//     res.json({ success: true, message: 'Sales invoice approved.' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// exports.postInvoice = async (req, res) => {
//   try {
//     const result = await salesPostingService.postSalesInvoice({
//       organizationId:  req.user.organizationId,
//       invoiceId: req.params.id,
//       user:      req.user,
//       ipAddress: req.ip,
//     });
//     res.json({ success: true, message: 'Sales invoice posted.', data: result });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// exports.cancelInvoice = async (req, res) => {
//   try {
//     const invoice = await SalesInvoice.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
//     if (!invoice) return res.status(404).json({ success: false, message: 'Sales invoice not found.' });

//     const allowed = SALES_INVOICE_TRANSITIONS[invoice.invoiceState];
//     if (!allowed || !allowed.includes(SALES_INVOICE_STATE.CANCELLED)) {
//       return res.status(400).json({ success: false, message: `Cannot cancel invoice in ${invoice.invoiceState} state.` });
//     }

//     await SalesInvoice.updateOne(
//       { _id: invoice._id },
//       {
//         $set: {
//           invoiceState: SALES_INVOICE_STATE.CANCELLED,
//           cancelledBy: req.user._id,
//           cancelledAt: new Date(),
//           cancellationReason: req.body.reason || '',
//           updatedBy: req.user._id,
//         },
//         $push: { stateLog: { from: invoice.invoiceState, to: SALES_INVOICE_STATE.CANCELLED, by: req.user._id, note: req.body.reason || 'Cancelled' } },
//       }
//     );

//     res.json({ success: true, message: 'Sales invoice cancelled.' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };