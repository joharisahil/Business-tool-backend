import mongoose from "mongoose";
import { INVOICE_STATE, PAYMENT_STATUS, PAYMENT_METHOD } from "../constants/enums.js";

const salesInvoiceItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },

    itemName: { type: String, required: true },
    itemSku: { type: String },

    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    gstPercentage: { type: Number, required: true },

    totalAmount: { type: Number, required: true },

    // FIFO Cost Snapshot
    costPriceSnapshot: { type: Number },
    costAmountSnapshot: { type: Number },
  },
  { _id: true }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerName: { type: String, required: true },
    customerGSTIN: { type: String },

    // 🔥 NEW FIELD (Important)
    paymentMode: {
      type: String,
      enum: ["CASH", "BANK", "UPI", "CREDIT"],
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
    },

    paymentReference: { type: String },
    paymentDate: { type: Date },

    items: {
      type: [salesInvoiceItemSchema],
      required: true,
      validate: [(val) => val.length > 0, "Invoice must have items"],
    },

    // Totals
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },

    taxBreakdown: {
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
    },

    grandTotal: { type: Number, required: true },

    // Payment Tracking
    paidAmount: { type: Number, default: 0 },
    outstandingAmount: { type: Number, required: true },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },

    // Lifecycle
    invoiceState: {
      type: String,
      enum: Object.values(INVOICE_STATE),
      default: INVOICE_STATE.DRAFT,
    },

    journalEntry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
    },

    // Audit Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedAt: { type: Date },

    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },

    stateLog: [
      {
        from: String,
        to: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],

    notes: { type: String },
  },
  { timestamps: true }
);

salesInvoiceSchema.index({ organizationId: 1, createdAt: -1 });
salesInvoiceSchema.index({ organizationId: 1, invoiceState: 1 });

export default mongoose.model("SalesInvoice", salesInvoiceSchema);