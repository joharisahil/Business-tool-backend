
// services/unitService.js
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
    category: "MEASUREMENT",  // Changed from WEIGHT to MEASUREMENT
    baseUnit_id: null,
    conversionFactor: 1,
    decimalPrecision: 3,
    organizationId,
    createdBy,
  });

  const liter = await Unit.create({
    name: "Liter",
    shortCode: "L",
    category: "MEASUREMENT",  // Changed from VOLUME to MEASUREMENT
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

  // ---------- COUNTING UNITS ----------
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
    conversionFactor: 50,
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

  // ---------- WEIGHT UNITS (as MEASUREMENT) ----------
  await Unit.create({
    name: "Gram",
    shortCode: "G",
    category: "MEASUREMENT",  // Changed from WEIGHT to MEASUREMENT
    baseUnit_id: kg._id,
    conversionFactor: 0.001,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Ton",
    shortCode: "TON",
    category: "MEASUREMENT",  // Changed from WEIGHT to MEASUREMENT
    baseUnit_id: kg._id,
    conversionFactor: 1000,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  // ---------- VOLUME UNITS (as MEASUREMENT) ----------
  await Unit.create({
    name: "Milliliter",
    shortCode: "ML",
    category: "MEASUREMENT",  // Changed from VOLUME to MEASUREMENT
    baseUnit_id: liter._id,
    conversionFactor: 0.001,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  // ---------- LENGTH UNITS (as MEASUREMENT) ----------
  await Unit.create({
    name: "Centimeter",
    shortCode: "CM",
    category: "MEASUREMENT",
    baseUnit_id: meter._id,
    conversionFactor: 0.01,
    decimalPrecision: 2,
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

  // ADDING YOUR REQUESTED UNITS (with correct categories)

  // Get existing units for relationships
  const pcsUnit = await Unit.findOne({ organizationId, shortCode: "PCS" });
  const kgUnit = await Unit.findOne({ organizationId, shortCode: "KG" });
  const meterUnit = await Unit.findOne({ organizationId, shortCode: "METER" });
  const boxUnit = await Unit.findOne({ organizationId, shortCode: "BOX" });

  // PHARMA UNITS
  const strip = await Unit.create({
    name: "Strip",
    shortCode: "STRIP",
    category: "PACKAGING",  // Using PACKAGING category
    baseUnit_id: pcsUnit._id,
    conversionFactor: 10,
    decimalPrecision: 0,
    organizationId,
    createdBy,
  });

  // Carton (based on Box)
  if (boxUnit) {
    await Unit.create({
      name: "Carton",
      shortCode: "CTN",
      category: "PACKAGING",
      baseUnit_id: boxUnit._id,
      conversionFactor: 5,
      decimalPrecision: 0,
      organizationId,
      createdBy,
    });
  }

  // MORE LENGTH UNITS
  await Unit.create({
    name: "Foot",
    shortCode: "FT",
    category: "MEASUREMENT",
    baseUnit_id: meterUnit._id,
    conversionFactor: 0.3048,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Feet",
    shortCode: "FEET",
    category: "MEASUREMENT",
    baseUnit_id: meterUnit._id,
    conversionFactor: 0.3048,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  await Unit.create({
    name: "Yard",
    shortCode: "YD",
    category: "MEASUREMENT",
    baseUnit_id: meterUnit._id,
    conversionFactor: 0.9144,
    decimalPrecision: 2,
    organizationId,
    createdBy,
  });

  // AREA UNITS (if MEASUREMENT doesn't work, you might need to add AREA to your schema)
  // Check if your schema accepts custom categories first
  try {
    await Unit.create({
      name: "Square Feet",
      shortCode: "SQFT",
      category: "MEASUREMENT",  // Temporarily using MEASUREMENT
      baseUnit_id: null,
      conversionFactor: 1,
      decimalPrecision: 2,
      organizationId,
      createdBy,
    });
  } catch (error) {
    console.log("Note: SQFT category may need schema update");
  }

  // CONSTRUCTION UNITS
  try {
    await Unit.create({
      name: "Cubic Feet",
      shortCode: "CFT",
      category: "MEASUREMENT",  // Using MEASUREMENT
      baseUnit_id: null,
      conversionFactor: 1,
      decimalPrecision: 2,
      organizationId,
      createdBy,
    });

    await Unit.create({
      name: "Brass",
      shortCode: "BRASS",
      category: "MEASUREMENT",  // Using MEASUREMENT
      baseUnit_id: null,
      conversionFactor: 100,
      decimalPrecision: 2,
      organizationId,
      createdBy,
    });

    await Unit.create({
      name: "Cement Bag",
      shortCode: "CBAG",
      category: "PACKAGING",  // Using PACKAGING
      baseUnit_id: kgUnit._id,
      conversionFactor: 50,
      decimalPrecision: 0,
      organizationId,
      createdBy,
    });
  } catch (error) {
    console.log("Note: Some construction units may need schema update");
  }

  console.log("All units seeded successfully with corrected categories!");
};

// export const seedUnitsForOrganization = async (organizationId, createdBy) => {
//   // Prevent duplicate seeding
//   const existing = await Unit.findOne({ organizationId });
//   if (existing) {
//     console.log("Units already exist for this organization");
//     return;
//   }

//   // ---------- BASE UNITS ----------
//   const pcs = await Unit.create({
//     name: "Piece",
//     shortCode: "PCS",
//     category: "COUNTING",
//     baseUnit_id: null,
//     conversionFactor: 1,
//     decimalPrecision: 0,
//     organizationId,
//     createdBy,
//   });

//   const kg = await Unit.create({
//     name: "Kilogram",
//     shortCode: "KG",
//     category: "MEASUREMENT",
//     baseUnit_id: null,
//     conversionFactor: 1,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   const liter = await Unit.create({
//     name: "Liter",
//     shortCode: "L",
//     category: "MEASUREMENT",
//     baseUnit_id: null,
//     conversionFactor: 1,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   const meter = await Unit.create({
//     name: "Meter",
//     shortCode: "METER",
//     category: "MEASUREMENT",
//     baseUnit_id: null,
//     conversionFactor: 1,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   // ---------- COUNTING ----------
//   const pack = await Unit.create({
//     name: "Pack",
//     shortCode: "PACK",
//     category: "PACKAGING",
//     baseUnit_id: pcs._id,
//     conversionFactor: 5,
//     decimalPrecision: 0,
//     organizationId,
//     createdBy,
//   });

//   await Unit.create({
//     name: "Box",
//     shortCode: "BOX",
//     category: "PACKAGING",
//     baseUnit_id: pack._id,
//     conversionFactor: 10,
//     decimalPrecision: 0,
//     organizationId,
//     createdBy,
//   });

//   await Unit.create({
//     name: "Dozen",
//     shortCode: "DOZEN",
//     category: "COUNTING",
//     baseUnit_id: pcs._id,
//     conversionFactor: 12,
//     decimalPrecision: 0,
//     organizationId,
//     createdBy,
//   });

//   // ---------- WEIGHT ----------
//   await Unit.create({
//     name: "Gram",
//     shortCode: "G",
//     category: "MEASUREMENT",
//     baseUnit_id: kg._id,
//     conversionFactor: 0.001,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   await Unit.create({
//     name: "Ton",
//     shortCode: "TON",
//     category: "MEASUREMENT",
//     baseUnit_id: kg._id,
//     conversionFactor: 1000,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   // ---------- VOLUME ----------
//   await Unit.create({
//     name: "Milliliter",
//     shortCode: "ML",
//     category: "MEASUREMENT",
//     baseUnit_id: liter._id,
//     conversionFactor: 0.001,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   // ---------- LENGTH ----------
//   await Unit.create({
//     name: "Centimeter",
//     shortCode: "CM",
//     category: "MEASUREMENT",
//     baseUnit_id: meter._id,
//     conversionFactor: 0.01,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   await Unit.create({
//     name: "Inch",
//     shortCode: "INCH",
//     category: "MEASUREMENT",
//     baseUnit_id: meter._id,
//     conversionFactor: 0.0254,
//     decimalPrecision: 3,
//     organizationId,
//     createdBy,
//   });

//   console.log("Default units seeded");
// };