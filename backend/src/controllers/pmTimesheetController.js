const pmTimesheetService = require("../services/pmTimesheetService");
const {
  validateTimesheetIdParam,
  validateReviewTimesheet,
} = require("../validators/pmTimesheetValidators");
const asyncHandler = require("../utils/asyncHandler");
const { parseListQuery, positiveIntegerFilter, isoDateFilter } = require("../utils/listQuery");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body or params.
 */

const listPending = asyncHandler(async (req, res) => {
  const query = parseListQuery(req.query, {
    allowedSorts: { default: "t.submitted_at", submitted_at: "t.submitted_at", work_date: "t.work_date", project: "p.name", contractor: "u.name" },
    allowedFilters: { projectId: positiveIntegerFilter, startDate: isoDateFilter, search: (value) => String(value).trim().slice(0, 100) },
  });
  res.status(200).json(await pmTimesheetService.listPendingPage(req.user.userId, query));
});

const review = asyncHandler(async (req, res) => {
  const timesheetId = validateTimesheetIdParam(req.params);
  const { status } = validateReviewTimesheet(req.body);
  const timesheet = await pmTimesheetService.reviewTimesheet(req.user.userId, timesheetId, status, { ...req.user, requestId: req.requestId });
  res.status(200).json(timesheet);
});

module.exports = { listPending, review };
