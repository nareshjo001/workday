const pmTimesheetService = require("../services/pmTimesheetService");
const {
  validateTimesheetIdParam,
  validateReviewTimesheet,
} = require("../validators/pmTimesheetValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting PM's identity here — pm_id is never read
 * from the request body or params.
 */

const listPending = asyncHandler(async (req, res) => {
  const timesheets = await pmTimesheetService.listPending(req.user.userId);
  res.status(200).json(timesheets);
});

const review = asyncHandler(async (req, res) => {
  const timesheetId = validateTimesheetIdParam(req.params);
  const { status } = validateReviewTimesheet(req.body);
  const timesheet = await pmTimesheetService.reviewTimesheet(req.user.userId, timesheetId, status);
  res.status(200).json(timesheet);
});

module.exports = { listPending, review };
