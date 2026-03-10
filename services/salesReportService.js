/**
 * @service salesReportService.js
 * @description Reporting APIs for the Sales module.
 */

import mongoose from "mongoose";

import SalesInvoice from "../models/SalesInvoice.js";
import SalesPayment from "../models/SalesPayment.js";

import { SALES_INVOICE_STATE } from "../constants/enums.js";


/**
 * Sales Summary — total sales by category and date range.
 */
export const getSalesSummary = async (organizationId, { fromDate, toDate } = {}) => {

  const match = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    invoiceState: SALES_INVOICE_STATE.POSTED,
  };

  if (fromDate || toDate) {
    match.postedAt = {};

    if (fromDate) match.postedAt.$gte = new Date(fromDate);
    if (toDate) match.postedAt.$lte = new Date(toDate);
  }

  const [summary, byCategory] = await Promise.all([
    SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalRevenue: { $sum: "$subtotal" },
          totalTax: { $sum: "$taxBreakdown.totalTax" },
          totalBilled: { $sum: "$grandTotal" },
          totalCollected: { $sum: "$paidAmount" },
          totalOutstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]),

    SalesInvoice.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.category",
          revenue: { $sum: "$items.taxableAmount" },
          tax: {
            $sum: {
              $add: [
                "$items.cgstAmount",
                "$items.sgstAmount",
                "$items.igstAmount",
              ],
            },
          },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
  ]);

  return {
    summary:
      summary[0] || {
        totalInvoices: 0,
        totalRevenue: 0,
        totalTax: 0,
        totalBilled: 0,
        totalCollected: 0,
        totalOutstanding: 0,
      },
    byCategory,
  };
};


/**
 * GST Report — output tax collected breakdown.
 */
export const getGSTReport = async (organizationId, { fromDate, toDate } = {}) => {

  const match = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    invoiceState: SALES_INVOICE_STATE.POSTED,
  };

  if (fromDate || toDate) {
    match.postedAt = {};
    if (fromDate) match.postedAt.$gte = new Date(fromDate);
    if (toDate) match.postedAt.$lte = new Date(toDate);
  }

  const result = await SalesInvoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTaxableValue: { $sum: "$subtotal" },
        totalCGST: { $sum: "$taxBreakdown.cgst" },
        totalSGST: { $sum: "$taxBreakdown.sgst" },
        totalIGST: { $sum: "$taxBreakdown.igst" },
        totalTax: { $sum: "$taxBreakdown.totalTax" },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);

  return (
    result[0] || {
      totalTaxableValue: 0,
      totalCGST: 0,
      totalSGST: 0,
      totalIGST: 0,
      totalTax: 0,
      invoiceCount: 0,
    }
  );
};


/**
 * Receivable Aging
 */
export const getReceivableAging = async (organizationId) => {

  const now = new Date();

  const invoices = await SalesInvoice.find({
    organizationId,
    invoiceState: SALES_INVOICE_STATE.POSTED,
    outstandingAmount: { $gt: 0 },
  })
    .select(
      "invoiceNumber customerName customer_id outstandingAmount postedAt dueDate"
    )
    .lean();

  const buckets = {
    current: 0,
    days31_60: 0,
    days61_90: 0,
    days90plus: 0,
  };

  const details = [];

  for (const inv of invoices) {

    const age = Math.floor((now - new Date(inv.postedAt)) / 86400000);

    let bucket;

    if (age <= 30) {
      bucket = "current";
      buckets.current += inv.outstandingAmount;
    } else if (age <= 60) {
      bucket = "31-60";
      buckets.days31_60 += inv.outstandingAmount;
    } else if (age <= 90) {
      bucket = "61-90";
      buckets.days61_90 += inv.outstandingAmount;
    } else {
      bucket = "90+";
      buckets.days90plus += inv.outstandingAmount;
    }

    details.push({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      outstanding: inv.outstandingAmount,
      ageDays: age,
      bucket,
    });

  }

  return {
    buckets,
    details,
    totalOutstanding: details.reduce((s, d) => s + d.outstanding, 0),
  };
};


/**
 * Customer Ledger
 */
export const getCustomerLedger = async (
  organizationId,
  customer_id,
  { fromDate, toDate } = {}
) => {

  const invoiceMatch = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    customer_id: new mongoose.Types.ObjectId(customer_id),
  };

  if (fromDate || toDate) {
    invoiceMatch.createdAt = {};
    if (fromDate) invoiceMatch.createdAt.$gte = new Date(fromDate);
    if (toDate) invoiceMatch.createdAt.$lte = new Date(toDate);
  }

  const [invoices, payments] = await Promise.all([
    SalesInvoice.find(invoiceMatch)
      .select(
        "invoiceNumber invoiceState grandTotal paidAmount outstandingAmount paymentStatus postedAt createdAt"
      )
      .sort({ createdAt: -1 })
      .lean(),

    SalesPayment.find({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      customer_id: new mongoose.Types.ObjectId(customer_id),
    })
      .select(
        "invoiceNumber amount method reference receivedAt advancePortion"
      )
      .sort({ receivedAt: -1 })
      .lean(),
  ]);

  return { invoices, payments };
};


/**
 * Daily Collection Report
 */
export const getDailyCollection = async (organizationId, { date } = {}) => {

  const targetDate = date ? new Date(date) : new Date();

  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const payments = await SalesPayment.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    receivedAt: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("customer_id", "name")
    .sort({ receivedAt: -1 })
    .lean();

  const byMethod = {};

  let totalCollected = 0;

  for (const p of payments) {
    byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    totalCollected += p.amount;
  }

  return {
    date: startOfDay,
    payments,
    byMethod,
    totalCollected,
  };

};