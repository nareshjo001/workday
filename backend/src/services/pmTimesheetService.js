const { pool } = require("../config/db");
const timesheetRepository = require("../repositories/timesheetRepository");
const milestoneService = require("./milestoneService");
const ApiError = require("../utils/ApiError");

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
async function reviewTimesheet(pmId, timesheetId, status) {
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
    if (timesheet.status !== "PENDING") {
      throw ApiError.conflict("This timesheet has already been reviewed.");
    }

    const updated = await timesheetRepository.markReviewed(conn, timesheetId, status, pmId);
    if (!updated) {
      // Lost the race to another request between the lock read above and
      // this UPDATE (should be unreachable given the row lock, but the
      // conditional UPDATE is the real guarantee — guard anyway rather
      // than assuming the lock alone is sufficient).
      throw ApiError.conflict("This timesheet has already been reviewed.");
    }

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
    await milestoneService.checkAndTriggerMilestones(reviewed.project_id);
  }

  // Re-fetch fresh, post-commit state for the response, same convention
  // as vendorAssignmentService — the client should see the true
  // server-side row, not a locally-reconstructed one.
  return timesheetRepository.findById(timesheetId);
}

module.exports = { listPending, reviewTimesheet };
