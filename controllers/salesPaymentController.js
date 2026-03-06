/**
 * @controller salesPaymentController.js
 * @description Payment receipts against sales invoices.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import * as salesPaymentService from "../services/salesPaymentService.js";


// ── Record Payment ───────────────────────────────────────

export const recordPayment = asyncHandler(async (req, res) => {

  const result = await salesPaymentService.recordSalesPayment({
    hotel_id: req.user.hotel_id,
    invoiceId: req.params.invoiceId,
    amount: req.body.amount,
    method: req.body.method,
    reference: req.body.reference,
    receivedAt: req.body.receivedAt,
    notes: req.body.notes,
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    data: result,
  });

});


// ── Payment History ──────────────────────────────────────

export const getPaymentHistory = asyncHandler(async (req, res) => {

  const payments = await salesPaymentService.getSalesPaymentHistory(
    req.user.hotel_id,
    req.params.invoiceId
  );

  res.json({
    success: true,
    data: payments,
  });

});


// ── Customer Outstanding ─────────────────────────────────

export const getCustomerOutstanding = asyncHandler(async (req, res) => {

  const result = await salesPaymentService.getCustomerOutstanding(
    req.user.hotel_id,
    req.params.customerId
  );

  res.json({
    success: true,
    data: result,
  });

});