/**
 * @service salesInvoicePostingService.js
 * @description Handles the APPROVED → POSTED transition for sales invoices.
 */

import mongoose from "mongoose";
import SalesInvoice from "../models/SalesInvoice.js";

import * as journalService from "./journalService.js";
import * as stockService from "./stockService.js";
import * as auditService from "./auditService.js";

import {
  SALES_INVOICE_STATE,
  SALES_CATEGORY,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  REFERENCE_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";

import { MSG } from "../constants/messages.js";

/**
 * Maps sales category to the appropriate revenue ledger code.
 */
function getRevenueLedgerCode(category) {
  switch (category) {
    case SALES_CATEGORY.ROOM:
      return DEFAULT_LEDGER_CODES.ROOM_REVENUE;

    case SALES_CATEGORY.FNB:
    case SALES_CATEGORY.MINIBAR:
      return DEFAULT_LEDGER_CODES.FB_REVENUE;

    default:
      return DEFAULT_LEDGER_CODES.OTHER_REVENUE;
  }
}


/**
 * Posts a sales invoice atomically.
 */
export const postSalesInvoice = async ({
  organizationId,
  invoiceId,
  user,
  ipAddress = "",
}) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    // ── Step 1: Load and validate ────────────────────────────────
    const invoice = await SalesInvoice
      .findOne({ _id: invoiceId, organizationId })
      .session(session);

    if (!invoice) throw new Error("Sales invoice not found.");

    if (invoice.invoiceState !== SALES_INVOICE_STATE.APPROVED) {
      throw new Error(
        `Cannot post invoice in ${invoice.invoiceState} state. Must be APPROVED.`
      );
    }

    if (!invoice.items || invoice.items.length === 0) {
      throw new Error("Sales invoice has no line items.");
    }

    const beforeSnapshot = invoice.toObject();


    // ── Step 2: Stock deduction for inventory items ───────────────
    for (const lineItem of invoice.items) {

      if (lineItem.deductStock && lineItem.item_id) {

        await stockService.stockOut({
          organizationId,
          item_id: lineItem.item_id,
          quantity: lineItem.quantity,
          referenceType: REFERENCE_TYPE.ROOM_USAGE,
          reference_id: invoice._id,
          notes: `Sales posting: ${invoice.invoiceNumber} – ${lineItem.description}`,
          user,
          session,
        });

      }

    }


    // ── Step 3: Build journal lines ──────────────────────────────
    const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

    const journalLines = [];


    // Dr Accounts Receivable
    journalLines.push({
      accountCode: DEFAULT_LEDGER_CODES.ACCOUNTS_RECEIVABLE,
      entryType: DEBIT,
      amount: invoice.grandTotal,
      description: `Receivable from ${invoice.customerName}: ${invoice.invoiceNumber}`,
    });


    // Cr Revenue by category
    const revenueByCode = {};

    for (const item of invoice.items) {

      const code = getRevenueLedgerCode(item.category);

      revenueByCode[code] =
        (revenueByCode[code] || 0) + item.taxableAmount;

    }

    for (const [code, amount] of Object.entries(revenueByCode)) {

      if (amount > 0) {

        journalLines.push({
          accountCode: code,
          entryType: CREDIT,
          amount: parseFloat(amount.toFixed(2)),
          description: `Revenue: ${invoice.invoiceNumber}`,
        });

      }

    }


    // Cr GST
    if (invoice.taxBreakdown.cgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST,
        entryType: CREDIT,
        amount: invoice.taxBreakdown.cgst,
        description: `Output CGST: ${invoice.invoiceNumber}`,
      });
    }

    if (invoice.taxBreakdown.sgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST,
        entryType: CREDIT,
        amount: invoice.taxBreakdown.sgst,
        description: `Output SGST: ${invoice.invoiceNumber}`,
      });
    }

    if (invoice.taxBreakdown.igst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_IGST,
        entryType: CREDIT,
        amount: invoice.taxBreakdown.igst,
        description: `Output IGST: ${invoice.invoiceNumber}`,
      });
    }


    // ── Step 4: Create journal entry ─────────────────────────────
    const journalEntry = await journalService.createEntry({
      organizationId,
      referenceType: JOURNAL_REFERENCE_TYPE.SALES_INVOICE,
      reference_id: invoice._id,
      referenceNumber: invoice.invoiceNumber,
      lines: journalLines,
      narration: `Sales invoice posted: ${invoice.invoiceNumber} | Customer: ${invoice.customerName}`,
      user,
      session,
    });


    // ── Step 5: Update invoice state ─────────────────────────────
    await SalesInvoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          invoiceState: SALES_INVOICE_STATE.POSTED,
          journalEntry_id: journalEntry._id,
          outstandingAmount: invoice.grandTotal,
          postedBy: user._id,
          postedAt: new Date(),
          updatedBy: user._id,
        },

        $push: {
          stateLog: {
            from: SALES_INVOICE_STATE.APPROVED,
            to: SALES_INVOICE_STATE.POSTED,
            by: user._id,
            at: new Date(),
            note: "Invoice posted — ledger and stock updated",
          },
        },
      },
      { session }
    );


    // ── Step 6: Audit log ────────────────────────────────────────
    await auditService.log({
      organizationId,
      entityType: AUDIT_ENTITY_TYPE.SALES_INVOICE,
      entity_id: invoice._id,
      entityReference: invoice.invoiceNumber,
      action: AUDIT_ACTION.POSTED,
      description: `Sales invoice ${invoice.invoiceNumber} posted. Journal: ${journalEntry.entryNumber}`,
      before: beforeSnapshot,
      after: {
        invoiceState: SALES_INVOICE_STATE.POSTED,
        journalEntry_id: journalEntry._id,
      },
      user,
      ipAddress,
      session,
    });


    // ── Step 7: Commit transaction ───────────────────────────────
    await session.commitTransaction();

    return SalesInvoice
      .findById(invoice._id)
      .populate("customer_id", "name email phone");

  } catch (err) {

    await session.abortTransaction();
    throw err;

  } finally {

    session.endSession();

  }

};