/**
 * @service salesPaymentService.js
 * @description Manages customer payment receipts against posted sales invoices.
 */

import mongoose from "mongoose";

import SalesInvoice from "../models/SalesInvoice.js";
import SalesPayment from "../models/SalesPayment.js";

import * as journalService from "./journalService.js";
import * as auditService from "./auditService.js";

import {
  SALES_INVOICE_STATE,
  SALES_PAYMENT_STATUS,
  PAYMENT_METHOD,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

function getCashOrBankCode(method) {
  const bankMethods = [
    PAYMENT_METHOD.BANK_TRANSFER,
    PAYMENT_METHOD.CHEQUE,
    PAYMENT_METHOD.NEFT,
    PAYMENT_METHOD.RTGS,
    PAYMENT_METHOD.UPI,
  ];

  return bankMethods.includes(method)
    ? DEFAULT_LEDGER_CODES.BANK
    : DEFAULT_LEDGER_CODES.CASH;
}

export const recordSalesPayment = async ({
  organizationId,
  invoiceId,
  amount,
  method,
  reference = "",
  receivedAt = new Date(),
  notes = "",
  user,
  ipAddress = "",
}) => {
  if (!amount || amount <= 0)
    throw new Error("Payment amount must be positive.");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await SalesInvoice.findOne({
      _id: invoiceId,
      organizationId,
    }).session(session);

    if (!invoice) throw new Error("Sales invoice not found.");

    if (invoice.invoiceState !== SALES_INVOICE_STATE.POSTED) {
      throw new Error(
        "Payments can only be recorded against POSTED sales invoices.",
      );
    }

    const outstanding = invoice.outstandingAmount;

    const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

    const cashBankCode = getCashOrBankCode(method);

    // AR portion vs advance portion
    const arPortion = Math.min(amount, outstanding);
    const advancePortion = Math.max(0, amount - outstanding);

    // ── Journal Lines ─────────────────────────────
    const journalLines = [
      {
        accountCode: cashBankCode,
        entryType: DEBIT,
        amount: amount,
        description: `${method} received from ${invoice.customerName}: ${invoice.invoiceNumber}`,
      },
    ];

    if (arPortion > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.ACCOUNTS_RECEIVABLE,
        entryType: CREDIT,
        amount: parseFloat(arPortion.toFixed(2)),
        description: `AR settlement: ${invoice.invoiceNumber}`,
      });
    }

    if (advancePortion > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.ADVANCE_FROM_GUESTS,
        entryType: CREDIT,
        amount: parseFloat(advancePortion.toFixed(2)),
        description: `Customer advance: ${invoice.customerName}`,
      });
    }

    const journalEntry = await journalService.createEntry({
      organizationId,
      referenceType: JOURNAL_REFERENCE_TYPE.SALES_PAYMENT,
      reference_id: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      lines: journalLines,
      narration: `Payment received: ₹${amount.toFixed(
        2,
      )} from ${invoice.customerName} | Inv: ${invoice.invoiceNumber}`,
      user,
      session,
    });
    console.log("Creating SalesPayment...");
    // ── Payment Record ─────────────────────────────
    const [payment] = await SalesPayment.create(
      [
        {
          organizationId,
          invoice_id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          customer_id: invoice.customer_id,
          amount,
          method,
          reference,
          receivedAt,
          journalEntry_id: journalEntry._id,
          advancePortion,
          notes,
          recordedBy: user._id,
        },
      ],
      { session },
    );

    // ── Update Invoice ─────────────────────────────
    const newPaidAmount = Number((invoice.paidAmount + amount).toFixed(2));

  let newOutstanding = Number(
  (invoice.grandTotal - newPaidAmount).toFixed(2),
);

    if (newOutstanding < 0.01) {
      newOutstanding = 0;
    }
    const newAdvance = parseFloat(
      (invoice.advanceAmount + advancePortion).toFixed(2),
    );

    let newPaymentStatus;

    if (newOutstanding <= 0.005 && advancePortion > 0) {
      newPaymentStatus = SALES_PAYMENT_STATUS.ADVANCE;
    } else if (newOutstanding <= 0.005) {
      newPaymentStatus = SALES_PAYMENT_STATUS.PAID;
    } else if (newPaidAmount > 0) {
      newPaymentStatus = SALES_PAYMENT_STATUS.PARTIAL;
    } else {
      newPaymentStatus = SALES_PAYMENT_STATUS.UNPAID;
    }

    await SalesInvoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          paidAmount: newPaidAmount,
          outstandingAmount: newOutstanding,
          advanceAmount: newAdvance,
          paymentStatus: newPaymentStatus,
          updatedBy: user._id,
        },
      },
      { session },
    );

    // ── Audit Log ─────────────────────────────
    await auditService.log({
      organizationId,
      entityType: AUDIT_ENTITY_TYPE.SALES_PAYMENT,
      entity_id: payment._id,
      entityReference: invoice.invoiceNumber,
      action: AUDIT_ACTION.PAYMENT_RECORDED,
      description: `Payment ₹${amount.toFixed(
        2,
      )} received via ${method} for ${invoice.invoiceNumber}. Outstanding: ₹${newOutstanding}${
        advancePortion > 0 ? ` | Advance: ₹${advancePortion.toFixed(2)}` : ""
      }`,
      before: {
        paidAmount: invoice.paidAmount,
        outstandingAmount: invoice.outstandingAmount,
      },
      after: {
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding,
        advanceAmount: newAdvance,
      },
      user,
      ipAddress,
      session,
    });
    console.log("Committing payment transaction...");
    await session.commitTransaction();

    const updatedInvoice = await SalesInvoice.findById(invoice._id);

    return { payment, invoice: updatedInvoice };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const getSalesPaymentHistory = async (organizationId, invoiceId) => {
  return SalesPayment.find({ organizationId, invoice_id: invoiceId })
    .sort({ receivedAt: -1 })
    .populate("recordedBy", "name role");
};

export const getCustomerOutstanding = async (organizationId, customer_id) => {
  const agg = await SalesInvoice.aggregate([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        customer_id: new mongoose.Types.ObjectId(customer_id),
        invoiceState: SALES_INVOICE_STATE.POSTED,
      },
    },
    {
      $group: {
        _id: null,
        totalBilled: { $sum: "$grandTotal" },
        totalPaid: { $sum: "$paidAmount" },
        totalOutstanding: { $sum: "$outstandingAmount" },
        totalAdvance: { $sum: "$advanceAmount" },
      },
    },
  ]);

  if (!agg.length)
    return {
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      advance: 0,
    };

  return {
    totalBilled: parseFloat(agg[0].totalBilled.toFixed(2)),
    totalPaid: parseFloat(agg[0].totalPaid.toFixed(2)),
    outstanding: parseFloat(agg[0].totalOutstanding.toFixed(2)),
    advance: parseFloat(agg[0].totalAdvance.toFixed(2)),
  };
};
