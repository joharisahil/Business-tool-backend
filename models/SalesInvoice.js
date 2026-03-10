import mongoose from "mongoose";
import {
  SALES_INVOICE_STATE,
  SALES_PAYMENT_STATUS,
  SALES_CATEGORY,
  PAYMENT_TERMS,
} from "../constants/enums.js";

const salesLineItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      default: null,
    },

    description: {
      type: String,
      required: [true, "Line item description is required"],
      trim: true,
    },

    category: {
      type: String,
      enum: Object.values(SALES_CATEGORY),
      required: true,
    },

    hsnSacCode: {
      type: String,
      trim: true,
      default: "",
    },

    quantity: {
      type: Number,
      required: true,
      min: [0.01, "Quantity must be positive"],
    },

    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Unit price cannot be negative"],
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxableAmount: {
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

    deductStock: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const stateLogSchema = new mongoose.Schema(
  {
    from: { type: String },
    to: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    customerGSTIN: {
      type: String,
      trim: true,
      default: "",
    },

    roomNumber: { type: String, trim: true, default: "" },
    bookingRef: { type: String, trim: true, default: "" },

    items: {
      type: [salesLineItemSchema],
      validate: {
        validator: (items) => items && items.length >= 1,
        message: "Sales invoice must have at least one line item",
      },
    },

    subtotal: { type: Number, required: true, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },

    taxBreakdown: {
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
      totalTax: { type: Number, default: 0 },
    },

    grandTotal: { type: Number, required: true, min: 0 },

    invoiceState: {
      type: String,
      enum: Object.values(SALES_INVOICE_STATE),
      default: SALES_INVOICE_STATE.DRAFT,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(SALES_PAYMENT_STATUS),
      default: SALES_PAYMENT_STATUS.UNPAID,
      index: true,
    },

    paidAmount: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },

    paymentTerms: {
      type: String,
      enum: Object.values(PAYMENT_TERMS),
      default: PAYMENT_TERMS.IMMEDIATE,
    },

    dueDate: { type: Date, default: null },

    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    stateLog: [stateLogSchema],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },
  },
  { timestamps: true }
);

salesInvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.model("SalesInvoice", salesInvoiceSchema);