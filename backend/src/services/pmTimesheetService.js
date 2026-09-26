const { pool } = require("../config/db");
const timesheetRepository = require("../repositories/timesheetRepository");
const milestoneService = require("./milestoneService");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");
const { pageResult } = require("../utils/listQuery");
const notifications = require("./notificationService");

// List daily review rows only for projects owned by the authenticated PM.
async function listPending(pmId) {
  return timesheetRepository.listPendingForPm(pmId);
}

async function listPendingPage(pmId, query) {
  const { rows, total } = await timesheetRepository.listPendingPageForPm(pmId, query);
  return pageResult(rows, total, query);
}

// Lock and conditionally review the PM-owned row; evaluate milestones only after approval commits.
async function reviewTimesheet(pmId, timesheetId, status, auditActor, rejectionReason = null) {
  const conn = await pool.getConnection();
  let reviewed;
  try {
    await conn.beginTransaction();

    const timesheet = await timesheetRepository.lockForReview(conn, timesheetId);
    if (!timesheet || timesheet.pm_id !== pmId) {
      // Use the same 404 for missing and foreign timesheets.
      throw ApiError.notFound("Timesheet not found.");
    }
    if (timesheet.status !== "SUBMITTED") {
      throw ApiError.conflict("This timesheet has already been reviewed.");
    }

    const updated = await timesheetRepository.markReviewed(conn, timesheetId, status, pmId, rejectionReason);
    if (!updated) {
      // Reject reviews that lose the conditional status transition.
      throw ApiError.conflict("This timesheet has already been reviewed.");
    }
    if (auditActor) await auditService.write(conn, auditActor, "TIMESHEET_REVIEWED", "timesheet", timesheetId, { status: timesheet.status }, { status, reviewed_by: pmId, rejection_reason: rejectionReason });

    await conn.commit();
    reviewed = timesheet;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  if (status === "APPROVED") {
    // Re-evaluate project-wide milestones after the approval transaction commits.
    await milestoneService.checkAndTriggerMilestones(reviewed.project_id, auditActor);
  }
  const recipientId = await notifications.contractorUserId(reviewed.contractor_id);
  if (recipientId) await notifications.notify({recipientId,eventType:`TIMESHEET_${status}`,entityType:"timesheet",entityId:timesheetId,message:`A timesheet was ${status.toLowerCase()}.`,deepLink:"/contractor/timesheets"});

  return timesheetRepository.findById(timesheetId);
}

// Lock bulk-review IDs in ascending order and roll back every row if any ownership or status check fails.
async function reviewTimesheets(pmId, timesheetIds, status, auditActor, rejectionReason = null) {
  const ids = [...new Set(timesheetIds)].sort((a, b) => a - b);
  const conn = await pool.getConnection();
  const projects = new Set();
  try {
    await conn.beginTransaction();
    for (const timesheetId of ids) {
      const timesheet = await timesheetRepository.lockForReview(conn, timesheetId);
      if (!timesheet || timesheet.pm_id !== pmId) throw ApiError.notFound("Timesheet not found.");
      if (timesheet.status !== "SUBMITTED") throw ApiError.conflict("One or more timesheets have already been reviewed.");
      const updated = await timesheetRepository.markReviewed(conn, timesheetId, status, pmId, rejectionReason);
      if (!updated) throw ApiError.conflict("One or more timesheets have already been reviewed.");
      if (auditActor) await auditService.write(conn, auditActor, "TIMESHEET_REVIEWED", "timesheet", timesheetId, { status: timesheet.status }, { status, reviewed_by: pmId, rejection_reason: rejectionReason });
      projects.add(timesheet.project_id);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
  if (status === "APPROVED") {
    for (const projectId of projects) await milestoneService.checkAndTriggerMilestones(projectId, auditActor);
  }
  return Promise.all(ids.map((id) => timesheetRepository.findById(id)));
}

module.exports = { listPending, listPendingPage, reviewTimesheet, reviewTimesheets };
