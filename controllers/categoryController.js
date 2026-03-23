/**
 * @controller categoryController.js
 * @description CRUD for InventoryCategory (scoped to organizationId from JWT)
 */


import { asyncHandler } from "../utils/asyncHandler.js";
import InventoryCategory from "../models/InventoryCategory.js";
import * as auditService from "../services/auditService.js";
import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../constants/enums.js";
import { MSG } from "../constants/messages.js";

// ── List ─────────────────────────────────────────────
export const listCategories = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  
  // Get pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Build filter
  let filter = { organizationId };
  
  // Handle active status filter
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  } else {
    // Default: only show active
    filter.isActive = true;
  }
  
  // Handle search
  if (req.query.search && req.query.search.trim()) {
    const searchRegex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { description: searchRegex }
    ];
  }
  
  // Get total count
  const total = await InventoryCategory.countDocuments(filter);
  
  // Get paginated results
  const categories = await InventoryCategory.find(filter)
    .populate("items")
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const pages = Math.ceil(total / limit);
  
  res.json({
    success: true,
    data: categories,
    total: total,
    page: page,
    pages: pages,
    limit: limit
  });
});

// ── Create ───────────────────────────────────────────
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { organizationId, _id: userId, name: userName, role } = req.user;

  // Validate required fields
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Category name is required",
    });
  }

  // Check for duplicate category
  const existingCategory = await InventoryCategory.findOne({
    organizationId,
    name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
  });

  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: "Category with this name already exists",
    });
  }

  // Create the category
  const category = await InventoryCategory.create({
    organizationId,
    name: name.trim(),
    description: description?.trim() || "",
    createdBy: userId,
    isActive: true,
  });

  // Get the category as a plain object for audit
  const categoryObject = category.toObject();

  // Audit log with try-catch to prevent breaking the main flow
  try {
    await auditService.log({
      organizationId: organizationId,
      entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // ✅ Now this is defined
      entity_id: category._id,
      entityReference: category.name,
      action: AUDIT_ACTION.CREATED,
      description: `Category '${category.name}' created`,
      after: categoryObject,
      user: {
        _id: userId,
        name: userName,
        role: role,
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || "",
    });
  } catch (auditError) {
    // Log error but don't fail the request
    console.error("[AuditService] Failed to write audit log for category creation:", auditError.message);
  }

  res.status(201).json({ 
    success: true, 
    data: category,
    message: "Category created successfully"
  });
});
// export const createCategory = asyncHandler(async (req, res) => {
//   const { name, description } = req.body;

//   const category = await InventoryCategory.create({
//     organizationId: req.user.organizationId,
//     name,
//     description: description || "",
//     createdBy: req.user._id,
//   });

//   await auditService.log({
//     organizationId: req.user.organizationId,
//     entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
//     entity_id: category._id,
//     entityReference: name,
//     action: AUDIT_ACTION.CREATED,
//     description: `Category '${name}' created`,
//     after: category.toObject(),
//     user: req.user,
//     ipAddress: req.ip,
//   });

//   res.status(201).json({ success: true, data: category });
// });

// ── Update ───────────────────────────────────────────
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!category)
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Category") });

  const before = category.toObject();
  const { name, description } = req.body;

  if (name) category.name = name;
  if (description !== undefined) category.description = description;

  await category.save();

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
    entity_id: category._id,
    entityReference: category.name,
    action: AUDIT_ACTION.UPDATED,
    description: `Category '${category.name}' updated`,
    before,
    after: category.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: category });
});

// ── Toggle Active ────────────────────────────────────
export const toggleCategory = asyncHandler(async (req, res) => {
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!category)
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Category") });

  category.isActive = !category.isActive;
  await category.save();

  const action = category.isActive
    ? AUDIT_ACTION.ACTIVATED
    : AUDIT_ACTION.DEACTIVATED;

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_CATEGORY, // fixed
    entity_id: category._id,
    entityReference: category.name,
    action,
    description: `Category '${category.name}' ${
      category.isActive ? "activated" : "deactivated"
    }`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: category });
});
