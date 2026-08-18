const contractorTimesheetService = require("../services/contractorTimesheetService");
const {
  validateSubmitTimesheet,
  validateTimesheetIdParam,
  validateEditTimesheet,
} = require("../validators/contractorTimesheetValidators");
const asyncHandler = require("../utils/asyncHandler");

/**
 * `req.user.userId` (set by `authenticate` from the verified JWT) is the
 * ONLY source of the acting contractor's identity here — contractor_id
 * is never read from the request body or params.
 */

const submit = asyncHandler(async (req, res) => {
  const payload = validateSubmitTimesheet(req.body);
  const timesheet = await contractorTimesheetService.submitTimesheet(req.user.userId, payload);
  res.status(201).json(timesheet);
});

const list = asyncHandler(async (req, res) => {
  const timesheets = await contractorTimesheetService.listMyTimesheets(req.user.userId);
  res.status(200).json(timesheets);
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
    payload
  );
  res.status(200).json(timesheet);
});

module.exports = { submit, list, update };
