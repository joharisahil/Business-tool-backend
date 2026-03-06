/**
 * @controller customerController.js
 * @description CRUD operations for Customer model.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import Customer from "../models/Customer.js";
import * as auditService from "../services/auditService.js";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../constants/enums.js";

// ── List Customers ─────────────────────────────────────────

export const listCustomers = asyncHandler(async (req, res) => {
  const { type, active, search, page = 1, limit = 50 } = req.query;

  const filter = { hotel_id: req.user.hotel_id };

  if (type) filter.customerType = type;
  if (active !== undefined) filter.isActive = active === "true";

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { companyName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [data, total] = await Promise.all([
    Customer.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit)),

    Customer.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });
});

// ── Get Single Customer ────────────────────────────────────

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!customer) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  }

  res.json({ success: true, data: customer });
});

// ── Create Customer ────────────────────────────────────────

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create({
    ...req.body,
    hotel_id: req.user.hotel_id,
    createdBy: req.user._id,
  });

  await auditService.log({
    hotel_id: req.user.hotel_id,
    entityType: AUDIT_ENTITY_TYPE.CUSTOMER,
    entity_id: customer._id,
    entityReference: customer.name,
    action: AUDIT_ACTION.CREATED,
    description: `Customer created: ${customer.name}`,
    after: customer.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: customer });
});

// ── Update Customer ────────────────────────────────────────

export const updateCustomer = asyncHandler(async (req, res) => {
  const before = await Customer.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!before) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  }

  Object.assign(before, req.body);
  await before.save();

  res.json({ success: true, data: before });
});

// ── Toggle Customer ───────────────────────────────────────

export const toggleCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({
    _id: req.params.id,
    hotel_id: req.user.hotel_id,
  });

  if (!customer) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found" });
  }

  customer.isActive = !customer.isActive;
  await customer.save();

  res.json({ success: true, data: customer });
});