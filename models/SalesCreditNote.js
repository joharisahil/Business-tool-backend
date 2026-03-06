/**
 * @model SalesCreditNote
 * @description Credit note against a posted sales invoice.
 *              Reverses AR and revenue entries. Optionally restores stock for inventory items.
 *              Immutable after creation.
 */

import mongoose from "mongoose";
import { SALES_CATEGORY } from "../constants/enums.js";

const creditNoteItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },

    category: {
      type: String,
      enum: Object.values(SALES_CATEGORY),
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.01,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
    },

    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      default: null,
    },

    restoreStock: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const salesCreditNoteSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    creditNoteNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    originalInvoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesInvoice",
      required: true,
      index: true,
    },

    originalInvoiceNumber: {
      type: String,
      required: true,
    },

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    items: {
      type: [creditNoteItemSchema],
      validate: {
        validator: (items) => items && items.length >= 1,
        message: "Credit note must have at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    taxBreakdown: {
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
    },

    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
      maxlength: 500,
    },

    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);


// ── Indexes ─────────────────────────────────────────────

salesCreditNoteSchema.index(
  { hotel_id: 1, creditNoteNumber: 1 },
  { unique: true }
);

salesCreditNoteSchema.index({ hotel_id: 1, originalInvoice_id: 1 });

salesCreditNoteSchema.index({ hotel_id: 1, customer_id: 1 });


// ── Guard: immutable ─────────────────────────────────────

salesCreditNoteSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany"],
  function () {
    throw new Error("SalesCreditNote records are immutable after creation.");
  }
);


const SalesCreditNote = mongoose.model(
  "SalesCreditNote",
  salesCreditNoteSchema
);

export default SalesCreditNote;