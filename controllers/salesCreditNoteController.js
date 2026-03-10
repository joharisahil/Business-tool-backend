/**
 * @controller salesCreditNoteController.js
 * @description Credit notes against posted sales invoices.
 *              Generates reversal journal: Revenue Dr / AR Cr.
 */

import mongoose from "mongoose";

import { asyncHandler } from "../utils/asyncHandler.js";

import SalesCreditNote from "../models/SalesCreditNote.js";
import SalesInvoice from "../models/SalesInvoice.js";

import * as journalService from "../services/journalService.js";
import * as stockService from "../services/stockService.js";
import * as auditService from "../services/auditService.js";

import {
  SALES_INVOICE_STATE,
  JOURNAL_REFERENCE_TYPE,
  JOURNAL_ENTRY_TYPE,
  DEFAULT_LEDGER_CODES,
  REFERENCE_TYPE,
  AUDIT_ENTITY_TYPE,
  AUDIT_ACTION,
} from "../constants/enums.js";


// ── Generate Credit Note Number ───────────────────────────

async function generateSCNNumber(organizationId) {
  const year = new Date().getFullYear();
  const prefix = `SCN-${year}-`;

  const last = await SalesCreditNote
    .findOne({ organizationId, creditNoteNumber: { $regex: `^${prefix}` } })
    .sort({ creditNoteNumber: -1 })
    .select("creditNoteNumber");

  let seq = 1;

  if (last) {
    const parts = last.creditNoteNumber.split("-");
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}


// ── Create Sales Credit Note ──────────────────────────────

export const createSalesCreditNote = asyncHandler(async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    const { invoice_id, items, reason } = req.body;
    const organizationId = req.user.organizationId;

    const invoice = await SalesInvoice
      .findOne({ _id: invoice_id, organizationId })
      .session(session);

    if (!invoice) {
      throw new Error("Sales invoice not found.");
    }

    if (invoice.invoiceState !== SALES_INVOICE_STATE.POSTED) {
      throw new Error("Credit notes can only be created against POSTED invoices.");
    }


    // ── Calculate totals ─────────────────────────

    let subtotal = 0;

    const taxBreakdown = {
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
    };

    const processedItems = items.map((item) => {

      const taxable = item.quantity * item.unitPrice;

      const halfRate = (item.gstPercentage || 0) / 2;

      const cgst = parseFloat((taxable * halfRate / 100).toFixed(2));
      const sgst = parseFloat((taxable * halfRate / 100).toFixed(2));
      const igst = 0;

      const total = taxable + cgst + sgst + igst;

      subtotal += taxable;
      taxBreakdown.cgst += cgst;
      taxBreakdown.sgst += sgst;
      taxBreakdown.totalTax += cgst + sgst + igst;

      return {
        ...item,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: parseFloat(total.toFixed(2)),
      };
    });


    const grandTotal = parseFloat(
      (subtotal + taxBreakdown.totalTax).toFixed(2)
    );

    const creditNoteNumber = await generateSCNNumber(organizationId);


    // ── Journal Entry ─────────────────────────────

    const { DEBIT, CREDIT } = JOURNAL_ENTRY_TYPE;

    const journalLines = [
      {
        accountCode: DEFAULT_LEDGER_CODES.OTHER_REVENUE,
        entryType: DEBIT,
        amount: parseFloat(subtotal.toFixed(2)),
        description: `Sales CN reversal: ${creditNoteNumber}`,
      },
    ];

    if (taxBreakdown.cgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_CGST,
        entryType: DEBIT,
        amount: taxBreakdown.cgst,
        description: `CGST reversal: ${creditNoteNumber}`,
      });
    }

    if (taxBreakdown.sgst > 0) {
      journalLines.push({
        accountCode: DEFAULT_LEDGER_CODES.GST_OUTPUT_SGST,
        entryType: DEBIT,
        amount: taxBreakdown.sgst,
        description: `SGST reversal: ${creditNoteNumber}`,
      });
    }

    journalLines.push({
      accountCode: DEFAULT_LEDGER_CODES.ACCOUNTS_RECEIVABLE,
      entryType: CREDIT,
      amount: grandTotal,
      description: `AR reversal: ${creditNoteNumber}`,
    });


    const journalEntry = await journalService.createEntry({
      organizationId,
      referenceType: JOURNAL_REFERENCE_TYPE.SALES_CREDIT_NOTE,
      reference_id: invoice._id,
      referenceNumber: creditNoteNumber,
      lines: journalLines,
      narration: `Sales credit note ${creditNoteNumber} against ${invoice.invoiceNumber}`,
      user: req.user,
      session,
    });


    // ── Restore Stock ─────────────────────────────

    for (const item of processedItems) {

      if (item.restoreStock && item.item_id) {

        await stockService.stockIn({
          organizationId,
          item_id: item.item_id,
          quantity: item.quantity,
          referenceType: REFERENCE_TYPE.CREDIT_NOTE,
          reference_id: invoice._id,
          notes: `Stock restored: ${creditNoteNumber}`,
          user: req.user,
          session,
        });

      }
    }


    // ── Create Credit Note ───────────────────────

    const creditNote = await SalesCreditNote.create([{
      organizationId,
      creditNoteNumber,
      originalInvoice_id: invoice._id,
      originalInvoiceNumber: invoice.invoiceNumber,
      customer_id: invoice.customer_id,
      customerName: invoice.customerName,
      items: processedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxBreakdown,
      grandTotal,
      reason,
      journalEntry_id: journalEntry._id,
      createdBy: req.user._id,
    }], { session });


    await auditService.log({
      organizationId,
      entityType: AUDIT_ENTITY_TYPE.SALES_CREDIT_NOTE,
      entity_id: creditNote[0]._id,
      entityReference: creditNoteNumber,
      action: AUDIT_ACTION.CREATED,
      description: `Sales credit note ${creditNoteNumber} created for ₹${grandTotal} against ${invoice.invoiceNumber}`,
      after: creditNote[0].toObject(),
      user: req.user,
      ipAddress: req.ip,
      session,
    });


    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: creditNote[0],
    });

  } catch (err) {

    await session.abortTransaction();
    throw err;

  } finally {

    session.endSession();

  }

});


// ── List Credit Notes ─────────────────────────────────────

export const listSalesCreditNotes = asyncHandler(async (req, res) => {

  const { customer_id, fromDate, toDate, page = 1, limit = 50 } = req.query;

  const filter = { organizationId: req.user.organizationId };

  if (customer_id) filter.customer_id = customer_id;

  if (fromDate || toDate) {

    filter.createdAt = {};

    if (fromDate) filter.createdAt.$gte = new Date(fromDate);
    if (toDate) filter.createdAt.$lte = new Date(toDate);

  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [data, total] = await Promise.all([

    SalesCreditNote
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name"),

    SalesCreditNote.countDocuments(filter),

  ]);

  res.json({
    success: true,
    data,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });

});