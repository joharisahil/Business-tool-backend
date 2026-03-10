/**
 * @model SalesPayment
 * @description Records individual payment receipts against SalesInvoices.
 *              Supports partial payments, multiple payments per invoice, and overpayment as advance.
 *              Each payment generates a JournalEntry: Cash/Bank Dr → AR Cr (or Advance Cr for overpayment).
 *              Payment records are immutable after creation.
 */

import mongoose from "mongoose";
import { PAYMENT_METHOD } from "../constants/enums.js";

const salesPaymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
      required: [true, "Sales invoice reference is required"],
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
    },

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be positive"],
    },

    method: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_METHOD),
        message: "Invalid payment method",
      },
      required: [true, "Payment method is required"],
    },

    reference: {
      type: String,
      trim: true,
      maxlength: [100, "Reference cannot exceed 100 characters"],
      default: "",
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },

    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },

    // Track if part of this payment was treated as advance
    advancePortion: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


// ── Indexes ─────────────────────────────────────────────

salesPaymentSchema.index({ organizationId: 1, invoice_id: 1, createdAt: -1 });
salesPaymentSchema.index({ organizationId: 1, customer_id: 1, createdAt: -1 });
salesPaymentSchema.index({ organizationId: 1, receivedAt: -1 });


// ── Guard: immutable records ─────────────────────────────

salesPaymentSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function () {
    throw new Error(
      "SalesPayment records are immutable and cannot be updated after creation."
    );
  }
);


const SalesPayment = mongoose.model("SalesPayment", salesPaymentSchema);

export default SalesPayment;