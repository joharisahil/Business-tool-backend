/**
 * @controller salesPaymentController.js
 * @description Payment receipts against sales invoices.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import * as salesPaymentService from "../services/salesPaymentService.js";


import SalesPayment from "../models/SalesPayment.js";
// ── Record Payment ───────────────────────────────────────

export const listSalesPayments = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  
  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Get filter parameters
  const { search, method, fromDate, toDate } = req.query;
  
  // Build filter object
  let filter = {
    organizationId: organizationId
  };
  
  // Filter by payment method
  if (method && method !== 'ALL') {
    filter.method = method;
  }
  
  // Filter by date range
  if (fromDate || toDate) {
    filter.paidAt = {};
    if (fromDate) {
      filter.paidAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      filter.paidAt.$lte = new Date(toDate);
    }
  }
  
  // Build search condition
  let searchCondition = {};
  if (search && search.trim()) {
    // We'll need to search in invoice number and reference
    // Since we can't directly search in populated fields, we'll handle this after population
    searchCondition.searchTerm = search.trim();
  }
  
  // First, get payments with pagination
  let paymentsQuery = SalesPayment.find(filter)
    .populate("invoice_id", "invoiceNumber")
    .populate("recordedBy", "name")
    .sort({ paidAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  let payments = await paymentsQuery;
  
  // Apply search filter if needed (client-side search on populated fields)
  if (searchCondition.searchTerm) {
    const searchLower = searchCondition.searchTerm.toLowerCase();
    payments = payments.filter(payment => 
      (payment.invoice_id?.invoiceNumber?.toLowerCase().includes(searchLower)) ||
      (payment.reference?.toLowerCase().includes(searchLower))
    );
  }
  
  // Get total count for pagination
  let totalQuery = SalesPayment.countDocuments(filter);
  let total = await totalQuery;
  
  // If search was applied, recalculate total based on filtered results
  if (searchCondition.searchTerm) {
    // Get all payments without pagination to count filtered results
    const allPayments = await SalesPayment.find(filter)
      .populate("invoice_id", "invoiceNumber")
      .lean();
    
    const filteredPayments = allPayments.filter(payment => 
      (payment.invoice_id?.invoiceNumber?.toLowerCase().includes(searchCondition.searchTerm)) ||
      (payment.reference?.toLowerCase().includes(searchCondition.searchTerm))
    );
    
    total = filteredPayments.length;
    
    // Re-apply pagination to filtered results
    const startIndex = skip;
    const endIndex = startIndex + limit;
    payments = filteredPayments.slice(startIndex, endIndex);
  }
  
  const pages = Math.ceil(total / limit);
  
  res.json({
    success: true,
    data: payments,
    total: total,
    page: page,
    pages: pages,
    limit: limit
  });
});

//in future we might use 
// export const recordPayment = asyncHandler(async (req, res) => {
//     console.log("Recording payment for invoice:", req.params.invoiceId);
//   const result = await salesPaymentService.recordSalesPayment({
//     organizationId: req.user.organizationId,
//     invoiceId: req.params.invoiceId,
//     amount: req.body.amount,
//     method: req.body.method,
//     reference: req.body.reference,
//     receivedAt: req.body.receivedAt,
//     notes: req.body.notes,
//     user: req.user,
//     ipAddress: req.ip,
//   });

//   res.status(201).json({
//     success: true,
//     data: result,
//   });
// });

// ── Payment History ──────────────────────────────────────

export const getPaymentHistory = asyncHandler(async (req, res) => {
  const payments = await salesPaymentService.getSalesPaymentHistory(
    req.user.organizationId,
    req.params.invoiceId,
  );

  res.json({
    success: true,
    data: payments,
  });
});

// ── Customer Outstanding ─────────────────────────────────

export const getCustomerOutstanding = asyncHandler(async (req, res) => {
  const result = await salesPaymentService.getCustomerOutstanding(
    req.user.organizationId,
    req.params.customerId,
  );

  res.json({
    success: true,
    data: result,
  });
});
