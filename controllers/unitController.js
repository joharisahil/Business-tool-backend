/**
 * @controller unitController.js
 * @description CRUD for Unit Master + conversion preview endpoint.
 */

import { asyncHandler } from "../utils/asyncHandler.js";

import Unit from "../models/Unit.js";
import * as conversionService from "../services/unitConversionService.js";
import * as auditService from "../services/auditService.js";

import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../constants/enums.js";


// ── List Units ───────────────────────────────────────────

export const listUnits = asyncHandler(async (req, res) => {

  const { category, active, search, page = 1, limit = 100 } = req.query;

  const filter = { organizationId: req.user.organizationId };

  if (category) filter.category = category;
  if (active !== undefined) filter.isActive = active === "true";

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { shortCode: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [data, total] = await Promise.all([
    Unit.find(filter)
      .populate("baseUnit_id", "name shortCode")
      .sort({ category: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit)),

    Unit.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });

});


// ── Get Unit ─────────────────────────────────────────────

export const getUnit = asyncHandler(async (req, res) => {

  const unit = await Unit
    .findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
    .populate("baseUnit_id", "name shortCode");

  if (!unit) {
    return res.status(404).json({
      success: false,
      message: "Unit not found",
    });
  }

  res.json({
    success: true,
    data: unit,
  });

});


// ── Create Unit ──────────────────────────────────────────

export const createUnit = asyncHandler(async (req, res) => {

  const unit = await Unit.create({
    ...req.body,
    organizationId: req.user.organizationId,
    createdBy: req.user._id,
  });

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.UNIT,
    entity_id: unit._id,
    entityReference: unit.shortCode,
    action: AUDIT_ACTION.CREATED,
    description: `Unit created: ${unit.name} (${unit.shortCode})`,
    after: unit.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    data: unit,
  });

});


// ── Update Unit ──────────────────────────────────────────

export const updateUnit = asyncHandler(async (req, res) => {

  const unit = await Unit.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!unit) {
    return res.status(404).json({
      success: false,
      message: "Unit not found",
    });
  }

  const allowed = [
    "name",
    "shortCode",
    "category",
    "baseUnit_id",
    "conversionFactor",
    "decimalPrecision",
  ];

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      unit[field] = req.body[field];
    }
  });

  await unit.save();

  res.json({
    success: true,
    data: unit,
  });

});


// ── Toggle Unit ──────────────────────────────────────────

export const toggleUnit = asyncHandler(async (req, res) => {

  const unit = await Unit.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!unit) {
    return res.status(404).json({
      success: false,
      message: "Unit not found",
    });
  }

  unit.isActive = !unit.isActive;

  await unit.save();

  res.json({
    success: true,
    data: unit,
  });

});


// ── Preview Conversion ───────────────────────────────────

export const previewConversion = asyncHandler(async (req, res) => {

  const { fromUnit_id, toUnit_id, quantity } = req.body;

  if (!fromUnit_id || !toUnit_id || !quantity) {
    return res.status(400).json({
      success: false,
      message: "fromUnit_id, toUnit_id, and quantity are required",
    });
  }

  const result = await conversionService.convert(
    req.user.organizationId,
    fromUnit_id,
    toUnit_id,
    parseFloat(quantity)
  );

  res.json({
    success: true,
    data: result,
  });

});


// ── Related Units ────────────────────────────────────────

export const getRelatedUnits = asyncHandler(async (req, res) => {

  const unit = await Unit.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!unit) {
    return res.status(404).json({
      success: false,
      message: "Unit not found",
    });
  }

  let baseId = unit.baseUnit_id || unit._id;

  const baseUnit = unit.baseUnit_id
    ? await Unit.findById(unit.baseUnit_id)
    : unit;

  if (baseUnit && baseUnit.baseUnit_id) {

    const grandBase = await Unit.findById(baseUnit.baseUnit_id);

    if (grandBase) baseId = grandBase._id;

  }

  const related = await Unit.find({
    organizationId: req.user.organizationId,
    isActive: true,
    $or: [
      { _id: baseId },
      { baseUnit_id: baseId },
    ],
  }).sort({ conversionFactor: 1 });

  res.json({
    success: true,
    data: related,
  });

});