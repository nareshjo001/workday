const { pool } = require("../config/db");
const contractorRepository = require("../repositories/contractorRepository");
const projectRepository = require("../repositories/projectRepository");
const assignmentRepository = require("../repositories/assignmentRepository");
const timesheetRepository = require("../repositories/timesheetRepository");
const ApiError = require("../utils/ApiError");

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * THE security boundary for "which dates can a contractor log hours
 * against" — deliberately server-side only, never trusting a browser's
 * <input type="date"> min/max attributes (those are a UX convenience the
 * frontend also sets, but a request built by hand or replayed with a
 * different date must be rejected here regardless). Called from both
 * submitTimesheet (new daily log) and updateTimesheet (editing a
 * REJECTED log) so the rule is enforced identically, from exactly one
 * place, in both cases:
 *
 *   1. workDate must not be in the future (compared as plain ISO date
 *      strings against `todayDateString()` — no Date object math needed,
 *      same lexicographic-comparison approach pmProjectValidators uses
 *      for start/end date ordering).
 *   2. workDate must not be before the project's start_date.
 *   3. workDate must not be after the project's end_date, if the project
 *      has one set (end_date is nullable — an open-ended project has no
 *      upper bound beyond "not in the future").
 */
function assertWorkDateWithinProject(workDate, project) {
  const today = todayDateString();
  if (workDate > today) {
    throw ApiError.badRequest("workDate cannot be in the future.");
  }
  if (workDate < project.start_date) {
    throw ApiError.badRequest("workDate cannot be before the project's start date.");
  }
  if (project.end_date && workDate > project.end_date) {
    throw ApiError.badRequest("workDate cannot be after the project's end date.");
  }
}

/**
 * PROJECT HOURS/ALLOCATION REDESIGN — the remaining-capacity check every
 * new submission and every edit-of-a-rejected-log must pass:
 *
 * `reservedHours` (PENDING + APPROVED, see
 * timesheetRepository.sumReservedHoursForContractorProject) is the
 * "already spoken for" figure. The spec explicitly calls for treating
 * PENDING hours as reserved by default for this MVP — a contractor
 * cannot stack up multiple PENDING submissions that collectively exceed
 * their allocation just because none of them has been approved yet.
 * DOCUMENTED DECISION (per the spec's instruction to document this
 * choice explicitly): if a PM later REJECTS one of those pending
 * submissions, its hours stop being reserved automatically — they were
 * never persisted as "reserved" separately from the row's own status, so
 * a rejection immediately frees that capacity for the contractor's next
 * submission or edit, with no separate bookkeeping needed.
 *
 * A legacy project with no expected_hours set at all has no capacity
 * model to check against — same "don't invent a value that was never
 * captured" stance used elsewhere in this redesign — so submission
 * against it is allowed without a capacity check regardless of what the
 * assignment's own allocated_hours happens to be.
 *
 * MVP FIX 1 ADDITION ("work-hour allocation must belong to the PM, not
 * the Vendor"): on a project that DOES track expected_hours, a contractor
 * whose own allocated_hours is still NULL — i.e. the Vendor has assigned
 * them, but the PM has not yet set their allocation via
 * pmProjectService.updateContractorAllocation — must be blocked from
 * submitting ANY hours, not silently allowed unlimited hours. Without
 * this, a project simply never having its per-contractor allocation set
 * would leave the contractor's cap unenforceable, which would defeat the
 * whole point of the PM owning allocation: "a contractor must never be
 * able to submit/approve more hours than their own remaining allocation"
 * cannot be satisfied when there is no allocation to measure against.
 */
function assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged) {
  if (project.expected_hours === null) return;
  if (assignment.allocated_hours === null) {
    throw ApiError.conflict(
      "Your work-hour allocation for this project has not been set yet. Contact your Project Manager."
    );
  }
  const remaining = Number(assignment.allocated_hours) - reservedHours;
  if (hoursLogged > remaining) {
    throw ApiError.conflict(
      `You have only ${Math.max(0, remaining)} hour(s) remaining for this project.`
    );
  }
}

/**
 * Submits a new PENDING daily timesheet row on behalf of the
 * authenticated contractor. `userId` is req.user.userId off the JWT —
 * this resolves it to the contractor's own contractors.id
 * (timesheets.contractor_id is keyed on that, not on users.id) before
 * doing anything else. There is no parameter here that lets a caller
 * submit hours as a different contractor — contractorId never comes from
 * the request body.
 *
 * Runs inside a transaction that locks the contractor's ACTIVE
 * assignment row for this project
 * (assignmentRepository.lockActiveForContractorProject) — this is what
 * makes the remaining-allocation check below race-safe: two
 * near-simultaneous submissions for the SAME contractor+project
 * serialize on this lock, so the second one always sees the first one's
 * already-committed reservation before deciding whether there's still
 * room.
 *
 * Every rule below is enforced here, in order, each with its own clean
 * error — never a raw DB error, and never by trusting anything the
 * client claims about the project's state or the date's validity:
 *   1. The account must resolve to an ACTIVE contractor record
 *      (inactive contractors cannot submit new timesheets).
 *   2. The contractor must have an ACTIVE assignment on projectId — a
 *      RELEASED contractor cannot log new hours (project hours/
 *      allocation redesign: release ends their ability to submit,
 *      historical rows are untouched). A non-match returns a generic 404
 *      rather than confirming/denying the project exists (no information
 *      leakage) — same as the never-assigned case.
 *   3. The project must be ACTIVE — COMPLETED/ON_HOLD projects reject
 *      new timesheets.
 *   4. workDate must fall inside the project's own date window and not
 *      be in the future — see assertWorkDateWithinProject above.
 *   5. hoursLogged must not exceed the contractor's remaining allocation
 *      on this project — see assertWithinRemainingAllocation above.
 *   6. Duplicate contractor/project/day submissions are rejected with a
 *      clean 409 — see the ER_DUP_ENTRY catch below, backed by the
 *      UNIQUE(contractor_id, project_id, work_date) constraint from
 *      migration 013 (the actual guarantee under concurrency, not just
 *      this check).
 */
async function submitTimesheet(userId, { projectId, workDate, hoursLogged }) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot submit timesheets.");
  }

  const conn = await pool.getConnection();
  let timesheetId;
  try {
    await conn.beginTransaction();

    const assignment = await assignmentRepository.lockActiveForContractorProject(
      conn,
      contractor.id,
      projectId
    );
    if (!assignment) {
      throw ApiError.notFound("You are not assigned to this project.");
    }

    const project = await projectRepository.findById(projectId);
    if (!project || project.status !== "ACTIVE") {
      throw ApiError.conflict("Timesheets can only be logged against active projects.");
    }

    assertWorkDateWithinProject(workDate, project);

    const reservedHours = await timesheetRepository.sumReservedHoursForContractorProject(
      conn,
      contractor.id,
      projectId
    );
    assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged);

    try {
      timesheetId = await timesheetRepository.create({
        contractorId: contractor.id,
        projectId,
        workDate,
        hoursLogged,
      });
    } catch (err) {
      // Race-safety net: the pre-check above is a friendly read, the
      // UNIQUE(contractor_id, project_id, work_date) constraint (migration
      // 013) is the real guarantee against two near-simultaneous
      // submissions for the same project+day.
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A timesheet for this project and date has already been submitted.");
      }
      throw err;
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  return timesheetRepository.findById(timesheetId);
}

/**
 * Lists the authenticated contractor's own daily timesheet history,
 * newest day first — a flat list of daily rows. `userId` is
 * req.user.userId off the JWT — there is no parameter here that lets a
 * caller ask for a different contractor's timesheets. Grouping this into
 * the project -> week -> day view is entirely a frontend concern (see
 * frontend/src/components/timesheets/weekGrouping.js) — nothing here
 * computes or returns a weekly total.
 */
async function listMyTimesheets(userId) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    return [];
  }
  return timesheetRepository.listByContractor(contractor.id);
}

/**
 * Edits one of the authenticated contractor's own timesheet rows —
 * PATCH /api/contractor/timesheets/:id. This is the ONLY way an existing
 * row's hours/date can change after submission, and it is intentionally
 * narrow:
 *   - Only the row's OWNER may edit it. `userId` resolves to the caller's
 *     own contractors.id exactly like submitTimesheet; the lock read
 *     below compares that id against the row's contractor_id and returns
 *     a generic 404 on any mismatch — the same "don't confirm the row
 *     exists at all" leakage protection pmTimesheetService.reviewTimesheet
 *     uses for cross-PM access.
 *   - Only a REJECTED row may be edited. PENDING (already awaiting
 *     review) and APPROVED (a final, billable decision) are immutable —
 *     attempting to edit either returns a clean 409, enforced both by the
 *     status check below AND by updateRejectedLog's conditional
 *     `WHERE status = 'REJECTED'`, the same belt-and-suspenders pattern
 *     markReviewed uses for the PM review transaction.
 *   - project_id, contractor_id, status, reviewed_by and reviewed_at are
 *     never accepted from the client — only workDate and hoursLogged can
 *     change (see validateEditTimesheet). The project itself is
 *     re-fetched here and re-validated exactly like a fresh submission
 *     (must still be ACTIVE, workDate must still fall inside its window
 *     and not be in the future, and the edited hours must still fit the
 *     contractor's remaining allocation — a rejected log from months ago
 *     being edited today must satisfy today's rules, not the rules at
 *     the time it was first submitted).
 *   - A successful edit resets status back to PENDING and clears
 *     reviewed_by/reviewed_at — it re-enters the PM's queue as a new
 *     decision to be made, never silently staying REJECTED or jumping
 *     straight to APPROVED.
 *
 * Runs inside a transaction with a row lock on both the timesheet AND the
 * contractor's assignment (same FOR UPDATE + conditional UPDATE pattern
 * as pmTimesheetService.reviewTimesheet) so a concurrent edit — or a
 * concurrent new submission against the same allocation — can't
 * interleave with this one.
 */
async function updateTimesheet(userId, timesheetId, { workDate, hoursLogged }) {
  const contractor = await contractorRepository.findByUserId(userId);
  if (!contractor) {
    throw ApiError.notFound("Contractor record not found for this account.");
  }
  if (contractor.status !== "ACTIVE") {
    throw ApiError.forbidden("Inactive contractors cannot edit timesheets.");
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await timesheetRepository.lockForOwnerEdit(conn, timesheetId);
    if (!existing || existing.contractor_id !== contractor.id) {
      // Same 404 whether the row doesn't exist at all or belongs to
      // another contractor — never confirm which.
      throw ApiError.notFound("Timesheet not found.");
    }
    if (existing.status !== "REJECTED") {
      throw ApiError.conflict("Only rejected timesheets can be edited.");
    }

    const assignment = await assignmentRepository.lockActiveForContractorProject(
      conn,
      contractor.id,
      existing.project_id
    );
    if (!assignment) {
      // The contractor was released from this project since the row was
      // first submitted — a released contractor cannot resubmit either.
      throw ApiError.conflict("You are no longer assigned to this project and cannot edit this timesheet.");
    }

    const project = await projectRepository.findById(existing.project_id);
    if (!project || project.status !== "ACTIVE") {
      throw ApiError.conflict("Timesheets can only be edited for active projects.");
    }
    assertWorkDateWithinProject(workDate, project);

    const reservedHours = await timesheetRepository.sumReservedHoursForContractorProject(
      conn,
      contractor.id,
      existing.project_id,
      timesheetId
    );
    assertWithinRemainingAllocation(project, assignment, reservedHours, hoursLogged);

    let updated;
    try {
      updated = await timesheetRepository.updateRejectedLog(conn, timesheetId, { workDate, hoursLogged });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        throw ApiError.conflict("A timesheet for this project and date already exists.");
      }
      throw err;
    }
    if (!updated) {
      // Lost a race — status changed between the lock read and the
      // conditional UPDATE (should be unreachable given the row lock,
      // but the conditional WHERE status = 'REJECTED' is the real
      // guarantee, not the lock alone).
      throw ApiError.conflict("Only rejected timesheets can be edited.");
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }

  // Re-fetch fresh, post-commit state for the response, same convention
  // as pmTimesheetService.reviewTimesheet.
  return timesheetRepository.findById(timesheetId);
}

module.exports = { submitTimesheet, listMyTimesheets, updateTimesheet };
