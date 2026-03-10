/**
 * @service unitConversionService.js
 * @description Reusable unit conversion utility supporting direct and nested conversions.
 */

import Unit from "../models/Unit.js";


/**
 * Convert a quantity from one unit to the base unit.
 */
export const convertToBase = async (
  organizationId,
  fromUnit_id,
  quantity,
  maxDepth = 10
) => {

  const chain = [];

  let currentUnit = await Unit.findOne({ _id: fromUnit_id, organizationId });

  if (!currentUnit)
    throw new Error(`Unit not found: ${fromUnit_id}`);

  let result = quantity;

  let depth = 0;

  while (currentUnit.baseUnit_id && depth < maxDepth) {

    result *= currentUnit.conversionFactor;

    chain.push({
      unit: currentUnit.shortCode,
      factor: currentUnit.conversionFactor,
      runningQty: result,
    });

    currentUnit = await Unit.findOne({
      _id: currentUnit.baseUnit_id,
      organizationId,
    });

    if (!currentUnit)
      throw new Error("Broken unit chain: base unit not found");

    depth++;

  }

  if (depth === 0) {
    chain.push({
      unit: currentUnit.shortCode,
      factor: 1,
      runningQty: result,
    });
  }

  return {
    baseQuantity: round(result, currentUnit.decimalPrecision),
    baseUnit: currentUnit,
    chain,
  };

};


/**
 * Convert from base unit to target unit
 */
export const convertFromBase = async (
  organizationId,
  toUnit_id,
  baseQuantity
) => {

  const targetUnit = await Unit.findOne({ _id: toUnit_id, organizationId });

  if (!targetUnit)
    throw new Error(`Target unit not found: ${toUnit_id}`);

  let totalFactor = 1;

  let current = targetUnit;

  let depth = 0;

  while (current.baseUnit_id && depth < 10) {

    totalFactor *= current.conversionFactor;

    current = await Unit.findOne({
      _id: current.baseUnit_id,
      organizationId,
    });

    if (!current)
      throw new Error("Broken unit chain");

    depth++;

  }

  const convertedQuantity = round(
    baseQuantity / totalFactor,
    targetUnit.decimalPrecision
  );

  return { convertedQuantity, targetUnit };

};


/**
 * Convert between any two units
 */
export const convert = async (
  organizationId,
  fromUnit_id,
  toUnit_id,
  quantity
) => {

  if (fromUnit_id.toString() === toUnit_id.toString()) {

    const unit = await Unit.findOne({ _id: fromUnit_id, organizationId });

    return {
      result: round(quantity, unit?.decimalPrecision || 2),
      baseQuantity: quantity,
    };

  }

  const { baseQuantity, baseUnit } = await convertToBase(
    organizationId,
    fromUnit_id,
    quantity
  );

  const { convertedQuantity } = await convertFromBase(
    organizationId,
    toUnit_id,
    baseQuantity
  );

  return {
    result: convertedQuantity,
    baseQuantity,
    baseUnitCode: baseUnit.shortCode,
  };

};


/**
 * Validate stock availability
 */
export const validateStock = async (
  organizationId,
  fromUnit_id,
  saleQuantity,
  availableBaseStock
) => {

  const { baseQuantity } = await convertToBase(
    organizationId,
    fromUnit_id,
    saleQuantity
  );

  return {
    sufficient: availableBaseStock >= baseQuantity,
    requiredBase: baseQuantity,
    availableBase: availableBaseStock,
    deficit: Math.max(0, baseQuantity - availableBaseStock),
  };

};


/**
 * Round helper
 */
export const round = (value, precision = 2) => {

  const factor = Math.pow(10, precision);

  return Math.round(value * factor) / factor;

};