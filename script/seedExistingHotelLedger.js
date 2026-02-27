import mongoose from "mongoose";
import dotenv from "dotenv";
import { seedLedgerAccountsForHotel } from "../services/ledgerService.js";

dotenv.config();

const MONGO = process.env.MONGO_URI_PRODUCTION;

// ✅ PUT REAL VALUES HERE
const ORGANIZATION_ID = "69a14abb754e6ae0e481daa8";
const ADMIN_USER_ID = "69a14abb754e6ae0e481daaa";

const run = async () => {
  try {
    await mongoose.connect(MONGO);
    console.log("Mongo connected ✅");

    await seedLedgerAccountsForHotel(
      ORGANIZATION_ID,
      ADMIN_USER_ID
    );

    console.log("Ledger accounts seeded successfully ✅");
    process.exit();
  } catch (err) {
    console.error("Seeding failed ❌", err);
    process.exit(1);
  }
};

run();