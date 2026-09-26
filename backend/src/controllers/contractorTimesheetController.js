const contractorTimesheetService = require("../services/contractorTimesheetService");
const {
  validateSubmitTimesheet,
  validateTimesheetIdParam,
  validateEditTimesheet,
} = require("../validators/contractorTimesheetValidators");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, isoDateFilter } = require("../utils/listQuery");

// Derive contractor identity from the verified JWT, never body or route fields.

const submit = asyncHandler(async (req, res) => {
  const payload = validateSubmitTimesheet(req.body);
  const timesheet = await contractorTimesheetService.submitTimesheet(req.user.userId, payload, { ...req.user, requestId: req.requestId });
  res.status(201).json(timesheet);
});

const list = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, {
    defaultPageSize: 5,
    allowedSorts: { default: "t.work_date", work_date: "t.work_date", status: "t.status", submitted_at: "t.submitted_at" },
    allowedFilters: {
      status: (v) => {
        const x = String(v).toUpperCase();
        if (!["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].includes(x)) throw require("../utils/ApiError").badRequest("Unsupported timesheet status.");
        return x;
      },
      projectId: (v) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1) throw require("../utils/ApiError").badRequest("projectId must be a positive integer.");
        return n;
      },
      startDate: isoDateFilter,
    },
  });
  res.status(200).json(await contractorTimesheetService.listMyTimesheetsPage(req.user.userId, query));
});

// Edit the contractor's own draft or rejected log using the service's lifecycle checks.
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
