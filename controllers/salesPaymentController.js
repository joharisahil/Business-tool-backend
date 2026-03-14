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

  const payments = await SalesPayment.find({
    organizationId: organizationId
  })
 .populate("invoice_id", "invoiceNumber")
  .populate("recordedBy", "name")
  .sort({ paidAt: -1 })
.lean();

  res.json({
    success: true,
    data: payments
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
