/**
 * @controller salesReportController.js
 * @description Sales reporting endpoints.
 */

import { asyncHandler } from "../utils/asyncHandler.js";
import * as salesReportService from "../services/salesReportService.js";


// ── Sales Summary ───────────────────────────────────────

export const getSalesSummary = asyncHandler(async (req, res) => {

  const result = await salesReportService.getSalesSummary(
    req.user.organizationId,
    req.query
  );

  res.json({
    success: true,
    data: result,
  });

});


// ── GST Report ──────────────────────────────────────────

export const getGSTReport = asyncHandler(async (req, res) => {

  const result = await salesReportService.getGSTReport(
    req.user.organizationId,
    req.query
  );

  res.json({
    success: true,
    data: result,
  });

});


// ── Receivable Aging ────────────────────────────────────

export const getReceivableAging = asyncHandler(async (req, res) => {

  const result = await salesReportService.getReceivableAging(
    req.user.organizationId
  );

  res.json({
    success: true,
    data: result,
  });

});


// ── Customer Ledger ─────────────────────────────────────

export const getCustomerLedger = asyncHandler(async (req, res) => {

  const result = await salesReportService.getCustomerLedger(
    req.user.organizationId,
    req.params.customerId,
    req.query
  );

  res.json({
    success: true,
    data: result,
  });

});


// ── Daily Collection ────────────────────────────────────

export const getDailyCollection = asyncHandler(async (req, res) => {

  const result = await salesReportService.getDailyCollection(
    req.user.organizationId,
    req.query
  );

  res.json({
    success: true,
    data: result,
  });

});