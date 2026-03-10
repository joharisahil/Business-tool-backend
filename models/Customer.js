/**
 * @model Customer
 * @description Tracks guests, corporate clients, travel agents, and walk-in customers.
 *              Designed for Organization PMS but extensible to generic ERP customers.
 *              Outstanding balance is derived from SalesInvoice aggregation, never stored.
 */

import mongoose from "mongoose";
import { CUSTOMER_TYPE, PAYMENT_TERMS } from "../constants/enums.js";

const customerSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },

    customerType: {
      type: String,
      enum: {
        values: Object.values(CUSTOMER_TYPE),
        message: "Invalid customer type",
      },
      default: CUSTOMER_TYPE.WALK_IN,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
      default: "",
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    companyName: {
      type: String,
      trim: true,
      default: "",
    },

    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentTerms: {
      type: String,
      enum: Object.values(PAYMENT_TERMS),
      default: PAYMENT_TERMS.IMMEDIATE,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ─────────────────────────────────────────────────────

customerSchema.index({ organizationId: 1, name: "text", companyName: "text" });
customerSchema.index({ organizationId: 1, customerType: 1, isActive: 1 });
customerSchema.index({ organizationId: 1, gstin: 1 });
customerSchema.index({ organizationId: 1, phone: 1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;