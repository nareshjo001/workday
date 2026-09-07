const { pool } = require("../config/db");
const timesheetRepository = require("../repositories/timesheetRepository");
const milestoneService = require("./milestoneService");
const ApiError = require("../utils/ApiError");
const auditService = require("./auditService");
const { pageResult } = require("../utils/listQuery");
const notifications = require("./notificationService");

/**
 * PENDING daily timesheets for projects owned by the authenticated PM.
 * `pmId` is req.user.userId off the JWT — the actual ownership boundary
 * is the SQL join in timesheetRepository.listPendingForPm
 * (timesheet.project_id -> project.pm_id = pmId), not any filtering done
 * here or in the controller. Each row is one contractor's one day — a PM
 * reviews (approves/rejects) individual days, there is no "approve the
 * whole week" action anywhere in this codebase.
 */
async function listPending(pmId) {
  return timesheetRepository.listPendingForPm(pmId);
}

async function listPendingPage(pmId, query) {
  const { rows, total } = await timesheetRepository.listPendingPageForPm(pmId, query);
  return pageResult(rows, total, query);
}

/**
 * Approves or rejects a single daily timesheet row on behalf of the
 * authenticated PM. `pmId` is req.user.userId off the JWT — reviewed_by
 * is always this value, never anything from the request body.
 *
 * Transaction (spec section 7):
 *   1. BEGIN.
 *   2. lockForReview locks the timesheet row (`SELECT ... FOR UPDATE`,
 *      joined with its project to read pm_id in the same query) — a
 *      second concurrent review request for the SAME timesheet blocks
 *      here until this transaction commits or rolls back.
 *   3. Verify the timesheet exists AND belongs to a project owned by
 *      this PM. A mismatch on either returns a plain 404 — same message
 *      either way, so a PM probing another PM's timesheet id cannot tell
 *      "doesn't exist" from "not yours" (spec edge case J, no
 *      information leakage).
 *   4. Verify it is still PENDING — already-reviewed timesheets return a
 *      clean 409, never silently re-reviewed (spec edge case K).
 *   5. markReviewed does the conditional UPDATE ... WHERE status =
 *      'PENDING', which is the actual atomicity backstop under
 *      concurrency (spec edge case O) — if two requests both got past
 *      the lock in some interleaving, only one UPDATE can match a
 *      still-PENDING row; the loser's affectedRows = 0 becomes a 409
 *      too, not a silent no-op.
 *   6. COMMIT.
 *
 * After a successful commit — and ONLY on APPROVED, never on REJECTED
 * (spec section 15.19) — the Module 5 milestone hook is invoked exactly
 * once, outside the transaction (a failure in Module 5's future logic
 * must never roll back the approval itself). Module 4 does not know or
 * care what the hook does; see milestoneService.js.
 */
async function reviewTimesheet(pmId, timesheetId, status, auditActor, rejectionReason = null) {
  const conn = await pool.getConnection();
  let reviewed;
  try {
    await conn.beginTransaction();

    const timesheet = await timesheetRepository.lockForReview(conn, timesheetId);
    if (!timesheet || timesheet.pm_id !== pmId) {
      // Same 404 whether the timesheet doesn't exist at all or exists
      // but belongs to another PM's project — never confirm which.
      throw ApiError.notFound("Timesheet not found.");
    }
    if (timesheet.status !== "SUBMITTED") {
      throw ApiError.conflict("This timesheet has already been reviewed.");
    }

    const updated = await timesheetRepository.markReviewed(conn, timesheetId, status, pmId, rejectionReason);
    if (!updated) {
      // Lost the race to another request between the lock read above and
      // this UPDATE (should be unreachable given the row lock, but the
      // conditional UPDATE is the real guarantee — guard anyway rather
      // than assuming the lock alone is sufficient).
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
    // Project-level redesign: checkAndTriggerMilestones re-sums the
    // WHOLE project's approved hours (every contractor) fresh inside its
    // own transaction — it does not need timesheetId/contractorId/
    // approvedHours from this specific approval, only which project to
    // re-evaluate. Never blocks or affects this response either way (see
    // that function's own doc comment on why it never throws).
    await milestoneService.checkAndTriggerMilestones(reviewed.project_id, auditActor);
  }
  const recipientId = await notifications.contractorUserId(reviewed.contractor_id);
  if (recipientId) await notifications.notify({recipientId,eventType:`TIMESHEET_${status}`,entityType:"timesheet",entityId:timesheetId,message:`A timesheet was ${status.toLowerCase()}.`,deepLink:"/contractor/timesheets"});

  // Re-fetch fresh, post-commit state for the response, same convention
  // as vendorAssignmentService — the client should see the true
  // server-side row, not a locally-reconstructed one.
  return timesheetRepository.findById(timesheetId);
}

/**
 * Reviews a selected set of submitted daily rows. IDs are deduplicated and
 * locked in ascending order, so two overlapping bulk requests acquire the
 * same row locks in the same order. Each row is ownership-checked inside the
 * one transaction; a single invalid, foreign, or stale row rolls back the
 * complete operation rather than creating a partial review.
 */
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
