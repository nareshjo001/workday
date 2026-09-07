const contractorTimesheetService = require("../services/contractorTimesheetService");
const {
  validateSubmitTimesheet,
  validateTimesheetIdParam,
  validateEditTimesheet,
} = require("../validators/contractorTimesheetValidators");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, isoDateFilter } = require("../utils/listQuery");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting contractor's identity here — contractor_id
 * is never read from the request body or params.
 */

const submit = asyncHandler(async (req, res) => {
  const payload = validateSubmitTimesheet(req.body);
  const timesheet = await contractorTimesheetService.submitTimesheet(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(201).json(timesheet);
});

const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, { allowedSorts: { default: "t.work_date", work_date: "t.work_date", status: "t.status", submitted_at: "t.submitted_at" }, allowedFilters: { status: (v) => { const x = String(v).toUpperCase(); if (!["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(x)) throw require("../utils/ApiError").badRequest("Unsupported timesheet status."); return x; }, projectId: (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw require("../utils/ApiError").badRequest("projectId must be a positive integer."); return n; }, startDate: isoDateFilter } });
  res.status(200).json(await contractorTimesheetService.listMyTimesheetsPage(req.user.userId, query));
});

/**
 * PATCH /api/contractor/timesheets/:id — edit one of the contractor's
 * own REJECTED daily logs. See contractorTimesheetService.updateTimesheet
 * for the full rule set (ownership, status, project/date re-validation).
 */
const update = asyncHandler(async (req, res) => {
  const timesheetId = validateTimesheetIdParam(req.params);
  const payload = validateEditTimesheet(req.body);
  const timesheet = await contractorTimesheetService.updateTimesheet(
    req.user.userId,
    timesheetId,
    payload,
    { ...req.user, requestId: req.requestId }
  );
  res.status(200).json(timesheet);
});

const submitSelected = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.timesheetIds) ? req.body.timesheetIds.map(Number) : [];
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1)) throw require("../utils/ApiError").badRequest("timesheetIds must be a non-empty list of positive integers.");
  res.status(200).json(await contractorTimesheetService.submitTimesheets(req.user.userId, ids, { ...req.user, requestId: req.requestId }));
});

module.exports = { submit, submitSelected, list, update };
