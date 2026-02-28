import mongoose from "mongoose";
import SalesInvoice from "../models/SalesInvoice.js";
import InventoryItem from "../models/InventoryItem.js";
import InventoryBatch from "../models/InventoryBatch.js";

import * as journalService from "./journalService.js";
import * as stockService from "./stockService.js";
import * as taxService from "./taxService.js";
import * as auditService from "./auditService.js";

import {
  INVOICE_STATE,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  REFERENCE_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

export async function postSalesInvoice({
  organizationId,
  invoiceId,
  user,
  ipAddress = "",
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ───────────────────────────────────────────────
    // 1️⃣ Load + Validate
    // ───────────────────────────────────────────────
    const invoice = await SalesInvoice.findOne({
      _id: invoiceId,
      organizationId,
    }).session(session);

    if (!invoice) throw new Error(MSG.INVOICE_NOT_FOUND);

    if (invoice.invoiceState !== INVOICE_STATE.APPROVED) {
      throw new Error(
        MSG.INVOICE_CANNOT_TRANSITION(
          invoice.invoiceState,
          INVOICE_STATE.POSTED
        )
      );
    }

    if (!invoice.items.length)
      throw new Error("Sales invoice has no items.");

    const beforeSnapshot = invoice.toObject();

    // ───────────────────────────────────────────────
    // 2️⃣ Recalculate totals (security)
    // ───────────────────────────────────────────────
    const recalc = taxService.calculateInvoiceTotals(invoice.items);

    const tolerance = 0.05;
    if (Math.abs(recalc.grandTotal - invoice.grandTotal) > tolerance) {
      throw new Error(
        `Invoice total mismatch. Stored ₹${invoice.grandTotal}, Calculated ₹${recalc.grandTotal}`
      );
    }

    // ───────────────────────────────────────────────
    // 3️⃣ FIFO Stock Deduction + COGS Calculation
    // ───────────────────────────────────────────────
    let totalCOGS = 0;

    for (const line of invoice.items) {
      const item = await InventoryItem.findOne({
        _id: line.item_id,
        organizationId,
      }).session(session);

      if (!item) throw new Error(MSG.NOT_FOUND("Inventory Item"));

      let qtyToDeduct = line.quantity;
      let costForLine = 0;

      const batches = await InventoryBatch.find({
        organizationId,
        item_id: item._id,
        remainingQuantity: { $gt: 0 },
      })
        .sort({ receivedDate: 1 }) // FIFO
        .session(session);

      for (const batch of batches) {
        if (qtyToDeduct <= 0) break;

        const deductQty = Math.min(batch.remainingQuantity, qtyToDeduct);

        costForLine += deductQty * batch.unitCost;

        batch.remainingQuantity -= deductQty;
        await batch.save({ session });

        qtyToDeduct -= deductQty;
      }

      if (qtyToDeduct > 0)
        throw new Error(
          `Insufficient stock for item ${line.itemName}`
        );

      // Save cost snapshot
      line.costAmountSnapshot = costForLine;
      line.costPriceSnapshot = costForLine / line.quantity;

      totalCOGS += costForLine;

      // Reduce total inventory quantity (optional if maintained)
      await stockService.stockOut({
        organizationId,
        item_id: item._id,
        quantity: line.quantity,
        referenceType: REFERENCE_TYPE.SALES,
        reference_id: invoice._id,
        notes: `Sales invoice ${invoice.invoiceNumber}`,
        user,
        session,
      });
    }

    // ───────────────────────────────────────────────
    // 4️⃣ Revenue Journal Entry
    // ───────────────────────────────────────────────
   // ───────────────────────────────────────────────
// 4️⃣ Revenue Journal Entry (Marg Style)
// ───────────────────────────────────────────────
const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

// Determine Debit Account Based on Payment Mode
let debitAccount;

if (invoice.paymentMode === "CREDIT") {
  debitAccount = DEFAULT_LEDGER_CODES.ACCOUNTS_RECEIVABLE;
} else if (invoice.paymentMode === "CASH") {
  debitAccount = DEFAULT_LEDGER_CODES.CASH;
} else {
  // BANK or UPI
  debitAccount = DEFAULT_LEDGER_CODES.BANK;
}

const revenueLines = [
  {
    accountCode: debitAccount,
    entryType: DEBIT,
    amount: invoice.grandTotal,
    description: `Invoice ${invoice.invoiceNumber}`,
  },
  {
    accountCode: DEFAULT_LEDGER_CODES.SALES_REVENUE,
    entryType: CREDIT,
    amount: invoice.subtotal,
    description: `Sales Revenue`,
  },
];

if (invoice.taxBreakdown.cgst > 0) {
  revenueLines.push({
    accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST,
    entryType: CREDIT,
    amount: invoice.taxBreakdown.cgst,
    description: "CGST Output",
  });
}

if (invoice.taxBreakdown.sgst > 0) {
  revenueLines.push({
    accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST,
    entryType: CREDIT,
    amount: invoice.taxBreakdown.sgst,
    description: "SGST Output",
  });
}

if (invoice.taxBreakdown.igst > 0) {
  revenueLines.push({
    accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_IGST,
    entryType: CREDIT,
    amount: invoice.taxBreakdown.igst,
    description: "IGST Output",
  });
}

const revenueJournal = await journalService.createEntry({
  organizationId,
  referenceType: JOURNAL_REFERENCE_TYPE.SALES_INVOICE,
  reference_id: invoice._id,
  referenceNumber: invoice.invoiceNumber,
  lines: revenueLines,
  narration: `Sales Invoice Posted: ${invoice.invoiceNumber}`,
  user,
  session,
});

    // ───────────────────────────────────────────────
    // 5️⃣ COGS Journal Entry
    // ───────────────────────────────────────────────
    await journalService.createEntry({
      organizationId,
      referenceType: JOURNAL_REFERENCE_TYPE.SALES_INVOICE,
      reference_id: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      lines: [
        {
          accountCode: DEFAULT_LEDGER_CODES.COGS_EXPENSE,
          entryType: DEBIT,
          amount: totalCOGS,
          description: `COGS for ${invoice.invoiceNumber}`,
        },
        {
          accountCode: DEFAULT_LEDGER_CODES.INVENTORY_ASSET,
          entryType: CREDIT,
          amount: totalCOGS,
          description: `Inventory reduction`,
        },
      ],
      narration: `COGS Entry: ${invoice.invoiceNumber}`,
      user,
      session,
    });

    // ───────────────────────────────────────────────
    // 6️⃣ Update Invoice
    // ───────────────────────────────────────────────
   // ───────────────────────────────────────────────
// 6️⃣ Update Invoice (Marg Style Payment Handling)
// ───────────────────────────────────────────────
invoice.invoiceState = INVOICE_STATE.POSTED;
invoice.postedBy = user._id;
invoice.postedAt = new Date();
invoice.journalEntry_id = revenueJournal._id;

// Auto-set payment fields
if (invoice.paymentMode === "CREDIT") {
  invoice.paidAmount = 0;
  invoice.outstandingAmount = invoice.grandTotal;
  invoice.paymentStatus = "UNPAID";
} else {
  invoice.paidAmount = invoice.grandTotal;
  invoice.outstandingAmount = 0;
  invoice.paymentStatus = "PAID";
  invoice.paymentDate = new Date();
}

invoice.stateLog.push({
  from: INVOICE_STATE.APPROVED,
  to: INVOICE_STATE.POSTED,
  by: user._id,
  note: "Sales invoice posted",
});

await invoice.save({ session });

    // ───────────────────────────────────────────────
    // 7️⃣ Audit
    // ───────────────────────────────────────────────
    await auditService.log({
      organizationId,
      entityType: AUDIT_ENTITY_TYPE.SALES_INVOICE,
      entity_id: invoice._id,
      entityReference: invoice.invoiceNumber,
      action: AUDIT_ACTION.POSTED,
      description: `Sales invoice ${invoice.invoiceNumber} posted`,
      before: beforeSnapshot,
      after: invoice.toObject(),
      user,
      ipAddress,
      session,
    });

    await session.commitTransaction();

    return invoice;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}