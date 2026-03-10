/**
 * @model InventoryCategory
 * @description Master category for grouping inventory items (e.g., Food, Beverage, Housekeeping).
 *              Soft-deleted via isActive. Scoped per Organization.
 */

import mongoose from "mongoose";

const inventoryCategorySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, "organizationId is required"],
      index: true,
    },

    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
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

// ── Unique category name per Organization ─────────────────────────

inventoryCategorySchema.index(
  { organizationId: 1, name: 1 },
  { unique: true }
);

// ── Virtual: count items in this category ──────────────────

inventoryCategorySchema.virtual("items", {
  ref: "InventoryItem",
  localField: "_id",
  foreignField: "category_id",
  count: true,
});

export default mongoose.model("InventoryCategory", inventoryCategorySchema);
