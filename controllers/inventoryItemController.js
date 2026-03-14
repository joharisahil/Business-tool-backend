/**
 * @controller inventoryItemController.js
 * @description CRUD for InventoryItem.
 *              Stock is NEVER modified here.
 *              Current stock is derived from StockTransaction aggregation.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import Unit from "../models/Unit.js";
import InventoryItem from "../models/InventoryItem.js";
import * as stockService from "../services/stockService.js";
import * as auditService from "../services/auditService.js";

import { AUDIT_ENTITY_TYPE, AUDIT_ACTION } from "../constants/enums.js";
import { MSG } from "../constants/messages.js";

// ── List ─────────────────────────────────────────────────────────

export const listItems = asyncHandler(async (req, res) => {
  const { category, search, active } = req.query;

  const filter = { organizationId: req.user.organizationId };

  if (active !== undefined) filter.isActive = active === "true";
  if (category) filter.category_id = category;
  if (search) filter.$text = { $search: search };

  const items = await InventoryItem.find(filter)
    .populate("category_id", "name")
    .sort({ name: 1 });

  const enriched = await Promise.all(
    items.map(async (item) => {
      const currentStock = await stockService.getCurrentStock(
        req.user.organizationId,
        item._id,
      );

      return { ...item.toObject(), currentStock };
    }),
  );

  res.json({ success: true, data: enriched });
});

// ── Get Single ───────────────────────────────────────────────────

export const getItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  }).populate("category_id", "name");

  if (!item) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Item") });
  }

  const currentStock = await stockService.getCurrentStock(
    req.user.organizationId,
    item._id,
  );

  res.json({
    success: true,
    data: { ...item.toObject(), currentStock },
  });
});

// ── Create ───────────────────────────────────────────────────────
const resolveBaseUnit = async (unit) => {
  let current = unit;

  while (current.baseUnit_id) {
    current = await Unit.findById(current.baseUnit_id);
  }

  return current;
};
export const createItem = asyncHandler(async (req, res) => {
  const {
    category_id,
    sku,
    name,
    description,
    unit,
    purchaseUnit_id,
    saleUnits,
    costPrice,
    sellingPrice,
    minimumStock,
    isPerishable,
    shelfLifeDays,
  } = req.body;

  if (isPerishable && !shelfLifeDays) {
    return res.status(400).json({
      success: false,
      message: "shelfLifeDays is required for perishable items.",
    });
  }

  // ─────────────────────────────────────────
  // Validate base unit
  // ─────────────────────────────────────────
  const baseUnit = await Unit.findOne({ shortCode: unit });

  if (!baseUnit) {
    return res.status(400).json({
      success: false,
      message: "Invalid base unit.",
    });
  }

  if (baseUnit.baseUnit_id) {
    return res.status(400).json({
      success: false,
      message: "Base unit cannot be a derived unit.",
    });
  }

  // ─────────────────────────────────────────
  // Validate purchase unit
  // ─────────────────────────────────────────
 if (purchaseUnit_id) {
  const purchaseUnit = await Unit.findById(purchaseUnit_id);

  if (!purchaseUnit) {
    return res.status(400).json({
      success: false,
      message: "Invalid purchase unit.",
    });
  }

  const purchaseBase = await resolveBaseUnit(purchaseUnit);

  if (purchaseBase._id.toString() !== baseUnit._id.toString()) {
    return res.status(400).json({
      success: false,
      message: "Purchase unit must convert to the base unit.",
    });
  }
}
  // ─────────────────────────────────────────
  // Validate sale units
  // ─────────────────────────────────────────
  if (saleUnits && saleUnits.length) {
    const units = await Unit.find({ _id: { $in: saleUnits } });

  for (const u of units) {
  const saleBase = await resolveBaseUnit(u);

  if (saleBase._id.toString() !== baseUnit._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Sale unit ${u.name} does not match base unit.`,
        });
      }
    }
  }

  const item = await InventoryItem.create({
    organizationId: req.user.organizationId,
    category_id,
    sku,
    name,
    description,

    unit: baseUnit.shortCode, // always base unit
    purchaseUnit_id,
    saleUnits,

    costPrice,
    sellingPrice: sellingPrice || 0,
    minimumStock: minimumStock || 0,

    isPerishable: isPerishable || false,
    shelfLifeDays: isPerishable ? shelfLifeDays : null,

    createdBy: req.user._id,
  });

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_ITEM,
    entity_id: item._id,
    entityReference: item.sku,
    action: AUDIT_ACTION.CREATED,
    description: `Item '${item.name}' (${item.sku}) created`,
    after: item.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: item });
});
// export const createItem = asyncHandler(async (req, res) => {
//   const {
//     category_id,
//     sku,
//     name,
//     description,
//     unit,
//     purchaseUnit_id,
//     saleUnits,

//     costPrice,
//     sellingPrice,
//     minimumStock,
//     isPerishable,
//     shelfLifeDays,
//   } = req.body;

//   if (isPerishable && !shelfLifeDays) {
//     return res.status(400).json({
//       success: false,
//       message: "shelfLifeDays is required for perishable items.",
//     });
//   }

//   const item = await InventoryItem.create({
//     organizationId: req.user.organizationId,
//     category_id,
//     sku,
//     name,
//     description,
//     purchaseUnit_id,
//     saleUnits,

//     unit,
//     costPrice,
//     sellingPrice: sellingPrice || 0,
//     minimumStock: minimumStock || 0,
//     isPerishable: isPerishable || false,
//     shelfLifeDays: isPerishable ? shelfLifeDays : null,
//     createdBy: req.user._id,
//   });

//   await auditService.log({
//     organizationId: req.user.organizationId,
//     entityType: AUDIT_ENTITY_TYPE.INVENTORY_ITEM,
//     entity_id: item._id,
//     entityReference: item.sku,
//     action: AUDIT_ACTION.CREATED,
//     description: `Item '${item.name}' (${item.sku}) created`,
//     after: item.toObject(),
//     user: req.user,
//     ipAddress: req.ip,
//   });

//   res.status(201).json({ success: true, data: item });
// });

// ── Update ───────────────────────────────────────────────────────

export const updateItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!item) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Item") });
  }

  const before = item.toObject();

  const allowedUpdates = [
    "name",
    "description",
    "costPrice",
    "sellingPrice",
    "minimumStock",
    "shelfLifeDays",
    "category_id",
    "unit",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      item[field] = req.body[field];
    }
  });

  item.updatedBy = req.user._id;

  await item.save();

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_ITEM,
    entity_id: item._id,
    entityReference: item.sku,
    action: AUDIT_ACTION.UPDATED,
    description: `Item '${item.name}' updated`,
    before,
    after: item.toObject(),
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: item });
});

// ── Toggle Active ────────────────────────────────────────────────

export const toggleItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId,
  });

  if (!item) {
    return res
      .status(404)
      .json({ success: false, message: MSG.NOT_FOUND("Item") });
  }

  item.isActive = !item.isActive;
  item.updatedBy = req.user._id;

  await item.save();

  const action = item.isActive
    ? AUDIT_ACTION.ACTIVATED
    : AUDIT_ACTION.DEACTIVATED;

  await auditService.log({
    organizationId: req.user.organizationId,
    entityType: AUDIT_ENTITY_TYPE.INVENTORY_ITEM,
    entity_id: item._id,
    entityReference: item.sku,
    action,
    description: `Item '${item.name}' ${
      item.isActive ? "activated" : "deactivated"
    }`,
    user: req.user,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: item });
});

// ── Stock Transactions History ────────────────────────────────────

export const getStockHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const result = await stockService.getTransactionHistory({
    organizationId: req.user.organizationId,
    item_id: req.params.id,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({ success: true, ...result });
});
