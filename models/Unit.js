/**
 * @model Unit
 * @description Unit Master for measurement and packaging units.
 *              Supports base-unit referencing and conversion factors.
 *              Stock is always stored in the base unit of the item.
 *              Example: 1 BOX = 20 PCS, 1 METER = 3.28084 FEET
 */

import mongoose from "mongoose";
import { UNIT_CATEGORY } from "../constants/enums.js";

const unitSchema = new mongoose.Schema(
  {
    hotel_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Unit name is required"],
      trim: true,
      maxlength: [100, "Unit name cannot exceed 100 characters"],
    },

    shortCode: {
      type: String,
      required: [true, "Short code is required"],
      trim: true,
      uppercase: true,
      maxlength: [10, "Short code cannot exceed 10 characters"],
    },

    category: {
      type: String,
      enum: {
        values: Object.values(UNIT_CATEGORY),
        message: "Invalid unit category",
      },
      required: [true, "Unit category is required"],
    },

    /** If this is a derived unit, reference the base unit */
    baseUnit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      default: null,
    },

    /**
     * How many of the BASE unit = 1 of THIS unit.
     * Convention: 1 thisUnit × conversionFactor = quantity in baseUnit
     */
    conversionFactor: {
      type: Number,
      default: 1,
      min: [0.000001, "Conversion factor must be positive"],
    },

    /** Number of decimal places for this unit */
    decimalPrecision: {
      type: Number,
      default: 2,
      min: 0,
      max: 6,
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


// ── Indexes ─────────────────────────────────────────────

unitSchema.index({ hotel_id: 1, shortCode: 1 }, { unique: true });
unitSchema.index({ hotel_id: 1, category: 1, isActive: 1 });
unitSchema.index({ hotel_id: 1, baseUnit_id: 1 });


const Unit = mongoose.model("Unit", unitSchema);

export default Unit;