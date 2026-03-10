import Unit from "../models/Unit.js";

export const seedUnitsForOrganization = async (organizationId, createdBy) => {
  // Prevent duplicate seeding
  const existing = await Unit.findOne({ organizationId });
  if (existing) {
    console.log("Units already exist for this organization");
    return;
  }

  // ---------- BASE UNITS ----------
  const pcs = await Unit.create({
    name: "Piece",
    shortCode: "PCS",
    category: "COUNTING",
    baseUnit_id: null,
    conversionFactor: 1,
    decimalPrecision: 0,
    organizationId,
    createdBy,
  });

  const kg = await Unit.create({
    name: "Kilogram",
    shortCode: "KG",
    category: "MEASUREMENT",
    baseUnit_id: null,
    conversionFactor: 1,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  const liter = await Unit.create({
    name: "Liter",
    shortCode: "L",
    category: "MEASUREMENT",
    baseUnit_id: null,
    conversionFactor: 1,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  const meter = await Unit.create({
    name: "Meter",
    shortCode: "METER",
    category: "MEASUREMENT",
    baseUnit_id: null,
    conversionFactor: 1,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  // ---------- COUNTING ----------
  const pack = await Unit.create({
    name: "Pack",
    shortCode: "PACK",
    category: "PACKAGING",
    baseUnit_id: pcs._id,
    conversionFactor: 5,
    decimalPrecision: 0,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Box",
    shortCode: "BOX",
    category: "PACKAGING",
    baseUnit_id: pack._id,
    conversionFactor: 10,
    decimalPrecision: 0,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Dozen",
    shortCode: "DOZEN",
    category: "COUNTING",
    baseUnit_id: pcs._id,
    conversionFactor: 12,
    decimalPrecision: 0,
    organizationId,
    createdBy,
  });

  // ---------- WEIGHT ----------
  await Unit.create({
    name: "Gram",
    shortCode: "G",
    category: "MEASUREMENT",
    baseUnit_id: kg._id,
    conversionFactor: 0.001,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Ton",
    shortCode: "TON",
    category: "MEASUREMENT",
    baseUnit_id: kg._id,
    conversionFactor: 1000,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  // ---------- VOLUME ----------
  await Unit.create({
    name: "Milliliter",
    shortCode: "ML",
    category: "MEASUREMENT",
    baseUnit_id: liter._id,
    conversionFactor: 0.001,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  // ---------- LENGTH ----------
  await Unit.create({
    name: "Centimeter",
    shortCode: "CM",
    category: "MEASUREMENT",
    baseUnit_id: meter._id,
    conversionFactor: 0.01,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Inch",
    shortCode: "INCH",
    category: "MEASUREMENT",
    baseUnit_id: meter._id,
    conversionFactor: 0.0254,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  console.log("Default units seeded");
};